import { DEFAULT_EXERCISES } from "./data.js";

const equipmentGroups = {
  "Haltères et banc": ["incline-press", "incline-hammer-curl", "flat-dumbbell-press", "incline-curl", "concentration-curl", "one-arm-row", "bulgarian-squat", "chest-supported-row", "arnold-press", "overhead-triceps-extension"],
  "Haltères": ["lateral-raise", "hammer-curl", "rear-delt-fly", "goblet-squat", "walking-lunge"],
  "Poulie": ["triceps-extension", "high-cable-fly", "lat-pulldown", "seated-row", "cable-curl", "single-arm-triceps", "rope-pushdown", "straight-arm-pulldown", "face-pull", "cable-kickback", "cable-crunch"],
  "Barre EZ": ["ez-curl", "preacher-curl", "skull-crusher"],
  "Barre et rack": ["barbell-row", "half-squat", "romanian-deadlift", "bench-press"],
  "Barre et banc": ["hip-thrust"],
  "Machine": ["shoulder-press", "leg-extension", "leg-curl", "leg-press", "assisted-dips", "pec-deck", "seated-leg-curl", "hip-abduction", "standing-calf", "seated-calf"],
  "Barre de traction": ["pull-up", "hanging-knee-raise"],
  "Poids du corps / tapis": ["push-ups", "reverse-crunch", "plank", "side-plank"],
};
const shortNames = { "incline-press": "Développé incliné", "high-cable-fly": "Écarté poulie haute", "overhead-triceps-extension": "Extension au-dessus de la tête", "single-arm-triceps": "Extension unilatérale", "chest-supported-row": "Rowing sur banc", "flat-dumbbell-press": "Couché haltères" };
export const EXERCISE_CATALOG = Object.fromEntries(DEFAULT_EXERCISES.map((exercise) => [exercise.id, {
  ...exercise,
  shortName: shortNames[exercise.id] || exercise.name,
  equipment: Object.entries(equipmentGroups).find(([, ids]) => ids.includes(exercise.id))?.[0] || "À préciser",
  category: exercise.movement === "Gainage" ? "Gainage" : ["Poussée", "Tirage", "Squat", "Fente", "Charnière de hanche"].includes(exercise.movement) ? "Polyarticulaire" : "Isolation",
  illustration: `./exercises/${exercise.id}.webp`,
  description: exercise.movement === "Gainage" ? "Maintien du tronc en position stable. Une répétition correspond à une tenue." : `${exercise.name} : travail des ${exercise.muscle.toLocaleLowerCase("fr-FR")} avec un mouvement contrôlé.`,
  repetitionRange: [exercise.repsMin, exercise.repsMax],
}]));
export function exerciseMetadata(exercise) {
  return EXERCISE_CATALOG[exercise.id] || { ...exercise, shortName: exercise.name, equipment: "Personnel", category: "Personnel", illustration: "", description: "Exercice personnel.", repetitionRange: [exercise.repsMin, exercise.repsMax] };
}
export function extendExerciseLibrary(state) {
  const ids = new Set(state.exercises.map((exercise) => exercise.id));
  const missing = DEFAULT_EXERCISES.filter((exercise) => !ids.has(exercise.id));
  return missing.length ? { ...state, exercises: [...state.exercises, ...structuredClone(missing)] } : state;
}
