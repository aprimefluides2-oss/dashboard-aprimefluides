# Setup Supabase — Aprime fluides CRM

## 1. Créer le projet
1. https://supabase.com → Sign up.
2. `New project` → `aprimefluides-crm` → région **Europe (West) Paris** → mot de passe DB (note-le).
3. Attendre ~2 min que le projet soit provisionné.

## 2. Exécuter le schéma
1. Dashboard → `SQL Editor` → `New query`.
2. Coller le contenu de `schema.sql`.
3. `Run` (bouton vert en bas à droite).
4. Vérifier dans `Table Editor` : tu dois voir 5 tables (clients, techniciens, interventions, documents, factures_fournisseurs).

## 3. Récupérer les clés
Dashboard → `Project Settings` → `API` :
- `Project URL` → variable `SUPABASE_URL`
- Section `Project API keys` → ligne **service_role** (`secret`) → variable `SUPABASE_SERVICE_ROLE_KEY`

⚠ **Ne jamais** exposer la `service_role` côté client (elle bypass toutes les protections). On l'utilise uniquement dans les routes API Next.js.

## 4. Configurer les env vars
### `.env.local` (dev)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Vercel (prod)
Project → Settings → Environment Variables → ajouter les deux. Cocher Production + Preview + Development.
Redéployer (`vercel --prod` ou push).

## 5. Vérifier la connexion
Une fois les env vars en place, le bouton `Historique` de l'app affichera la liste (vide au début).
