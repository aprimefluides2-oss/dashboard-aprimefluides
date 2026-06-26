# Mission — Centraliser tous les appels Claude derrière un wrapper Haiku-only + dashboard de coûts

## Contexte projet (à lire avant de coder)

**Repo :** `app-realisations-ltdb` — outil interne Next.js 14 App Router qui transforme la dictée vocale d'un technicien plombier (LTDB, Var) en :
1. Un rapport d'intervention (PDF + page de réalisation SEO publiée sur www.aprime-fluides.fr).
2. Optionnellement un devis et une attestation envoyés par email (Resend).

**Stack réel :**
- Next.js 14 App Router, TypeScript strict, Tailwind
- `@anthropic-ai/sdk` (Claude), `openai` (Whisper)
- NextAuth (auth admin), Resend (emails)
- **Pas de Prisma. Pas de Supabase. Pas de DB SQL.** Le pipeline est stateless.
- Déploiement Vercel (`vercel.json` à la racine)

**Pipeline existant (à NE PAS recréer) :**
- `app/api/transcribe/route.ts` → Whisper (`whisper-1`, langue `fr`, vocabulaire métier débouchage/Var)
- `app/api/extract/route.ts` → Haiku 4.5 (`claude-haiku-4-5-20251001` hardcodé) — extrait JSON depuis dictée
- `app/api/generate/route.ts` → **actuellement Sonnet 4.5** (`process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"`) — génère rapport + page SEO en parallèle

## Objectif de cette mission

Trois chantiers, pas de scope creep :

1. **Centraliser** tous les appels Claude derrière un wrapper unique `lib/anthropic.ts` qui hardcode Haiku 4.5.
2. **Migrer `generate/route.ts` de Sonnet vers Haiku** via le wrapper (le seul endroit qui utilise encore Sonnet).
3. **Logger chaque appel dans Vercel KV** + exposer un dashboard `/admin/ai-cost` (protégé par NextAuth).

**Hors scope** (ne PAS faire) :
- Pas de Prisma, pas de Supabase, pas de migration DB.
- Pas de nouvelle route `/api/interventions/[id]/voice-report` — le pipeline `transcribe → extract → generate` existe déjà et reste tel quel côté contrats.
- Pas de module documents/upload PDF, pas de pdf-parse.
- Pas de refactor des prompts métier (rapport, SEO, extract) au-delà du strict nécessaire pour la migration Haiku.
- Pas de modification du flow Resend ni des PDF (`@react-pdf/renderer`).

## Règles non-négociables (LTDB)

1. **Modèle Claude :** UNIQUEMENT `claude-haiku-4-5-20251001`. Hardcodé dans `lib/anthropic.ts`. **Aucune autre `messages.create()` n'a le droit d'exister ailleurs dans le repo après cette mission** — tout passe par le wrapper.
2. **Téléphone :** s'il apparaît dans du code, doit être `+33 7 83 63 68 35` (variable d'env `LTDB_PHONE` si possible). Ne pas inventer.
3. **Prix :** ne jamais hardcoder. Les placeholders `{PRIX_MIN}` / `{PRIX_MAX}` dans les prompts existants restent en place.
4. **Site web :** `https://www.aprime-fluides.fr` (constante `SITE` dans `generate/route.ts`).
5. **TypeScript strict.** Pas de `any` non justifié. Pas de `// @ts-ignore`.
6. **Pas de Tailwind CSS custom inline.** Composants serveur par défaut (App Router).

---

## Phase 1 — Wrapper `lib/anthropic.ts`

**Fichier à créer :** `lib/anthropic.ts`

**Contrat :**

```ts
export type AiTask =
  | 'extract'         // extract/route.ts
  | 'generate-rapport' // generate/route.ts (appel rapport)
  | 'generate-seo'    // generate/route.ts (appel SEO)
  | 'devis'           // generate-devis/route.ts si applicable
  | 'attestation'     // generate-attestation/route.ts si applicable
  | 'quote-comp'      // quote-complementaire/route.ts si applicable
  | 'other'

export interface AskHaikuOptions {
  task: AiTask
  messages: Anthropic.MessageParam[]
  maxTokens?: number          // défaut 2000
  system?: string             // optionnel
  retry?: number              // défaut 5
  /** Si true, parse la réponse comme JSON (avec repair). Renvoie .json en plus de .text */
  parseJson?: boolean
  /** Métadonnées libres ajoutées au log KV (ex: { ville, type_intervention }). Pas de PII brute. */
  meta?: Record<string, string | number | boolean>
}

export interface AskHaikuResult<T = unknown> {
  text: string
  json?: T
  raw: Anthropic.Message
  usage: { input_tokens: number; output_tokens: number }
  costUsd: number
  durationMs: number
}

export async function askHaiku<T = unknown>(
  opts: AskHaikuOptions
): Promise<AskHaikuResult<T>>
```

