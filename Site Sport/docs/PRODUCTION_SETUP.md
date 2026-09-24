# Mettre Momentum en production

Le code est préparé pour `https://momentumfit.fr`, GitHub Pages et Supabase. Aucun projet Supabase ni identifiant réel n'est fourni dans ce dépôt. Le site existant n'a pas été publié par cette intervention. Suivre les étapes ci-dessous avant de déployer cette version.

## 1. Projet et configuration publique

Créer un projet depuis le tableau de bord Supabase, choisir la région adaptée aux utilisateurs et conserver le mot de passe PostgreSQL dans un gestionnaire de secrets. Il ne doit jamais être placé dans Vite ou GitHub Pages.

Dans **Project Settings / API** (ou **Connect / API keys**, selon l'interface), récupérer la **Project URL** HTTPS et la clé **anon** publique, ou la clé **publishable**. Le frontend accepte ces deux formats. Ne jamais utiliser la clé `service_role`, une clé `sb_secret_…`, un mot de passe SQL ou un secret JWT.

Pour le développement : copier `.env.example` vers `.env.local`, renseigner uniquement :

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ne pas laisser les valeurs vides pour une connexion réelle. Les fichiers `.env*` sont ignorés, sauf `.env.example`. Redémarrer Vite après modification. Le build refuse les clés serveur et les configurations partielles sans afficher leur contenu. Sans variables, le build local reste possible et l'écran indique que le service n'est pas configuré.

## 2. Base PostgreSQL et RLS

Ouvrir le **SQL Editor** du projet Supabase et exécuter une fois, en entier, `supabase/migrations/202609240001_momentum.sql`. Le fichier est transactionnel : une erreur annule la migration. Sur un projet géré avec la CLI, appliquer ce fichier par le workflow habituel de migrations ; ne pas mélanger une seconde application manuelle avec une migration déjà appliquée.

La migration crée 13 tables, des clés étrangères composites pour séances/exercices/séries, les timestamps, les RPC `momentum_read` et `momentum_save`, et le trigger de profil après confirmation d'e-mail. Les mots de passe restent uniquement dans Supabase Auth. Les tableaux JSONB respectent le format de l'application ; les séances sont décomposées sans copie complète distante supplémentaire.

Toutes les tables sont sous RLS, avec SELECT/INSERT/UPDATE/DELETE limité à `auth.uid() = user_id`. Les RPC sont `SECURITY INVOKER` et n'acceptent aucun user_id du client. Seul le trigger interne de création de profil est `SECURITY DEFINER`, avec `search_path` vide et sans droit d'appel public. Le rôle anonyme n'a aucun accès aux données utilisateur ni aux RPC.

Vérifier dans le SQL Editor :

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public';
```

Les 13 tables Momentum doivent avoir `rowsecurity = true` et quatre policies chacune. Exécuter aussi le Security Advisor Supabase. Les tests locaux exécutent réellement le SQL dans PostgreSQL embarqué (PGlite), avec deux comptes fictifs, RLS, clés étrangères et conflits de version. Avant lancement public, refaire une vérification à deux comptes sur le projet Supabase déployé : le JWT du compte B ne doit voir aucune ligne du compte A et doit échouer à insérer une ligne avec son user_id. Ne pas tester RLS avec le SQL Editor seul en rôle administrateur : il peut contourner RLS.

## 3. Authentification et URL

Dans **Authentication / Providers / Email** : activer Email et **Confirm email**. Ce réglage est obligatoire. Si la confirmation est désactivée, Supabase considère les adresses comme confirmées ; le frontend ne peut pas remplacer cette vérification serveur. Choisir une longueur minimale de 10 caractères et une politique lettres/chiffres cohérente avec le formulaire. Activer la protection contre les mots de passe compromis si disponible sur le projet. [Configuration officielle](https://supabase.com/docs/guides/auth/general-configuration), [sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security).

Dans **Authentication / URL Configuration** :

| Réglage | Valeur |
| --- | --- |
| Site URL | `https://momentumfit.fr/` |
| Redirect URL | `https://momentumfit.fr/` |
| Redirect URL confirmation | `https://momentumfit.fr/?auth=confirm` |
| Redirect URL récupération | `https://momentumfit.fr/?auth=recovery` |
| Redirect URL changement d'e-mail | `https://momentumfit.fr/?auth=email` |

Pour les tests locaux avec un projet de développement, ajouter les trois variantes `http://localhost:5173/?auth=confirm`, `?auth=recovery`, `?auth=email` et la racine correspondante. Si vous utilisez `127.0.0.1`, autoriser explicitement cet hôte aussi. Ne pas ajouter de wildcard globale pour la production.

Les liens passent par le endpoint de vérification Supabase puis reviennent à la racine. Le SDK consomme les paramètres de session du fragment ; l'application nettoie ensuite l'URL. La navigation privée reste en `#dashboard`, etc., sans route serveur supplémentaire ni 404 GitHub Pages. Le flux navigateur implicit permet d'ouvrir un e-mail depuis un autre appareil ; aucun secret de serveur n'est requis. [Modèles et liens Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).

## 4. E-mails réellement utilisables en production

Configurer **Authentication / Email / SMTP Settings** avec votre fournisseur SMTP, l'adresse d'expéditeur validée, et les paramètres TLS/port conseillés par ce fournisseur. Ces identifiants restent dans Supabase, jamais dans `.env.local` côté frontend. Configurer les enregistrements DNS d'authentification de votre domaine demandés par le fournisseur.

Le service SMTP intégré Supabase est destiné aux essais et restreint les destinataires ; un SMTP de production est nécessaire pour les comptes publics. [Documentation SMTP officielle](https://supabase.com/docs/guides/auth/auth-smtp).

Dans **Email Templates**, personnaliser en français **Confirm signup**, **Reset password**, **Change email address**, en conservant le lien sécurisé fourni par `{{ .ConfirmationURL }}`. Ne pas le remplacer par un simple lien vers Momentum : le jeton doit d'abord être vérifié par Supabase. Des modèles sobres sont fournis dans `supabase/templates/`. Garder la confirmation sécurisée du changement d'e-mail (ancienne et nouvelle adresses).

Tester avec une adresse de test extérieure à l'équipe du projet : inscription, renvoi, confirmation, connexion, récupération, changement de mot de passe, changement d'adresse, lien expiré et lien déjà utilisé. Vérifier les limites d'envoi Auth/SMTP et les journaux Supabase. Aucun test automatique du dépôt n'envoie d'e-mail réel.

## 5. GitHub Actions et domaine

Le vrai dépôt Git est le dossier parent de `Site Sport`. Le workflow actif est donc `../.github/workflows/deploy.yml`. Une copie de référence se trouve dans `docs/github-pages-deploy.yml`.

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → Variables → New repository variable**, créer exactement :

| Variable de dépôt | Contenu |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL HTTPS réelle |
| `VITE_SUPABASE_ANON_KEY` | Clé publique anon ou publishable réelle |

Le workflow lit `vars.*`, pas `secrets.*`. Ces deux valeurs sont publiques et intégrées au bundle ; RLS assure l'isolation. N'ajouter aucun identifiant serveur au workflow.

Dans **Settings → Pages** conserver **GitHub Actions**, le domaine `momentumfit.fr` et HTTPS. Le fichier `public/CNAME` maintient le domaine dans l'artefact. Le workflow utilise Node 24, `npm ci`, `npm test`, les variables publiques, puis `npm run build`, avant le déploiement Pages. Il refuse de publier si une variable manque. Aucune modification DNS n'est nécessaire si le domaine existant fonctionne déjà.

GitHub Pages n'interprète pas `public/_headers`. Ce fichier documente les en-têtes souhaités pour un éventuel proxy compatible, mais ne constitue pas une protection active sur Pages. Ne pas prétendre que CSP, Permissions-Policy ou frame-ancestors y sont appliqués. La balise referrer du HTML est active ; aucun script tiers ni contenu HTML injecté n'est utilisé.

## 6. Migration des anciens comptes et sauvegardes

Les bases historiques `momentum-auth`, `momentum-user-data`, `momentum-personal` restent intactes. Les anciens mots de passe ne deviennent pas automatiquement des comptes Internet.

Après création/connexion à un compte vérifié, l'application propose la migration. L'utilisateur choisit son ancien profil et déverrouille son coffre avec l'ancien mot de passe ou son code de récupération. La clé AES et les vérificateurs ne sortent jamais du navigateur. Les données sans compte de l'ancienne version sont également détectées.

Le panneau présente le contenu et explique qu'il remplacera le suivi du compte. Il conserve une copie avant migration, importe localement puis tente l'envoi. Le succès distant n'est annoncé qu'une fois la file acquittée. Si la synchronisation reste en attente, son état est visible ; si le serveur a changé, le conflit demande un choix explicite. Le bouton **Plus tard** n'efface rien. La migration peut être rouverte dans **Paramètres → Compte**.

Les exports JSON v1/v2 restent importables. L'import affiche une confirmation, télécharge la copie précédente et conserve aussi une copie dans IndexedDB avant remplacement. **Compte → Voir mes copies de secours locales** permet de les exporter. Les exports contiennent uniquement le suivi validé, sans jetons, clés, mots de passe ni métadonnées de synchronisation. Les historiques de sauvegarde ne sont pas supprimés automatiquement ; penser à les exporter si le stockage devient limité.

## 7. Hors ligne, plusieurs appareils et limites explicites

La première connexion et le premier chargement d'un compte nécessitent Internet. Ensuite, une session valide permet de lire le cache et saisir les modifications hors ligne. La file est persistante et propre au UUID Supabase. La synchronisation reprend au retour en ligne, au retour au premier plan et périodiquement lorsque l'application est ouverte. Pas d'envoi garanti quand iOS ou le navigateur suspend l'application.

La révision distante est vérifiée avant toute écriture. Un conflit bloque les envois jusqu'au choix de la copie appareil ou compte ; les deux copies sont sauvegardées localement. Une deuxième modification distante pendant la résolution déclenche de nouveau le contrôle. Les onglets utilisent aussi un contrôle de version IndexedDB. Le cache d'un autre compte n'est jamais chargé par l'interface.

Cette première version envoie un état complet par transaction, décomposé dans les tables. Cela favorise l'atomicité et la compatibilité des références ; une évolution vers des mutations par événement sera utile pour de très gros historiques. Limite d'import : 12 Mo de JSON. Il n'y a pas de fusion silencieuse des modifications concurrentes, ni de promesse de synchronisation en temps réel instantanée.

Les avatars/pseudos de compte demandent Internet et sont stockés dans `profiles`. Le suivi et ses paramètres restent utilisables hors ligne. Le cache cloud est isolé par compte, mais n'est pas chiffré de bout en bout : la sécurité d'un appareil partagé dépend aussi de sa session système. Les anciens coffres restent chiffrés. Les tokens sont gérés par le SDK et retirés lors de la déconnexion locale ; un token déjà copié peut rester utilisable jusqu'à son expiration, notamment après une déconnexion hors ligne. [Sessions et événements Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

Les streaks et ranks sont calculés à partir des événements synchronisés ; ils ne constituent pas un classement antifraude, puisque les utilisateurs peuvent corriger leurs propres journaux. Les doses de suppléments ne sont jamais ajustées automatiquement.

## 8. PWA, images et contrôles finaux

Le build génère un nom de cache à partir des fichiers et précache tous les JS/CSS nécessaires à l'application. Les images WebP sont chargées à la demande. Une illustration jamais ouverte peut être indisponible hors ligne ; un emplacement neutre est prévu. Le service worker ignore tous les appels Supabase et ne met pas les URL de callback en cache.

Une version en attente affiche **Mettre à jour**. Les écritures locales sont terminées avant activation et rechargement. Le retour au premier plan vérifie les nouvelles versions ; les anciens caches Momentum sont nettoyés après activation. Aucun cache d'une autre application n'est supprimé.

Exécuter avant publication :

```bash
npm ci
npm test
npm run build
npm run test:e2e
npm audit
```

Les tests navigateur compilent un artefact séparé dans `test-results/e2e-dist` avec un faux endpoint intercepté : aucune vraie clé, aucun vrai compte. Ils couvrent les parcours à 375, 390, 430 et 1440 px. Edge installé est utilisé sur Windows ; sinon installer Chromium via Playwright pour votre environnement. Aucun ESLint n'est configuré dans ce projet.

Après publication, vérifier sur le vrai domaine : inscription depuis une adresse externe, lien racine sans 404, confirmation, reset, déconnexion, compte A/B, seconde connexion sur iPhone/ordinateur, import/export, saisie hors ligne puis retour réseau, conflit entre appareils et mise à jour PWA. Ne pas annoncer ces tests distants réussis avant de les avoir effectués avec votre configuration réelle.
