import { MUSCLES } from "./data.js";

const MAX_JSON_LENGTH = 12 * 1024 * 1024;
const ROOT_KEYS = [
  "schemaVersion",
  "onboardingComplete",
  "profile",
  "exercises",
  "programs",
  "schedule",
  "scheduleTime",
  "exceptions",
  "sessions",
  "weights",
  "meals",
  "supplements",
  "hydration",
  "sleep",
  "rankHistory",
  "goals",
  "reminders",
  "draft",
];
const fail = (path, message) => {
  throw new Error(`Données invalides (${path}) : ${message}.`);
};
const object = (value, path) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail(path, "objet attendu");
};
function shape(value, required, optional, path) {
  object(value, path);
  for (const key of required)
    if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "champ manquant");
  for (const key of Object.keys(value))
    if (![...required, ...optional].includes(key))
      fail(
        `${path}.${key}`,
        "champ inconnu, fichier peut-être issu d’une version plus récente",
      );
}
function array(value, path, limit = 10000) {
  if (!Array.isArray(value) || value.length > limit)
    fail(path, `liste attendue, maximum ${limit} éléments`);
}
function string(value, path, min = 0, max = 200) {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail(path, "texte invalide");
}
function number(value, path, min = 0, max = 1000000, integer = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail(
      path,
      `nombre ${integer ? "entier " : ""}attendu entre ${min} et ${max}`,
    );
}
function bool(value, path) {
  if (typeof value !== "boolean") fail(path, "booléen attendu");
}
function oneOf(value, choices, path) {
  if (!choices.includes(value)) fail(path, "valeur non reconnue");
}
function id(value, path) {
  string(value, path, 1, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) fail(path, "identifiant invalide");
}
function date(value, path, empty = false) {
  if (empty && value === "") return;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(path, "date attendue au format AAAA-MM-JJ");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2200 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    fail(path, "date inexistante ou hors limites");
}
function time(value, path) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail(path, "heure invalide");
}
function iso(value, path, empty = false) {
  if (empty && value === "") return;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(path, "horodatage ISO invalide");
  date(value.slice(0, 10), path);
  if (
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    Number(value.slice(17, 19)) > 59
  )
    fail(path, "horodatage ISO invalide");
}
function uniqueIds(items, path) {
  const ids = new Set();
  items.forEach((item, index) => {
    object(item, `${path}[${index}]`);
    id(item.id, `${path}[${index}].id`);
    if (ids.has(item.id)) fail(path, `identifiant en double : ${item.id}`);
    ids.add(item.id);
  });
  return ids;
}
function reference(value, ids, path, nullable = false) {
  if (nullable && value === null) return;
  id(value, path);
  if (!ids.has(value)) fail(path, "référence introuvable");
}
function dayList(value, path) {
  array(value, path, 7);
  value.forEach((day, index) => number(day, `${path}[${index}]`, 0, 6, true));
  if (new Set(value).size !== value.length) fail(path, "jours en double");
}
function ranges(value, path) {
  number(value.sets, `${path}.sets`, 1, 50, true);
  number(value.repsMin, `${path}.repsMin`, 1, 500, true);
  number(value.repsMax, `${path}.repsMax`, value.repsMin, 500, true);
  number(value.rest, `${path}.rest`, 0, 3600, true);
}

// Reject dangerous keys and accessor/prototype objects before inspecting or cloning.
function safeTree(value) {
  const seen = new WeakSet();
  let nodes = 0;
  const visit = (item, depth, path) => {
    nodes++;
    if (nodes > 500000 || depth > 20) fail(path, "fichier trop complexe");
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "string") {
      if (item.length > 100000) fail(path, "texte trop long");
      return;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item)) fail(path, "nombre non fini");
      return;
    }
    if (typeof item !== "object") fail(path, "type non sérialisable");
    if (seen.has(item)) fail(path, "référence circulaire");
    seen.add(item);
    if (Array.isArray(item)) {
      if (item.length > 100000) fail(path, "liste trop longue");
    } else object(item, path);
    for (const key of Reflect.ownKeys(item)) {
      if (
        typeof key !== "string" ||
        ["__proto__", "prototype", "constructor"].includes(key)
      )
        fail(path, "clé interdite");
      if (Array.isArray(item) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (descriptor.get || descriptor.set)
        fail(path, "propriété dynamique interdite");
      visit(descriptor.value, depth + 1, `${path}.${key}`);
    }
    seen.delete(item);
  };
  visit(value, 0, "fichier");
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_JSON_LENGTH)
    fail("fichier", "taille maximale de 12 Mo dépassée");
  return JSON.parse(serialized);
}

