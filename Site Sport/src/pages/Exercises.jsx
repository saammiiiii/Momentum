import React, { useState } from "react";
import { useApp } from "../context";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Icon,
  LineChart,
  Modal,
  PageHeader,
  StatCard,
} from "../components";
import { MUSCLES } from "../data";

const primaryVisuals = new Set([
  "incline-press",
  "shoulder-press",
  "triceps-extension",
  "high-cable-fly",
  "lateral-raise",
  "lat-pulldown",
  "preacher-curl",
  "seated-row",
  "incline-hammer-curl",
  "barbell-row",
  "half-squat",
  "leg-extension",
  "leg-curl",
  "leg-press",
]);
function ExerciseVisual({ exercise, large = false }) {
  if (!exercise) return null;
  const fallback =
    exercise.muscle === "Dos"
      ? "lat-pulldown"
      : exercise.muscle === "Biceps"
        ? "preacher-curl"
        : exercise.muscle === "Épaules"
          ? "shoulder-press"
          : exercise.muscle === "Quadriceps" ||
              exercise.muscle === "Ischio-jambiers" ||
              exercise.muscle === "Fessiers" ||
              exercise.muscle === "Mollets"
            ? "half-squat"
            : "incline-press";
  const id = primaryVisuals.has(exercise.id) ? exercise.id : fallback;
  return (
    <div className={`exercise-visual ${large ? "large" : ""}`}>
      <img
        src={`./exercises/${id}.webp`}
        alt={`Illustration : ${exercise.name}`}
        loading="lazy"
      />
      <span>{exercise.movement}</span>
    </div>
  );
}
import {
  exerciseHistory,
  exerciseRecords,
  fmt,
  formatDate,
  toDisplayWeight,
} from "../calculations";

const normal = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const blankExercise = {
  name: "",
  muscle: "Pectoraux",
  secondary: "",
  movement: "Poussée",
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  rest: 90,
  tips: "",
};