**Implémentation requise :**

- Constante `MODEL = 'claude-haiku-4-5-20251001'` en haut, exportée pour les tests.
- Instancie `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` une seule fois (singleton module-level).
- Réutilise les helpers déjà présents dans le repo (`callWithRetry`, `parseJson`, `repairJson` qu'on retrouve dans `extract/route.ts` et `generate/route.ts`) → **les déplacer ici** et les supprimer des fichiers d'origine (les routes les importeront depuis `lib/anthropic.ts`).
- Calcul du coût (USD) via constantes en haut du fichier :
  ```ts
  const PRICE_INPUT_PER_MTOK = Number(process.env.HAIKU_PRICE_INPUT ?? 1.00)
  const PRICE_OUTPUT_PER_MTOK = Number(process.env.HAIKU_PRICE_OUTPUT ?? 5.00)
  ```
  Coût = `(input_tokens * PRICE_INPUT + output_tokens * PRICE_OUTPUT) / 1_000_000`.
- Après chaque appel (succès **ou** échec), push un log dans Upstash Redis via `lib/ai-log.ts` (Phase 4). En cas d'échec, log avec `error: string` et `costUsd: 0`. **Ne jamais bloquer la requête utilisateur si Redis est down** — try/catch silencieux autour du `redis.zadd`, juste un `console.warn`.
- `parseJson: true` → utilise les helpers `parseJson`/`repairJson` exportés. Si parse échoue après repair → throw avec `raw.slice(0, 500)` dans le message.
- Pas de logs sensibles : ne JAMAIS push `messages` complets dans Redis. Logger seulement `task`, `meta`, `usage`, `costUsd`, `durationMs`, `error`.

**Anti-patterns à éviter :**
- Ne pas instancier `new Anthropic()` ailleurs dans le repo après cette phase.
- Ne pas exposer `MODEL` comme variable d'env modifiable. Hardcodé.
- Ne pas faire d'appels parallèles depuis ce wrapper — c'est le caller qui gère `Promise.all`.

---

## Phase 2 — Migrer `generate/route.ts` vers Haiku

**Fichier à modifier :** `app/api/generate/route.ts`

**Changements minimaux :**

1. Supprimer `const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"`.
2. Supprimer `import Anthropic from "@anthropic-ai/sdk"`, `const client = new Anthropic(...)`.
3. Supprimer `callWithRetry`, `parseJson`, `repairJson` locaux (déplacés dans `lib/anthropic.ts`).
4. Remplacer les deux `client.messages.create({ model: MODEL, ... })` par :
   ```ts
   const [rapport, seo] = await Promise.all([
     askHaiku<RapportSchema>({
       task: 'generate-rapport',
       messages: [{ role: 'user', content: rapportPrompt }],
       maxTokens: 6000,
       parseJson: true,
       meta: { ville, type_intervention, cp },
     }),
     askHaiku<SeoSchema>({
       task: 'generate-seo',
       messages: [{ role: 'user', content: seoPrompt }],
       maxTokens: 6000,
       parseJson: true,
       meta: { ville, type_intervention, cp },
     }),
   ])
   ```
5. Adapter le code aval (qui consommait `rapportMsg.content[0].text`) pour utiliser `rapport.json` directement.
6. Conserver `export const maxDuration = 300`.
7. Conserver TOUS les prompts métier (`rapportPrompt`, `seoPrompt`) à l'identique. **Ne pas réécrire les prompts.** Si un prompt produit un résultat trop long pour Haiku → ajuster `maxTokens`, pas le prompt.
8. Conserver intégralement le bloc post-génération (`seo.slug = realisationSlug`, `seo.jsonld = {...}`, etc.).

**Validation :** après migration, lancer `npm run dev` et tester avec une dictée réelle (cf. Phase 6). Le JSON retourné doit avoir la même shape qu'avant (`{ rapport, seo }`).

**Risque connu :** Haiku 4.5 est moins verbeux que Sonnet sur les paragraphes longs (5-7 phrases). Si le résultat est nettement plus court qu'avant la migration, NE PAS rajouter de Sonnet — remonter le problème à l'utilisateur avant tout ajustement de prompt.

---

## Phase 3 — Migrer `extract/route.ts` vers le wrapper

**Fichier à modifier :** `app/api/extract/route.ts`

**Changements :**

1. Supprimer la constante locale `MODEL`, l'import `Anthropic`, l'instanciation `client`, et les helpers locaux (`callWithRetry`, `parseJson`).
2. Remplacer le bloc `try { msg = await callWithRetry(() => client.messages.create(...)) }` par un appel `askHaiku({ task: 'extract', parseJson: true, ... })`.
3. **Conserver le fallback gracieux existant** (renvoyer un objet avec `warning` si l'API plante) — c'est important pour ne pas bloquer le flow technicien sur le terrain.
4. Conserver la normalisation `findVilleByName` / `searchVilles`.

---

## Phase 4 — Logging KV (`lib/ai-log.ts`)

**Store utilisé :** `redis-bronze-candle` (Upstash Redis, intégration Vercel Marketplace — déjà provisionné par l'utilisateur).

**Dépendance à installer :**
```bash
npm i @upstash/redis
```

**Variables d'env requises** (déjà injectées automatiquement par l'intégration Vercel Marketplace en Production / Preview / Development) :
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Pour bosser en local, l'utilisateur doit copier ces 2 vars depuis Vercel Dashboard → Settings → Environment Variables → onglet `redis-bronze-candle` vers son `.env.local`. **Ne pas commit `.env.local`.**

**Initialisation du client (singleton module-level dans `lib/ai-log.ts`) :**
```ts
import { Redis } from '@upstash/redis'
const redis = Redis.fromEnv() // lit auto UPSTASH_REDIS_REST_URL / _TOKEN
```

**Fichier à créer :** `lib/ai-log.ts`

**Contrat :**

```ts
export interface AiLogEntry {
  ts: number              // Date.now()
  task: AiTask
  model: string           // toujours 'claude-haiku-4-5-20251001'
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  ok: boolean
  error?: string          // tronqué à 200 chars
  meta?: Record<string, string | number | boolean>
}

export async function logAiCall(entry: AiLogEntry): Promise<void>
export async function getAiLogs(opts: {
  fromTs: number
  toTs: number
  limit?: number          // défaut 1000, max 5000
}): Promise<AiLogEntry[]>
```

**Stratégie de stockage :**
- Sorted set unique : `ailog:v1` (score = `ts`, member = `JSON.stringify(entry)`).
- Écriture : `await redis.zadd('ailog:v1', { score: entry.ts, member: JSON.stringify(entry) })`.
- TTL : pas de TTL natif sur sorted set Redis — implémenter une purge via `await redis.zremrangebyscore('ailog:v1', 0, Date.now() - 90*24*3600*1000)` appelée 1 fois sur 100 dans `logAiCall` (échantillonnage simple, ex: `if (Math.random() < 0.01) { ... }`).
- `getAiLogs` utilise `await redis.zrange('ailog:v1', fromTs, toTs, { byScore: true, count: limit, offset: 0, rev: false })` puis `JSON.parse` chaque membre. **Note Upstash :** `zrange` peut retourner les membres déjà désérialisés en objets si stockés directement — préférer toujours `JSON.stringify` à l'écriture et `JSON.parse` à la lecture pour rester déterministe.
- Échec Redis (timeout, 503, env vars manquantes) → `console.warn('[ai-log] Upstash unavailable:', err.message)` et return silencieux. **Ne jamais throw — le wrapper `askHaiku` doit continuer à fonctionner même si le store est down.**

**Note sur les performances :**
- Quotas Upstash free tier : 10K commandes / jour, 256 MB. Pour LTDB (~50-200 calls IA / jour estimés), c'est largement suffisant.
- Une commande par appel IA (zadd) + occasionnellement une purge (zremrangebyscore) + les query du dashboard.

---

## Phase 5 — Dashboard `/admin/ai-cost`

**Fichiers à créer :**
- `app/api/admin/ai-cost/route.ts`
- `app/admin/ai-cost/page.tsx`

**Auth :**
- Récupérer le pattern d'auth déjà utilisé dans le repo : `lib/auth.ts` + middleware. Le dashboard DOIT être derrière la même auth que les autres pages admin existantes.
- Si une page admin existe déjà (chercher dans `app/admin/*` ou via le middleware), copier exactement le même garde.
- Si la session est absente ou non-admin → redirect `/api/auth/signin` (page) ou 401 JSON (route API).

**API `GET /api/admin/ai-cost` :**

Query params :
- `from` (ISO date, défaut J-30)
- `to` (ISO date, défaut maintenant)

Response :
```ts
{
  range: { from: string; to: string }
  totals: {
    calls: number
    inputTokens: number
    outputTokens: number
    costUsd: number
    errorCount: number
  }
  byTask: Array<{ task: AiTask; calls: number; costUsd: number }>
  byDay: Array<{ day: string; calls: number; costUsd: number }>
  recent: AiLogEntry[]   // 50 derniers, triés desc par ts
}
```

**Page `/admin/ai-cost` (composant serveur) :**
- Layout simple Tailwind, pas de lib de charts (pas de scope creep).
- En haut : 4 KPI cards (calls, tokens in, tokens out, cost USD).
- Tableau "By task" : task | calls | cost.
- Tableau "By day" : 30 lignes max, jour | calls | cost.
- Tableau "Recent calls" : 50 lignes, ts (formaté `Intl.DateTimeFormat('fr-FR')`), task, status (✓ / ✗), tokens, cost, durée. Si `error` présent, afficher en rouge avec tooltip.
- Filtres date : 2 inputs `<input type="date">` + bouton "Filtrer" qui fait un `<form method="GET">` avec query params. Pas de JS client-side.

**Anti-patterns :**
- Pas de `'use client'` sauf si strictement nécessaire (le filtre form GET fonctionne sans).
- Pas de fetch côté client. Le composant serveur appelle directement `getAiLogs()` via import.

---

## Phase 6 — Validation & tests manuels

**Avant de marquer la mission terminée, exécuter :**

```bash
# 1. Type-check propre
npx tsc --noEmit

# 2. Build propre
npm run build

# 3. Lint propre (si script présent)
npm run lint
```

**Test fonctionnel local (`npm run dev`) :**

1. Aller sur la page de dictée (chercher dans `app/*` la page qui consomme `/api/transcribe`).
2. Enregistrer/uploader une dictée test (~30 sec, mentionnant : "débouchage WC à La Seyne, Mme Durand, intervention de 1h").
3. Vérifier que la chaîne complète fonctionne : transcribe → extract → generate.
4. Ouvrir `/admin/ai-cost` → vérifier que **3 entrées** apparaissent dans "Recent calls" : `extract`, `generate-rapport`, `generate-seo`.
5. Vérifier que `model` = `claude-haiku-4-5-20251001` partout.
6. Vérifier que le coût total est cohérent (~quelques cents pour ce test).

**Audit final — grep de sécurité :**

```bash
# Aucun résultat attendu (sauf dans lib/anthropic.ts) :
grep -rn "claude-sonnet" --include="*.ts" --include="*.tsx" .
grep -rn "ANTHROPIC_MODEL" --include="*.ts" --include="*.tsx" .
grep -rn "new Anthropic(" --include="*.ts" --include="*.tsx" .
grep -rn "messages.create(" --include="*.ts" --include="*.tsx" .
```

Le seul match légitime pour les 2 derniers grep doit être `lib/anthropic.ts`.

---

## Plan d'exécution recommandé pour Claude Code

1. **Lire** ce fichier en entier + `app/api/extract/route.ts` + `app/api/generate/route.ts` + `lib/auth.ts` + un exemple de page admin existante (s'il y en a).
2. **Présenter un plan détaillé** des fichiers à créer/modifier et **attendre validation** avant de coder.
3. **Phase 1 d'abord (wrapper seul, pas de KV)** → présenter le diff → attendre validation.
4. **Phase 4 (Upstash Redis) en parallèle** → le store `redis-bronze-candle` est déjà provisionné côté Vercel. Demander à l'utilisateur de confirmer que `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` sont présents dans `.env.local` avant de tester.
5. **Phases 2 et 3** (migration des routes) → diff par fichier, attendre validation.
6. **Phase 5** (dashboard) → diff complet, attendre validation.
7. **Phase 6** (validation) → exécuter, reporter les résultats.

À chaque phase : montrer le diff, attendre OK, puis passer à la suivante. Pas de big-bang.
