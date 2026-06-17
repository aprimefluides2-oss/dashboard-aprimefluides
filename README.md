# Aprime fluides — Réalisations et Expertise

Back-office techniciens : dictée vocale, génération IA, PDF, devis, facturation, publication.

**Siège :** 1, rue Jean Carasso, 95000 Bezons

## Démarrage local

```bash
cp .env.local.example .env.local
# Renseigner OPENAI_API_KEY, ANTHROPIC_API_KEY, puis plus tard CLIENT_API_URL / CLIENT_PUBLISH_TOKEN
npm install
npm run dev -- -p 3333
```

> Sur macOS avec Cursor, les ports 3000–3002 peuvent être occupés : utiliser le port **3333**.

## Connexions à configurer (client)

- `CLIENT_API_URL` + `CLIENT_PUBLISH_TOKEN` — publication sur le site web
- `SUPABASE_*` — historique / CRM (optionnel, mode dégradé sans config)
- `RESEND_*` — envoi d’emails
- OAuth réseaux (YouTube, Facebook, TikTok, GMB) — voir commentaires dans `.env.local.example`

## Déploiement

Dépôt cible : [app-aprimefluides](https://github.com/3snv83136-coder/app-aprimefluides.git) — Vercel recommandé.
