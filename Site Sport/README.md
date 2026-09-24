# Momentum

Application web mobile-first de suivi de musculation, nutrition et récupération. Elle fonctionne hors connexion après installation, conserve les données par compte dans un coffre IndexedDB chiffré et peut évoluer vers un service hébergé.

## Développement

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
npm run test:e2e
```

Les tests unitaires couvrent les calculs et la validation profonde des sauvegardes. Le parcours Edge couvre la création de deux comptes, la séparation des données, la récupération du mot de passe, une séance, l’eau, le sommeil, le rechargement et toutes les routes privées.

## Comptes et sécurité locale

Chaque compte reçoit une clé de données aléatoire. Cette clé est enveloppée avec AES-GCM par une clé dérivée du mot de passe avec PBKDF2-SHA-256 (310 000 itérations). Le code de récupération enveloppe séparément la même clé. Les données sportives sont chiffrées avec AES-GCM et liées à l’identifiant du compte comme donnée authentifiée.

La clé de session reste dans `sessionStorage`, expire après 12 heures et disparaît à la déconnexion ou à la fermeture de l’onglet. Le mot de passe n’est jamais enregistré. Une exportation JSON demandée par l’utilisateur est volontairement lisible afin de rester portable : elle doit être conservée comme une sauvegarde personnelle.

Cette authentification locale isole réellement les profils dans l’application et chiffre leur stockage. Elle ne remplace pas un serveur pour une mise en ligne multi-appareils. La récupération par e-mail, la révocation distante et la protection contre un appareil compromis nécessitent le service décrit ci-dessous.

## Passage en production hébergée

L’interface `AUTH_ADAPTER_CONTRACT` de `src/auth.jsx` sépare l’UI du fournisseur d’identité. Pour une version en ligne :

1. remplacer `localAuthAdapter` par un adaptateur OIDC/Supabase/Auth.js ou une API interne utilisant des cookies de session `HttpOnly`, `Secure`, `SameSite=Lax` ;
2. implémenter un dépôt distant derrière la même frontière que `loadUserState` / `saveUserState`, avec synchronisation IndexedDB hors connexion et résolution de versions ;
3. stocker `user_id` sur chaque enregistrement et appliquer l’isolation côté base (Row Level Security ou filtrage obligatoire testé côté serveur) ;
4. envoyer les e-mails de vérification et de réinitialisation avec des jetons courts, à usage unique et expirants ;
5. déployer sous HTTPS avec les en-têtes de `public/_headers`, rotation de session, limitation de débit, journal d’audit et sauvegardes chiffrées.

Les collections à synchroniser sont déjà séparées dans l’état utilisateur : programme, séances, poids, repas, suppléments, hydratation, sommeil, objectifs et historique des ranks. Les pages privées ne sont montées qu’après restauration d’une session valide.

## Données et confidentialité

Aucun outil d’analyse ni service externe n’est appelé par l’application. Les illustrations sont des fichiers locaux optimisés. Les notifications à heure fixe restent soumises aux limites du navigateur ; l’export calendrier `.ics` offre une solution fiable sans serveur push.

Les estimations de protéines et l’indicateur d’état du jour sont des repères généraux. Ils ne constituent ni une prescription, ni un diagnostic médical.
