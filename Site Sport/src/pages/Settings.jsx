import React, { useRef, useState } from "react";
import { useApp, sendNotification } from "../context";
import {
  PageHeader,
  Card,
  Button,
  Field,
  Icon,
  Badge,
  Modal,
} from "../components";
import { estimateProtein, today } from "../calculations";
import { exportData, validateImport, requestPersistence } from "../storage";
import { downloadFile, exportCalendar } from "../notifications";
import { useAuth } from "../auth";
export default function Settings() {
  const { state, update, notify, navigate, saveStatus } = useApp(),
    [profile, setProfile] = useState({ ...state.profile }),
    [permission, setPermission] = useState(
      "Notification" in window ? Notification.permission : "unsupported",
    ),
    [incoming, setIncoming] = useState(null),
    [persistent, setPersistent] = useState(null);
  const auth = useAuth();
  const file = useRef();
  const set = (key, value) => setProfile((p) => ({ ...p, [key]: value }));
  const setReminder = (key, patch) =>
    update((s) => ({
      ...s,
      reminders: { ...s.reminders, [key]: { ...s.reminders[key], ...patch } },
    }));
  function saveProfile(e) {
    e.preventDefault();
    const next = {
      ...profile,
      proteinTarget:
        profile.proteinMode === "estimate"
          ? estimateProtein(profile.weight, profile.goal, profile.frequency)
          : profile.proteinTarget,
    };
    if (next.targetDate && next.targetDate < next.startDate)
      return notify("La date cible doit suivre la date de départ.", "error");
    update((s) => ({ ...s, profile: next }));
    setProfile(next);
    notify("Vos paramètres sont enregistrés.");
  }
  async function importFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.size > 12 * 1024 * 1024)
      return notify("Ce fichier dépasse la taille maximale de 12 Mo.", "error");
    try {
      const valid = validateImport(JSON.parse(await f.text()));
      setIncoming(valid);
    } catch (err) {
      notify(
        err instanceof SyntaxError
          ? "Ce fichier n’est pas un JSON valide."
          : err.message,
        "error",
      );
    }
  }
  async function allow() {
    if (!("Notification" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      notify(
        result === "granted"
          ? "Notifications autorisées. Choisissez vos rappels ci-dessous."
          : "Les notifications restent désactivées. Les rappels dans l’application sont disponibles.",
        "info",
      );
    } catch {
      notify(
        "Ce navigateur ne permet pas de demander les notifications ici.",
        "error",
      );
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="VOTRE ESPACE, VOS RÈGLES"
        title="Paramètres"
        description="Un suivi qui s’adapte à votre quotidien."
      />
      <form onSubmit={saveProfile} className="page-stack">
        <Card>
          <div className="section-heading">
            <h2>Mon profil</h2>
            <Icon name="settings" size={20} />
          </div>
          <div className="form-grid">
            <Field label="Prénom">
              <input
                maxLength="40"
                value={profile.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </Field>
            <Field label="Âge">
              <input
                required
                type="number"
                min="16"
                max="100"
                value={profile.age}
                onChange={(e) => set("age", Number(e.target.value))}
              />
            </Field>
            <Field label="Taille (cm)">
              <input
                required
                type="number"
                min="100"
                max="250"
                value={profile.height}
                onChange={(e) => set("height", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Poids de référence du profil (kg)"
              hint="Pour le calcul des protéines. Les pesées quotidiennes se saisissent dans Poids."
            >
              <input
                required
                type="number"
                min="25"
                max="400"
                step="0.1"
                value={profile.weight}
                onChange={(e) => set("weight", Number(e.target.value))}
              />
            </Field>
            <Field label="Sexe">
              <select
                value={profile.sex}
                onChange={(e) => set("sex", e.target.value)}
              >
                <option value="unspecified">Non renseigné</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
              </select>
            </Field>
            <Field label="Objectif sportif">
              <select
                value={profile.goal}
                onChange={(e) => set("goal", e.target.value)}
              >
                <option value="gain">Prise de masse</option>
                <option value="maintain">Maintien</option>
                <option value="lose">Perte de poids</option>
              </select>
            </Field>
            <Field label="Poids cible (kg)">
              <input
                required
                type="number"
                min="25"
                max="400"
                step="0.1"
                value={profile.targetWeight}
                onChange={(e) => set("targetWeight", Number(e.target.value))}
              />
            </Field>
            <Field label="Fréquence souhaitée">
              <select
                value={profile.frequency}
                onChange={(e) => set("frequency", Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} séances / semaine
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date de départ">
              <input
                required
                type="date"
                value={profile.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </Field>
            <Field label="Date cible (facultative)">
              <input
                type="date"
                min={profile.startDate}
                value={profile.targetDate}
                onChange={(e) => set("targetDate", e.target.value)}
              />
            </Field>
          </div>
          <p className="small muted">
            La fréquence souhaitée ne déplace pas vos séances : ajustez votre
            planning dans{" "}
            <button
              type="button"
              className="text-link inline"
              onClick={() => navigate("program")}
            >
              Programme
            </button>
            .
          </p>
        </Card>
        <div className="grid-2">
          <Card>
            <h2>Affichage & séances</h2>
            <div className="page-stack">
              <Field label="Unité des charges et du poids">
                <select
                  value={profile.unit}
                  onChange={(e) => set("unit", e.target.value)}
                >
                  <option value="kg">Kilogrammes (kg)</option>
                  <option value="lb">Livres (lb)</option>
                </select>
              </Field>
              <Field label="Thème">
                <select
                  value={profile.theme}
                  onChange={(e) => set("theme", e.target.value)}
                >
                  <option value="dark">Sombre</option>
                  <option value="light">Clair</option>
                  <option value="system">Selon l’appareil</option>
                </select>
              </Field>
              <Field label="Repos par défaut (secondes)">
                <input
                  required
                  type="number"
                  min="5"
                  max="3600"
                  value={profile.restSeconds}
                  onChange={(e) => set("restSeconds", Number(e.target.value))}
                />
              </Field>
              <label className="toggle-row">
                <span>
                  <strong>Chronomètre automatique</strong>
                  <small>Après validation d’une série</small>
                </span>
                <input
                  className="switch"
                  type="checkbox"
                  checked={profile.autoTimer}
                  onChange={(e) => set("autoTimer", e.target.checked)}
                />
              </label>
            </div>
          </Card>
          <Card>
            <h2>Nutrition & suppléments</h2>
            <div className="page-stack">
              <Field label="Objectif protéines">
                <select
                  value={profile.proteinMode}
                  onChange={(e) => set("proteinMode", e.target.value)}
                >
                  <option value="estimate">
                    Estimation générale (
                    {estimateProtein(
                      profile.weight,
                      profile.goal,
                      profile.frequency,
                    )}{" "}
                    g)
                  </option>
                  <option value="manual">Mon objectif personnel</option>
                </select>
              </Field>
              {profile.proteinMode === "manual" && (
                <Field label="Protéines par jour (g)">
                  <input
                    required
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    value={profile.proteinTarget}
                    onChange={(e) =>
                      set("proteinTarget", Number(e.target.value))
                    }
                  />
                </Field>
              )}
              <div className="form-grid">
                <Field label="Protéines par shaker (g)">
                  <input
                    required
                    type="number"
                    min="0"
                    max="200"
                    step="0.1"
                    value={profile.wheyProtein}
                    onChange={(e) => set("wheyProtein", Number(e.target.value))}
                  />
                </Field>
                <Field label="Votre quantité de créatine (g)">
                  <input
                    required
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={profile.creatineDose}
                    onChange={(e) =>
                      set("creatineDose", Number(e.target.value))
                    }
                  />
                </Field>
              </div>
              {[
                ["trackProtein", "Suivre les protéines"],
                ["trackWhey", "Suivre la whey"],
                ["trackCreatine", "Suivre la créatine"],
              ].map(([key, label]) => (
                <label className="toggle-row" key={key}>
                  <span>{label}</span>
                  <input
                    className="switch"
                    type="checkbox"
                    checked={profile[key]}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                </label>
              ))}
              <p className="small muted">
                Estimation générale et non prescription médicale. Les quantités
                de suppléments restent toujours sous votre contrôle.
              </p>
              <div className="form-grid">
                <Field label="Objectif d’eau quotidien (ml)">
                  <input
                    required
                    type="number"
                    min="250"
                    max="10000"
                    step="250"
                    value={profile.waterGoal}
                    onChange={(e) => set("waterGoal", Number(e.target.value))}
                  />
                </Field>
                <Field label="Objectif de sommeil (heures)">
                  <input
                    required
                    type="number"
                    min="1"
                    max="16"
                    step="0.25"
                    value={profile.sleepGoal}
                    onChange={(e) => set("sleepGoal", Number(e.target.value))}
                  />
                </Field>
              </div>
              <Field label="Logique du streak">
                <select
                  value={profile.streakMode}
                  onChange={(e) => set("streakMode", e.target.value)}
                >
                  <option value="training">Séances prévues réalisées</option>
                  <option value="complete">
                    Journées complètes (protéines, eau, créatine et séance
                    prévue)
                  </option>
                </select>
              </Field>
            </div>
          </Card>
        </div>
        <div className="row end">
          <Button type="submit">
            <Icon name="check" size={17} />
            Enregistrer mes paramètres
          </Button>
        </div>
      </form>
      <Card id="notifications">
        <div className="section-heading">
          <div>
            <h2>Rappels & notifications</h2>
            <p className="small muted">
              Un petit coup de pouce, au bon moment.
            </p>
          </div>
          <Badge tone={permission === "granted" ? "accent" : "subtle"}>
            {permission === "granted"
              ? "Autorisées"
              : permission === "denied"
                ? "Bloquées dans le navigateur"
                : permission === "unsupported"
                  ? "Non compatibles"
                  : "À activer"}
          </Badge>
        </div>
        <div className="info-box">
          <Icon name="bell" />
          <div>
            <strong>
              Les rappels fonctionnent lorsque l’application est ouverte.
            </strong>
            <p>
              Le navigateur peut suspendre l’application en arrière-plan. Pour
              recevoir des alertes lorsqu’elle est fermée, importez votre
              planning dans le calendrier de votre téléphone. Sur iPhone,
              installez d’abord l’application depuis Safari pour les
              notifications compatibles.
            </p>
            <a
              href="https://developer.mozilla.org/fr/docs/Web/API/Notifications_API"
              target="_blank"
              rel="noreferrer"
              className="small text-link"
            >
              Compatibilité des notifications · MDN
              <Icon name="arrow-up-right" size={13} />
            </a>
          </div>
        </div>
        <div className="row wrap notification-actions">
          {permission === "default" && (
            <Button variant="secondary" onClick={allow}>
              <Icon name="bell" size={16} />
              Autoriser les notifications
            </Button>
          )}
          {permission === "granted" && (
            <Button
              variant="secondary"
              onClick={async () =>
                notify(
                  (await sendNotification(
                    "Momentum",
                    "Votre notification de test fonctionne.",
                  ))
                    ? "Notification de test envoyée."
                    : "Notification indisponible. Vérifiez les autorisations système.",
                  "info",
                )
              }
            >
              Tester une notification
            </Button>
          )}
          <Button variant="secondary" onClick={() => exportCalendar(state)}>
            <Icon name="calendar" size={17} />
            Exporter le planning (.ics)
          </Button>
        </div>
        <p className="small muted">
          Export des 90 prochains jours, incluant vos déplacements ponctuels,
          avec un rappel 15 minutes avant chaque séance. Réimportez après un
          changement de planning.
        </p>
        <div className="reminder-list">
          {[
            ["training", "Entraînement", "dumbbell"],
            ["creatine", "Créatine", "pill"],
            ["whey", "Whey", "glass"],
            ["water", "Hydratation", "glass"],
          ].map(([key, label, icon]) => {
            const r = state.reminders[key];
            return (
              <div key={key} className="reminder">
                <label className="toggle-row">
                  <span className="row">
                    <Icon name={icon} />
                    <strong>{label}</strong>
                  </span>
                  <input
                    className="switch"
                    aria-label={`Activer le rappel ${label}`}
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) =>
                      setReminder(key, { enabled: e.target.checked })
                    }
                  />
                </label>
                <div className="form-grid">
                  <Field label={`Heure du rappel ${label}`}>
                    <input
                      type="time"
                      required
                      value={r.time}
                      disabled={key === "whey" && r.afterTraining}
                      onChange={(e) => {
                        if (e.target.value)
                          setReminder(key, { time: e.target.value });
                      }}
                    />
                  </Field>
                  <Field label={`Type du rappel ${label}`}>
                    <select
                      value={r.type}
                      onChange={(e) =>
                        setReminder(key, { type: e.target.value })
                      }
                    >
                      <option value="inapp">Dans l’application</option>
                      <option value="system">Notification système</option>
                    </select>
                  </Field>
                </div>
                <div
                  className="weekday-buttons"
                  aria-label={`Jours du rappel ${label}`}
                >
                  {[
                    [1, "L"],
                    [2, "M"],
                    [3, "M"],
                    [4, "J"],
                    [5, "V"],
                    [6, "S"],
                    [0, "D"],
                  ].map(([day, name]) => (
                    <button
                      key={day}
                      aria-label={
                        [
                          "Dimanche",
                          "Lundi",
                          "Mardi",
                          "Mercredi",
                          "Jeudi",
                          "Vendredi",
                          "Samedi",
                        ][day]
                      }
                      aria-pressed={r.days.includes(day)}
                      className={r.days.includes(day) ? "active" : ""}
                      onClick={() =>
                        setReminder(key, {
                          days: r.days.includes(day)
                            ? r.days.filter((x) => x !== day)
                            : [...r.days, day],
                        })
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {key === "whey" && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(r.afterTraining)}
                      onChange={(e) =>
                        setReminder(key, { afterTraining: e.target.checked })
                      }
                    />
                    Après l’enregistrement d’une séance, plutôt qu’à heure fixe
                  </label>
                )}
                {key === "training" && (
                  <p className="small muted">
                    Le rappel suit les séances prévues. Un déplacement ponctuel
                    reste prioritaire sur ces jours.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <div className="section-heading">
          <h2>Mes données, chez moi</h2>
          <Icon name="shield" className="accent" />
        </div>
        <p className="muted">
          Vos données sont enregistrées dans ce navigateur. Exportez
          régulièrement une copie JSON pour les retrouver sur un autre appareil
          ou après un effacement du stockage.
        </p>
        <div className="row wrap">
          <Button
            onClick={() => {
              try {
                downloadFile(`momentum-${today()}.json`, exportData(state));
                notify("Votre sauvegarde est exportée.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            <Icon name="download" size={17} />
            Exporter mes données
          </Button>
          <Button variant="secondary" onClick={() => file.current.click()}>
            <Icon name="upload" size={17} />
            Importer mes données
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            onChange={importFile}
            hidden
          />
        </div>
        <div className="storage-info">
          <Icon name="check-circle" size={18} />
          <span>
            {saveStatus === "saved"
              ? "Données enregistrées sur cet appareil"
              : saveStatus === "saving"
                ? "Enregistrement en cours…"
                : "Échec de la sauvegarde locale : exportez une copie."}
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            const result = await requestPersistence();
            setPersistent(result);
            notify(
              result
                ? "Le navigateur a accordé un stockage persistant."
                : "Le navigateur n’a pas accordé de stockage persistant. Gardez une copie JSON.",
              "info",
            );
          }}
        >
          <Icon name="shield" size={16} />
          {persistent === true
            ? "Stockage persistant accordé"
            : "Protéger le stockage local"}
        </Button>
        <p className="small muted">
          Ce compte utilise un coffre local chiffré, sans outil d’analyse. Les
          pages, graphiques et données fonctionnent hors connexion après le
          premier chargement complet de la version installée.
        </p>
      </Card>
      <Card>
        <div className="section-heading">
          <div>
            <h2>Compte & profil</h2>
            <p className="small muted">{auth.user.email}</p>
          </div>
          <Icon name="shield" className="accent" />
        </div>
        <p className="muted">
          Modifiez votre pseudo, votre photo et consultez votre rank depuis
          votre espace personnel.
        </p>
        <div className="row wrap">
          <Button variant="secondary" onClick={() => navigate("profile")}>
            <Icon name="award" />
            Ouvrir mon profil
          </Button>
          <Button variant="danger" onClick={auth.logout}>
            Se déconnecter
          </Button>
        </div>
      </Card>
      <Card>
        <h2>Installer Momentum</h2>
        <div className="grid-2">
          <div>
            <h3>Sur iPhone / iPad</h3>
            <p className="muted">
              Ouvrez l’adresse de l’application dans Safari, puis Partager → Sur
              l’écran d’accueil.
            </p>
          </div>
          <div>
            <h3>Sur Android / ordinateur</h3>
            <p className="muted">
              Dans le menu de votre navigateur, choisissez Installer
              l’application ou Ajouter à l’écran d’accueil.
            </p>
          </div>
        </div>
        <p className="small muted">
          L’installation sur téléphone nécessite une adresse HTTPS. Le serveur
          de développement local convient aux tests sur cet ordinateur.
        </p>
      </Card>
      {incoming && (
        <Modal
          title="Importer cette sauvegarde ?"
          onClose={() => setIncoming(null)}
        >
          <div className="page-stack">
            <p>
              Cette copie contient{" "}
              <strong>
                {incoming.sessions.length} séances, {incoming.weights.length}{" "}
                pesées et {incoming.meals.length} aliments
              </strong>
              . Elle remplacera les données actuelles de cet appareil.
            </p>
            <p className="small muted">
              Une copie de vos données actuelles sera téléchargée avant le
              remplacement.
            </p>
            <div className="row end">
              <Button variant="secondary" onClick={() => setIncoming(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  try {
                    downloadFile(
                      `momentum-avant-import-${today()}.json`,
                      exportData(state),
                    );
                    update(incoming);
                    setProfile({ ...incoming.profile });
                    setIncoming(null);
                    notify("Sauvegarde importée. Vos données sont restaurées.");
                  } catch (e) {
                    notify(e.message, "error");
                  }
                }}
              >
                Remplacer mes données
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