export function validateImport(value) {
  let state = safeTree(value);
  object(state, "fichier");
  if (Object.hasOwn(state, "app")) {
    shape(state, ["app", "version", "exportedAt", "data"], [], "export");
    if (state.app !== "momentum")
      fail("export.app", "ce fichier n’est pas un export Momentum");
    if (![1, 2].includes(state.version))
      fail("export.version", "version de fichier non prise en charge");
    iso(state.exportedAt, "export.exportedAt");
    state = state.data;
  }
  if (![1, 2].includes(state.schemaVersion))
    fail(
      "schemaVersion",
      "version non prise en charge, mettez à jour l’application",
    );
  // Migration non destructive des sauvegardes créées avant le suivi récupération.
  if (!Object.hasOwn(state, "hydration")) state.hydration = [];
  if (!Object.hasOwn(state, "sleep")) state.sleep = [];
  if (!Object.hasOwn(state, "rankHistory")) state.rankHistory = [];
  if (state.profile && !Object.hasOwn(state.profile, "waterGoal"))
    state.profile.waterGoal = 2500;
  if (state.profile && !Object.hasOwn(state.profile, "sleepGoal"))
    state.profile.sleepGoal = 8;
  if (state.profile && !Object.hasOwn(state.profile, "streakMode"))
    state.profile.streakMode = "training";
  if (state.reminders && !Object.hasOwn(state.reminders, "water"))
    state.reminders.water = {
      enabled: false,
      time: "16:00",
      days: [0, 1, 2, 3, 4, 5, 6],
      type: "inapp",
    };
  state.schemaVersion = 2;
  shape(state, ROOT_KEYS, [], "données");
  bool(state.onboardingComplete, "onboardingComplete");
  const profile = state.profile;
  shape(
    profile,
    [
      "firstName",
      "age",
      "height",
      "sex",
      "weight",
      "targetWeight",
      "goal",
      "frequency",
      "proteinTarget",
      "proteinMode",
      "trackProtein",
      "trackWhey",
      "trackCreatine",
      "creatineDose",
      "wheyProtein",
      "waterGoal",
      "sleepGoal",
      "streakMode",
      "unit",
      "theme",
      "startDate",
      "targetDate",
      "restSeconds",
      "autoTimer",
    ],
    [],
    "profil",
  );
  string(profile.firstName, "profil.firstName", 0, 80);
  number(profile.age, "profil.age", 10, 120, true);
  number(profile.height, "profil.height", 50, 260);
  number(profile.weight, "profil.weight", 20, 500);
  number(profile.targetWeight, "profil.targetWeight", 20, 500);
  number(profile.frequency, "profil.frequency", 0, 14, true);
  number(profile.proteinTarget, "profil.proteinTarget", 0, 1000);
  number(profile.creatineDose, "profil.creatineDose", 0, 50);
  number(profile.wheyProtein, "profil.wheyProtein", 0, 200);
  number(profile.waterGoal, "profil.waterGoal", 250, 10000, true);
  number(profile.sleepGoal, "profil.sleepGoal", 1, 16);
  number(profile.restSeconds, "profil.restSeconds", 1, 3600, true);
  oneOf(profile.sex, ["male", "female", "unspecified"], "profil.sex");
  oneOf(profile.goal, ["gain", "maintain", "lose"], "profil.goal");
  oneOf(profile.proteinMode, ["estimate", "manual"], "profil.proteinMode");
  oneOf(profile.unit, ["kg", "lb"], "profil.unit");
  oneOf(profile.theme, ["dark", "light", "system"], "profil.theme");
  oneOf(profile.streakMode, ["training", "complete"], "profil.streakMode");
  ["trackProtein", "trackWhey", "trackCreatine", "autoTimer"].forEach((key) =>
    bool(profile[key], `profil.${key}`),
  );
  date(profile.startDate, "profil.startDate");
  date(profile.targetDate, "profil.targetDate", true);
  if (profile.targetDate && profile.targetDate < profile.startDate)
    fail("profil.targetDate", "la date cible précède le départ");

  array(state.exercises, "exercices", 2000);
  const exerciseIds = uniqueIds(state.exercises, "exercices");
  state.exercises.forEach((item, index) => {
    const path = `exercices[${index}]`;
    shape(
      item,
      [
        "id",
        "name",
        "muscle",
        "secondary",
        "movement",
        "sets",
        "repsMin",
        "repsMax",
        "rest",
        "tips",
      ],
      ["custom"],
      path,
    );
    string(item.name, `${path}.name`, 1, 160);
    oneOf(item.muscle, MUSCLES, `${path}.muscle`);
    array(item.secondary, `${path}.secondary`, MUSCLES.length);
    item.secondary.forEach((muscle) =>
      oneOf(muscle, MUSCLES, `${path}.secondary`),
    );
    string(item.movement, `${path}.movement`, 1, 100);
    ranges(item, path);
    array(item.tips, `${path}.tips`, 20);
    item.tips.forEach((tip) => string(tip, `${path}.tips`, 0, 1000));
    if (Object.hasOwn(item, "custom")) bool(item.custom, `${path}.custom`);
  });
  array(state.programs, "programmes", 100);
  const programIds = uniqueIds(state.programs, "programmes");
  state.programs.forEach((program, index) => {
    const path = `programmes[${index}]`;
    shape(
      program,
      ["id", "name", "description", "color", "exercises"],
      [],
      path,
    );
    string(program.name, `${path}.name`, 1, 100);
    string(program.description, `${path}.description`, 0, 1000);
    if (
      typeof program.color !== "string" ||
      !/^#[a-fA-F\d]{6}$/.test(program.color)
    )
      fail(`${path}.color`, "couleur hexadécimale invalide");
    array(program.exercises, `${path}.exercises`, 100);
    program.exercises.forEach((entry, i) => {
      const entryPath = `${path}.exercises[${i}]`;
      shape(
        entry,
        ["exerciseId", "sets", "repsMin", "repsMax", "rest"],
        [],
        entryPath,
      );
      reference(entry.exerciseId, exerciseIds, `${entryPath}.exerciseId`);
      ranges(entry, entryPath);
    });
  });
  object(state.schedule, "planning");
  for (const [day, programId] of Object.entries(state.schedule)) {
    if (!/^[0-6]$/.test(day)) fail("planning", "jour invalide");
    reference(programId, programIds, `planning.${day}`, true);
  }
  time(state.scheduleTime, "scheduleTime");
  object(state.exceptions, "exceptions");
  if (Object.keys(state.exceptions).length > 10000)
    fail("exceptions", "trop de dates");
  for (const [day, programId] of Object.entries(state.exceptions)) {
    date(day, "exceptions.date");
    reference(programId, programIds, `exceptions.${day}`, true);
  }

  const validateSession = (session, path, draft = false) => {
    shape(
      session,
      [
        "id",
        "programId",
        "name",
        "date",
        "startedAt",
        "endedAt",
        "duration",
        "note",
        "exercises",
      ],
      draft ? ["currentIndex", "focused", "timerEnd"] : [],
      path,
    );
    id(session.id, `${path}.id`);
    reference(session.programId, programIds, `${path}.programId`, true);
    string(session.name, `${path}.name`, 1, 100);
    date(session.date, `${path}.date`);
    iso(session.startedAt, `${path}.startedAt`);
    iso(session.endedAt, `${path}.endedAt`, draft);
    if (
      session.endedAt &&
      Date.parse(session.endedAt) < Date.parse(session.startedAt)
    )
      fail(path, "fin antérieure au début");
    number(session.duration, `${path}.duration`, 0, 31622400);
    string(session.note, `${path}.note`, 0, 5000);
    array(session.exercises, `${path}.exercises`, 100);
    session.exercises.forEach((entry, index) => {
      const entryPath = `${path}.exercises[${index}]`;
      shape(entry, ["exerciseId", "sets"], ["rest"], entryPath);
      reference(entry.exerciseId, exerciseIds, `${entryPath}.exerciseId`);
      if (Object.hasOwn(entry, "rest"))
        number(entry.rest, `${entryPath}.rest`, 0, 3600, true);
      array(entry.sets, `${entryPath}.sets`, 100);
      entry.sets.forEach((set, i) => {
        const setPath = `${entryPath}.sets[${i}]`;
        shape(set, ["weight", "reps", "done"], [], setPath);
        number(set.weight, `${setPath}.weight`, 0, 2000);
        number(set.reps, `${setPath}.reps`, 0, 1000, true);
        bool(set.done, `${setPath}.done`);
        if (set.done && set.reps < 1)
          fail(setPath, "une série validée doit contenir une répétition");
      });
    });
    if (
      !draft &&
      !session.exercises.some((entry) => entry.sets.some((set) => set.done))
    )
      fail(path, "une séance enregistrée doit contenir une série validée");
    if (draft) {
      if (Object.hasOwn(session, "currentIndex"))
        number(
          session.currentIndex,
          `${path}.currentIndex`,
          0,
          Math.max(0, session.exercises.length - 1),
          true,
        );
      if (Object.hasOwn(session, "focused"))
        bool(session.focused, `${path}.focused`);
      if (Object.hasOwn(session, "timerEnd") && session.timerEnd !== null)
        number(session.timerEnd, `${path}.timerEnd`, 0, 7289654400000, true);
    }
  };
  array(state.sessions, "séances", 20000);
  const sessionIds = uniqueIds(state.sessions, "séances");
  state.sessions.forEach((session, index) =>
    validateSession(session, `séances[${index}]`),
  );
  if (state.draft !== null) {
    validateSession(state.draft, "brouillon", true);
    if (sessionIds.has(state.draft.id))
      fail("brouillon.id", "séance déjà enregistrée");
  }

  array(state.weights, "poids", 30000);
  uniqueIds(state.weights, "poids");
  state.weights.forEach((entry, index) => {
    const path = `poids[${index}]`;
    shape(entry, ["id", "date", "weight", "note"], [], path);
    date(entry.date, `${path}.date`);
    number(entry.weight, `${path}.weight`, 20, 500);
    string(entry.note, `${path}.note`, 0, 2000);
  });
  array(state.meals, "repas", 100000);
  uniqueIds(state.meals, "repas");
  const wheyDates = new Set();
  state.meals.forEach((entry, index) => {
    const path = `repas[${index}]`;
    shape(
      entry,
      ["id", "date", "name", "quantity", "protein"],
      ["source"],
      path,
    );
    date(entry.date, `${path}.date`);
    string(entry.name, `${path}.name`, 1, 160);
    string(entry.quantity, `${path}.quantity`, 0, 100);
    number(entry.protein, `${path}.protein`, 0, 600);
    if (Object.hasOwn(entry, "source")) {
      oneOf(entry.source, ["whey"], `${path}.source`);
      if (wheyDates.has(entry.date))
        fail(path, "plusieurs shakers automatiques pour la même date");
      wheyDates.add(entry.date);
    }
  });
  object(state.supplements, "compléments");
  if (Object.keys(state.supplements).length > 30000)
    fail("compléments", "trop de dates");
  for (const [day, entry] of Object.entries(state.supplements)) {
    const path = `compléments.${day}`;
    date(day, path);
    shape(entry, ["creatine", "whey"], ["creatineDose"], path);
    bool(entry.creatine, `${path}.creatine`);
    bool(entry.whey, `${path}.whey`);
    if (Object.hasOwn(entry, "creatineDose"))
      number(entry.creatineDose, `${path}.creatineDose`, 0, 50);
  }
  for (const day of wheyDates)
    if (state.supplements[day]?.whey !== true)
      fail(`repas.${day}`, "shaker automatique sans suivi whey correspondant");
  array(state.hydration, "hydratation", 50000);
  uniqueIds(state.hydration, "hydratation");
  state.hydration.forEach((entry, index) => {
    const path = `hydratation[${index}]`;
    shape(entry, ["id", "date", "amount", "createdAt"], [], path);
    date(entry.date, `${path}.date`);
    number(entry.amount, `${path}.amount`, 1, 10000, true);
    iso(entry.createdAt, `${path}.createdAt`);
  });
  array(state.sleep, "sommeil", 20000);
  uniqueIds(state.sleep, "sommeil");
  state.sleep.forEach((entry, index) => {
    const path = `sommeil[${index}]`;
    shape(entry, ["id", "date", "hours", "quality", "note"], [], path);
    date(entry.date, `${path}.date`);
    number(entry.hours, `${path}.hours`, 0, 24);
    oneOf(entry.quality, ["bad", "average", "good"], `${path}.quality`);
    string(entry.note, `${path}.note`, 0, 500);
  });
  array(state.rankHistory, "rangs", 1000);
  state.rankHistory.forEach((entry, index) => {
    const path = `rangs[${index}]`;
    shape(entry, ["rank", "date"], [], path);
    string(entry.rank, `${path}.rank`, 1, 30);
    date(entry.date, `${path}.date`);
  });
  array(state.goals, "objectifs", 1000);
  uniqueIds(state.goals, "objectifs");
  state.goals.forEach((entry, index) => {
    const path = `objectifs[${index}]`;
    shape(
      entry,
      ["id", "title", "target", "current", "unit", "done"],
      [],
      path,
    );
    string(entry.title, `${path}.title`, 1, 160);
    number(entry.target, `${path}.target`);
    number(entry.current, `${path}.current`);
    string(entry.unit, `${path}.unit`, 0, 30);
    bool(entry.done, `${path}.done`);
  });
  shape(
    state.reminders,
    ["creatine", "whey", "training", "water"],
    [],
    "rappels",
  );
  for (const [key, reminder] of Object.entries(state.reminders)) {
    const path = `rappels.${key}`;
    shape(
      reminder,
      ["enabled", "time", "days", "type"],
      key === "whey" ? ["afterTraining"] : [],
      path,
    );
    bool(reminder.enabled, `${path}.enabled`);
    time(reminder.time, `${path}.time`);
    dayList(reminder.days, `${path}.days`);
    oneOf(reminder.type, ["inapp", "system"], `${path}.type`);
    if (Object.hasOwn(reminder, "afterTraining"))
      bool(reminder.afterTraining, `${path}.afterTraining`);
  }
  return state;
}

