# Reprise et validation de publication — 15 octobre 2026

Préparation isolée sur le VPS : /home/ubuntu/dashboard-recovery-20261015, branche codex/recovery-publication-20261015, basée sur dd50441. Aucun déploiement ni changement des données de production. La branche de sécurité distincte reste à intégrer après configuration des accès.

Fonctions préparées :
- Brouillon complet IndexedDB : champs, rapport généré, SEO, fichiers photos, légendes, références aux fichiers déjà enregistrés.
- Restauration à l’ouverture, sans écraser un dossier explicitement ouvert depuis planning/historique.
- Message distinguant stockage sur appareil et sauvegarde serveur ; erreurs de stockage visibles.
- En mode terrain, photo conservée avant envoi, reprise manuelle, identifiant stable pour limiter les doublons après une réponse perdue.
- Publication depuis le dossier sauvegardé, contrôle des champs, confirmation de relecture, arrêt si une photo n’est pas récupérable.
- Sauvegarde du rapport refusée si un transfert photo échoue ; vérification qu’une intervention mise à jour existe réellement.

Validation : TypeScript sans erreur, 16 contrôles de stockage/validation dont transaction annulée et fichiers binaires, ouverture dans le navigateur et restauration du texte d’essai dans une nouvelle ouverture. Aucun appel IA, email ou publication réelle.

Limites avant mise en ligne : le parcours avec Supabase/Django et fichiers photo doit être testé en environnement de prévisualisation isolé. Le brouillon appartient au même navigateur/appareil, n’est pas une sauvegarde distante, et ne survit pas à l’effacement des données du navigateur. Une réouverture complète hors réseau n’est pas garantie puisque les pages privées ne doivent pas être mises en cache. Pas de garantie contre une fermeture avant la fin de l’écriture locale. Un seul dossier de rédaction actif par profil de navigateur. La dictée audio brute et les formulaires texte du mode terrain ne sont pas encore couverts par ce lot. La concurrence de photos depuis plusieurs appareils mérite un traitement atomique séparé.

Commande des tests, dépendance de test installée uniquement dans /tmp :
APRIME_RECOVERY_TEST_DEPS=/tmp/aprime-recovery-test/node_modules/fake-indexeddb ./node_modules/.bin/tsx scripts/test-recovery.ts
