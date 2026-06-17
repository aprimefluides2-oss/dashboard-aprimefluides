# Projet LTDB

## Identité

- **Nom commercial** : Aprime fluides
- **Acronyme** : LTDB
- **Site** : www.aprime-fluide.fr
- **Métier** : Débouchage de canalisations, assainissement, plomberie d'urgence
- **Zone** : Var (83), France
- **Propriétaire** : MONDOR

## Règles ABSOLUES (jamais violer)

1. **Téléphone** : toujours lire depuis `Parametre.TEL_PRINCIPAL`, JAMAIS hardcodé
2. **Prix** : toujours lire depuis la table `Tarif`, JAMAIS hardcodé ni inventé
3. **Nom commercial** : toujours "Aprime fluides" en entier (jamais "LTDB" en façade client, jamais "Toits du Bâtiment", jamais d'invention)
4. **Adresse Biiip Comedy Club** (autre projet MONDOR) : 1 rue de l'Humilité, 83000 Toulon (PAS l'ancienne adresse av. du 15ème Corps)

## Stack

Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase, Prisma, Vercel, Resend, Remotion, @react-pdf/renderer.

## Style code

- TypeScript strict, jamais de `any`
- Server Components par défaut, Client Components seulement si interactif
- Tailwind utility classes, jamais de CSS inline sauf cas exceptionnel
- Erreurs gérées avec try/catch, jamais ignorées silencieusement