export default function Exercises() {
  const { state, update, notify, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("Tous");
  const [movement, setMovement] = useState("Tous");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankExercise);
  const [chartType, setChartType] = useState("weight");
  const programExercises = new Set(
    state.programs.flatMap((program) =>
      program.exercises.map((entry) => entry.exerciseId),
    ),
  );
  const movements = [
    ...new Set(state.exercises.map((exercise) => exercise.movement)),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const exercises = state.exercises
    .filter(
      (exercise) =>
        (muscle === "Tous" || exercise.muscle === muscle) &&
        (movement === "Tous" || exercise.movement === movement) &&
        normal(
          `${exercise.name} ${exercise.muscle} ${exercise.movement}`,
        ).includes(normal(query)),
    )
    .sort(
      (a, b) =>
        Number(programExercises.has(b.id)) -
          Number(programExercises.has(a.id)) ||
        a.name.localeCompare(b.name, "fr"),
    );
  const exercise = state.exercises.find((item) => item.id === selected);
  const history = exercise ? exerciseHistory(state, exercise.id) : [];
  const records = exercise ? exerciseRecords(state, exercise.id) : null;
  const unit = state.profile.unit;
  const weight = (value) => fmt(toDisplayWeight(value, unit));
  const setField = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  function createExercise(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.movement.trim()) return;
    if (Number(form.repsMin) > Number(form.repsMax))
      return notify(
        "Le minimum de répétitions doit être inférieur ou égal au maximum.",
        "error",
      );
    const secondary = [
      ...new Set(
        form.secondary
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].map((value) => MUSCLES.find((item) => normal(item) === normal(value)));
    if (secondary.some((value) => !value) || secondary.length > 10)
      return notify(
        "Utilisez les noms des catégories pour les muscles secondaires, par exemple : Épaules, Triceps.",
        "error",
      );
    const tips = form.tips
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    if (tips.length > 20 || tips.some((value) => value.length > 1000))
      return notify(
        "Limitez vos conseils à 20 lignes de 1 000 caractères maximum.",
        "error",
      );
    const id = crypto.randomUUID();
    const item = {
      id,
      name: form.name.trim(),
      muscle: form.muscle,
      secondary,
      movement: form.movement.trim(),
      sets: Number(form.sets),
      repsMin: Number(form.repsMin),
      repsMax: Number(form.repsMax),
      rest: Number(form.rest),
      tips,
      custom: true,
    };
    update((previous) => ({
      ...previous,
      exercises: [...previous.exercises, item],
    }));
    setForm(blankExercise);
    setCreating(false);
    setSelected(id);
    notify(
      "Exercice ajouté à votre bibliothèque. Vous pouvez l’intégrer à vos séances dans Programme.",
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="LA BIBLIOTHÈQUE"
        title="Exercices"
        description="Votre technique, vos repères, votre historique."
      >
        <Button onClick={() => setCreating(true)}>
          <Icon name="plus" /> Créer un exercice
        </Button>
      </PageHeader>
      <Card>
        <div className="form-grid">
          <Field label="Rechercher">
            <div className="search-input">
              <Icon name="search" />
              <input
                type="search"
                value={query}
                placeholder="Nom, muscle ou mouvement…"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Type de mouvement">
            <select
              value={movement}
              onChange={(event) => setMovement(event.target.value)}
            >
              <option value="Tous">Tous les mouvements</option>
              {movements.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="chips muscle-filters">
          {["Tous", ...MUSCLES].map((value) => (
            <button
              type="button"
              aria-pressed={muscle === value}
              className={`chip ${muscle === value ? "active" : ""}`}
              key={value}
              onClick={() => setMuscle(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </Card>
      <div className="row between">
        <p className="muted small">
          {exercises.length} exercice{exercises.length > 1 ? "s" : ""}
        </p>
        <span className="small muted">
          Vos exercices du programme en premier
        </span>
      </div>
      {exercises.length ? (
        <div className="grid-3 exercise-grid">
          {exercises.map((item) => {
            const record = exerciseRecords(state, item.id);
            const tracked = exerciseHistory(state, item.id).length > 0;
            return (
              <button
                type="button"
                className="exercise-tile card"
                key={item.id}
                onClick={() => {
                  setSelected(item.id);
                  setChartType("weight");
                }}
              >
                <ExerciseVisual exercise={item} />
                <div className="row between">
                  <span className="exercise-symbol">
                    <Icon name="dumbbell" size={25} />
                  </span>
                  {programExercises.has(item.id) ? (
                    <Badge>Mon programme</Badge>
                  ) : item.custom ? (
                    <Badge tone="muted">Personnel</Badge>
                  ) : null}
                </div>
                <h3>{item.name}</h3>
                <p className="muted small">
                  {item.muscle} · {item.movement}
                </p>
                <div className="row between">
                  <span className="small">
                    {tracked
                      ? `Meilleure charge · ${weight(record.weight)} ${unit}`
                      : `${item.sets} séries · ${item.repsMin}–${item.repsMax} rép.`}
                  </span>
                  <Icon name="arrow-up-right" size={18} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          icon="search"
          title="Aucun exercice trouvé"
          description="Essayez un autre nom ou changez les filtres."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setMuscle("Tous");
                setMovement("Tous");
              }}
            >
              Effacer les filtres
            </Button>
          }
        />
      )}
      {exercise && (
        <Modal wide title={exercise.name} onClose={() => setSelected(null)}>
          <div className="page-stack">
            <ExerciseVisual exercise={exercise} large />
            <div className="row">
              <Badge>{exercise.muscle}</Badge>
              <Badge tone="muted">{exercise.movement}</Badge>
              {programExercises.has(exercise.id) && (
                <Badge>Dans votre programme</Badge>
              )}
            </div>
            {exercise.secondary.length > 0 && (
              <p className="muted small">
                Muscles secondaires : {exercise.secondary.join(", ")}
              </p>
            )}
            <div className="grid-3">
              <StatCard
                label="Séries indicatives"
                value={exercise.sets}
                icon="layers"
              />
              <StatCard
                label="Répétitions"
                value={`${exercise.repsMin}–${exercise.repsMax}`}
                icon="repeat"
              />
              <StatCard
                label="Repos"
                value={exercise.rest}
                unit="s"
                icon="timer"
              />
            </div>
            <p className="small muted">
              Ces repères peuvent être personnalisés pour chaque séance dans
              Programme.
            </p>
            <Card>
              <h3>Les repères techniques</h3>
              {exercise.tips.length ? (
                <ul className="tips-list">
                  {exercise.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  Aucun conseil renseigné pour cet exercice personnel.
                </p>
              )}
            </Card>
            <div>
              <div className="row between">
                <h3>Votre progression</h3>
                <select
                  aria-label="Mesure du graphique"
                  value={chartType}
                  onChange={(event) => setChartType(event.target.value)}
                >
                  <option value="weight">Meilleure charge</option>
                  <option value="volume">Volume par séance</option>
                  <option value="reps">Répétitions à la charge max.</option>
                </select>
              </div>
              {history.length ? (
                <>
                  <div className="grid-3">
                    <StatCard
                      label="Meilleure charge"
                      value={weight(records.weight)}
                      unit={unit}
                      icon="trophy"
                    />
                    <StatCard
                      label="Meilleures répétitions"
                      value={records.reps}
                      icon="repeat"
                    />
                    <StatCard
                      label="Meilleur volume / séance"
                      value={weight(records.volume)}
                      unit={unit}
                      icon="bar-chart-3"
                    />
                  </div>
                  <LineChart
                    data={history.map((entry) => ({
                      label: formatDate(entry.date),
                      value:
                        chartType === "reps"
                          ? entry.reps
                          : toDisplayWeight(entry[chartType], unit),
                    }))}
                    unit={chartType === "reps" ? "rép." : unit}
                  />
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Meilleure série</th>
                          <th>Séries</th>
                          <th>Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...history].reverse().map((entry, index) => (
                          <tr key={`${entry.sessionId}-${index}`}>
                            <td>
                              {formatDate(entry.date, { year: "numeric" })}
                            </td>
                            <td>
                              {weight(entry.weight)} {unit} × {entry.reps}
                            </td>
                            <td>{entry.sets}</td>
                            <td>
                              {weight(entry.volume)} {unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelected(null);
                      navigate("history");
                    }}
                  >
                    Voir les séries complètes dans l’historique{" "}
                    <Icon name="arrow-right" />
                  </Button>
                </>
              ) : (
                <Empty
                  icon="chart-line"
                  title="L’histoire commence à la première série"
                  description="Vos performances, records et courbes apparaîtront après une séance enregistrée."
                />
              )}
            </div>
          </div>
        </Modal>
      )}
      {creating && (
        <Modal
          title="Créer un exercice"
          onClose={() => setCreating(false)}
          wide
        >
          <form className="page-stack" onSubmit={createExercise}>
            <Field label="Nom de l’exercice">
              <input
                required
                autoFocus
                maxLength="120"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </Field>
            <div className="grid-2">
              <Field label="Muscle principal">
                <select
                  value={form.muscle}
                  onChange={(event) => setField("muscle", event.target.value)}
                >
                  {MUSCLES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mouvement">
                <input
                  required
                  list="movement-options"
                  maxLength="80"
                  value={form.movement}
                  onChange={(event) => setField("movement", event.target.value)}
                />
                <datalist id="movement-options">
                  {movements.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field
              label="Muscles secondaires"
              hint="Séparez les noms par une virgule."
            >
              <input
                maxLength="300"
                value={form.secondary}
                onChange={(event) => setField("secondary", event.target.value)}
                placeholder="Épaules, Triceps"
              />
            </Field>
            <div className="grid-4">
              <Field label="Séries">
                <input
                  required
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={form.sets}
                  onChange={(event) => setField("sets", event.target.value)}
                />
              </Field>
              <Field label="Rép. min">
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.repsMin}
                  onChange={(event) => setField("repsMin", event.target.value)}
                />
              </Field>
              <Field label="Rép. max">
                <input
                  required
                  type="number"
                  min={form.repsMin}
                  max="100"
                  step="1"
                  value={form.repsMax}
                  onChange={(event) => setField("repsMax", event.target.value)}
                />
              </Field>
              <Field label="Repos (s)">
                <input
                  required
                  type="number"
                  min="15"
                  max="900"
                  step="1"
                  value={form.rest}
                  onChange={(event) => setField("rest", event.target.value)}
                />
              </Field>
            </div>
            <Field label="Vos repères techniques" hint="Un conseil par ligne.">
              <textarea
                rows="3"
                maxLength="2000"
                value={form.tips}
                onChange={(event) => setField("tips", event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              disabled={!form.name.trim() || !form.movement.trim()}
            >
              Enregistrer l’exercice
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
