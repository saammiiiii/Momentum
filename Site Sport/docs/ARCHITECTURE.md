# Audit et architecture de migration

## État initial (24 septembre 2026)

React 19 / Vite 6, navigation par fragment, 25 tests métier passants. Aucun ESLint configuré. Le dépôt Git et le workflow actif se trouvent un niveau au-dessus de `Site Sport`.

Le schéma courant est v2. L'import accepte les exports v1/v2 et valide strictement chaque champ et référence. Les unités persistées restent kg, ml, heures ; dates civiles locales YYYY-MM-DD. Les programmes PUSH/PULL/LEGS/PUSH 2 et leurs identifiants sont conservés.

| Champ existant | Stockage distant |
| --- | --- |
| profile | profiles.data |
| schemaVersion, onboardingComplete, schedule, scheduleTime, exceptions, reminders, draft, rankHistory | user_settings.data |
| sessions | workouts + workout_exercises + workout_sets |
| weights | body_metrics |
| meals (dont whey) | nutrition_entries |
| hydration / sleep | hydration_entries / sleep_entries |
| supplements, indexé par date | supplement_entries |
| goals / programs / exercises | user_goals / user_programs / user_exercise_preferences |

Les payloads JSONB conservent les structures validées, sans deuxième copie intégrale distante. Les séries et exercices d'une séance sont séparés avec clés étrangères composites incluant user_id. Les événements utilisés pour streak, volume, records et ranks sont synchronisés ; les calculs existants restent inchangés. Les ranks ne sont pas une preuve antifraude : chaque personne peut corriger ses propres événements.

## Données historiques à conserver

`momentum-auth/users` contient les identités locales, vérificateurs PBKDF2 et clés de données enveloppées. `momentum-user-data/profiles` contient un document AES-GCM par ancien compte. `momentum-personal/state/current` est le stockage v1 antérieur aux comptes. Aucun de ces stockages n'est effacé. Le mot de passe/code historique ne sert qu'au déverrouillage local pour migration et n'est jamais envoyé à Supabase. Les marqueurs localStorage des rappels ne constituent pas des événements métier.

## Synchronisation

Un nouveau cache IndexedDB, isolé par UUID Supabase, conserve l'état et sa révision distante avec une file compacte durable (le dernier état complet remplace les états intermédiaires en attente). Le serveur est lu avant toute première écriture. Une RPC transactionnelle vérifie la révision avant de remplacer les lignes du compte. Les conflits préservent les deux copies et nécessitent un choix explicite ; toute résolution/import conserve une sauvegarde locale. Aucun compte local ne donne accès aux pages privées Supabase.

La première connexion nécessite Internet. Une session encore valide peut rouvrir le cache hors ligne ; une session expirée impose une reconnexion sans effacer le cache. Les données du nouveau cache sont stockées dans le navigateur, sans promesse de chiffrement de bout en bout. Le chiffrement historique est conservé pour la migration uniquement.

## Validation prévue

Build après chaque phase ; tests métier, auth simulée, cache/file/conflits, isolation RLS dans PostgreSQL, puis parcours navigateur aux largeurs 375/390/430/1440. La réception réelle des emails et la configuration du projet Supabase doivent être validées après renseignement des deux variables publiques et application de la migration.
