# Momentum

Application React/Vite de suivi musculation, nutrition et récupération. Frontend GitHub Pages, authentification et données par utilisateur dans Supabase, cache IndexedDB et synchronisation hors ligne.

## Démarrage

Copier .env.example dans .env.local et renseigner les deux variables publiques du projet Supabase.

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
npm run test:e2e
npm audit
```

Sans configuration Supabase, l'écran de compte indique que le service est indisponible ; les anciennes données restent conservées. Les tests navigateur utilisent leur propre faux backend et compilent un artefact isolé.

## Production et données

Suivre [PRODUCTION_SETUP.md](docs/PRODUCTION_SETUP.md) pour les migrations SQL, RLS, confirmation d'e-mail, SMTP, variables GitHub et tests sur momentumfit.fr. Le workflow actif se trouve dans ../.github/workflows/deploy.yml ; le dépôt contient Site Sport comme sous-dossier.

L'[audit d'architecture](docs/ARCHITECTURE.md) décrit les formats historiques et leur mapping. La synchronisation vérifie une révision distante ; un conflit préserve les deux copies et demande un choix. Le cache est propre à chaque compte et conserve les envois en attente. Les anciens coffres AES-GCM ne sont jamais effacés et peuvent être déverrouillés pour migration. Le nouveau cache ne promet pas de chiffrement de bout en bout.

Les sauvegardes JSON v1/v2 restent compatibles. Les exports contiennent uniquement les données de suivi, sans session ni secret. Les copies avant import/migration/conflit sont exportables dans Paramètres.

## Illustrations et PWA

50 mouvements, identifiants stables et illustrations originales WebP 960 × 720. Les PNG sources restent dans assets/exercise-sources, hors du déploiement. Pour optimiser : npm run images:optimize. [Prompts et inventaire](docs/EXERCISE_IMAGE_PROMPTS.md).

Le service worker précache le code de l'application ; les images se mettent en cache lors de leur consultation. Une nouvelle version propose une mise à jour après sauvegarde locale. Les rappels restent limités au navigateur ouvert, avec export calendrier ICS disponible.

Aucun outil d'analyse n'est intégré. Les appels externes de données passent par votre projet Supabase. Les repères de protéines et de récupération ne constituent ni prescription ni diagnostic médical.