let databasePromise;
function openDatabase() {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error(
        "Le stockage IndexedDB est indisponible. Vos données ne peuvent pas être sauvegardées dans ce navigateur.",
      ),
    );
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    let request;
    let blocked = false;
    try {
      request = indexedDB.open("momentum-personal", 1);
    } catch (error) {
      reject(
        new Error(`Impossible d’ouvrir le stockage local : ${error.message}`),
      );
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state"))
        request.result.createObjectStore("state");
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      database.onclose = () => {
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(
        new Error(
          `Impossible d’ouvrir le stockage local : ${request.error?.message ?? "erreur inconnue"}`,
        ),
      );
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          "Stockage bloqué par un autre onglet. Fermez les autres onglets Momentum puis réessayez.",
        ),
      );
    };
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function loadState() {
  const database = await openDatabase();
  const stored = await new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction("state", "readonly");
    } catch (error) {
      reject(new Error(`Lecture du stockage impossible : ${error.message}`));
      return;
    }
    const request = transaction.objectStore("state").get("current");
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () =>
      reject(
        new Error(
          `Lecture du stockage impossible : ${transaction.error?.message ?? request.error?.message ?? "erreur inconnue"}`,
        ),
      );
    transaction.onabort = () =>
      reject(new Error("La lecture des données locales a été interrompue."));
  });
  if (stored === undefined) return null;
  try {
    return validateImport(stored);
  } catch (error) {
    throw new Error(
      `Les données locales n’ont pas pu être chargées. Elles ont été conservées. ${error.message}`,
    );
  }
}

export async function saveState(state) {
  const normalized = validateImport(state);
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction("state", "readwrite");
      transaction.objectStore("state").put(normalized, "current");
    } catch (error) {
      reject(new Error(`Sauvegarde locale impossible : ${error.message}`));
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        new Error(
          `Sauvegarde locale impossible : ${transaction.error?.message ?? "vérifiez l’espace de stockage disponible"}`,
        ),
      );
    transaction.onabort = () =>
      reject(
        new Error(
          "La sauvegarde locale a été interrompue. Les dernières modifications ne sont pas enregistrées.",
        ),
      );
  });
}

export function exportData(state) {
  const data = validateImport(state);
  return JSON.stringify(
    { app: "momentum", version: 2, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

export async function requestPersistence() {
  if (!globalThis.navigator?.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
