# Tester Momentum sur localhost

Le frontend reste sur votre ordinateur. Il utilise déjà Supabase pour la connexion et la synchronisation : aucune publication GitHub Pages n'est nécessaire pour tester.

## Pourquoi la connexion est désactivée

Si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont absentes ou vides, aucun service de compte n'est connecté. `.env.example` est un modèle, pas la configuration chargée automatiquement. Les anciens comptes de navigateur ne sont pas des comptes Supabase ; leurs données restent conservées et pourront être migrées après la nouvelle connexion.

## Première configuration

1. Créer ou ouvrir votre projet Supabase. Un projet distinct de développement permet de séparer les données de test de celles de production.
2. Dans `Site Sport/.env.local`, à côté de `package.json`, renseigner la Project URL HTTPS réelle et la clé publique anon/publishable réelle. Ne pas utiliser une clé serveur.

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

3. Dans le SQL Editor Supabase, appliquer une seule fois `supabase/migrations/202609240001_momentum.sql`. Cette étape crée les tables et les fonctions nécessaires au chargement du tableau de bord. Ne pas réexécuter la migration si elle est déjà appliquée.
4. Activer le fournisseur Email et **Confirm email**. Configurer l'envoi SMTP comme indiqué dans `PRODUCTION_SETUP.md` pour tester avec des destinataires autorisés par votre fournisseur.
5. Dans Authentication → URL Configuration, ajouter ces Redirect URLs :

```text
http://localhost:5173/
http://localhost:5173/?auth=confirm
http://localhost:5173/?auth=recovery
http://localhost:5173/?auth=email
```

Sur un projet réservé au développement, Site URL peut être `http://localhost:5173/`. Sur un projet partagé avec la production, conserver Site URL `https://momentumfit.fr/` et ajouter simplement les Redirect URLs locales : l'application transmet la bonne destination depuis localhost.

6. Arrêter Vite avec Ctrl+C, puis lancer `npm run dev` et ouvrir `http://localhost:5173/`. Si Vite annonce un autre port, adapter les URL autorisées au port utilisé. `127.0.0.1` constitue aussi un hôte distinct à autoriser si vous l'utilisez.
7. Créer un nouveau compte de test, confirmer l'e-mail, puis se connecter. Un ancien mot de passe local ne crée pas automatiquement un compte Internet. Une fois connecté, le panneau de migration permet de retrouver les anciennes données du même navigateur et de la même origine.

`.env.local` est ignoré par Git. Les variables GitHub ne sont nécessaires que lors de la publication. En cas d'utilisation de `npm run preview`, reconstruire avec `npm run build` après toute modification d'environnement et autoriser le port de preview (4173 par défaut).

## Vérifications sans compte réel

`npm test` et `npm run test:e2e` fonctionnent sans identifiants Supabase. Le parcours navigateur utilise des comptes fictifs et un service simulé isolé. Le serveur normal `npm run dev` utilise une vraie connexion Supabase.

Voir `PRODUCTION_SETUP.md` pour les réglages détaillés de la base, des e-mails et du déploiement.
