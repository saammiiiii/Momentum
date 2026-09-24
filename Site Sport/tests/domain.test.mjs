import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, DEFAULT_PROGRAMS, MUSCLES } from "../src/data.js";
import {
  dateKey,
  addDays,
  weekStart,
  setVolume,
  exerciseVolume,
  sessionVolume,
  dailyProtein,
  proteinRemaining,
  dailyWater,
  waterRemaining,
  averageSleep,
  sleepForDate,
  readiness,
  trainingStreak,
  rankStatus,
  estimateProtein,
  plannedProgram,
  weeklyStats,
  weeklyExerciseComparison,
  weeklyWeightComparison,
  exerciseHistory,
  exerciseRecords,
  weightSeries,
  weightChange,
  goalProgress,
  streak,
  percentageChange,
  toDisplayWeight,
  fromDisplayWeight,
  supplementStats,
} from "../src/calculations.js";
import {
  validateImport,
  exportData,
  loadState,
  saveState,
} from "../src/storage.js";

const makeSet = (weight, reps, done = true) => ({ weight, reps, done });
function session(id, date, sets, duration = 3600) {
  return {
    id,
    date,
    programId: "push",
    name: "PUSH",
    startedAt: `${date}T16:00:00.000Z`,
    endedAt: `${date}T17:00:00.000Z`,
    duration,
    note: "",
    exercises: [{ exerciseId: "incline-press", sets }],
  };
}
function fixture() {
  const state = createInitialState();
  state.sessions = [
    session("first", "2026-09-14", [makeSet(25, 10), makeSet(25, 8)]),
    session(
      "second",
      "2026-09-21",
      [makeSet(30, 10), makeSet(27.5, 12), makeSet(500, 99, false)],
      3000,
    ),
    session("third", "2026-09-23", [makeSet(30, 11), makeSet(10, 20)], 2400),
  ];
  state.meals = [
    {
      id: "chicken",
      date: "2026-09-21",
      name: "Poulet",
      quantity: "150 g",
      protein: 35,
    },
    {
      id: "skyr",
      date: "2026-09-21",
      name: "Skyr",
      quantity: "200 g",
      protein: 20,
    },
  ];
  state.profile.proteinTarget = 50;
  state.supplements = {
    "2026-09-21": { creatine: true, whey: false },
    "2026-09-22": { creatine: true, whey: false },
  };
  return state;
}

test("default program keeps every requested exercise and default days, with no fabricated history", () => {
  const state = createInitialState();
  assert.deepEqual(state.schedule, {
    1: "push",
    3: "pull",
    5: "legs",
    6: "push2",
  });
  assert.deepEqual(
    DEFAULT_PROGRAMS[0].exercises.map((item) => item.exerciseId),
    [
      "incline-press",
      "shoulder-press",
      "triceps-extension",
      "high-cable-fly",
      "lateral-raise",
    ],
  );
  assert.deepEqual(
    DEFAULT_PROGRAMS[1].exercises.map((item) => item.exerciseId),
    [
      "lat-pulldown",
      "preacher-curl",
      "seated-row",
      "incline-hammer-curl",
      "barbell-row",
    ],
  );
  assert.deepEqual(
    DEFAULT_PROGRAMS[2].exercises.map((item) => item.exerciseId),
    ["half-squat", "leg-extension", "leg-curl", "leg-press"],
  );
  assert.ok(state.exercises.length >= 40);
  assert.ok(
    MUSCLES.every((muscle) =>
      state.exercises.some((item) => item.muscle === muscle),
    ),
  );
  assert.equal(
    state.sessions.length + state.weights.length + state.meals.length,
    0,
  );
  state.programs[0].name = "Changed";
  assert.equal(createInitialState().programs[0].name, "PUSH");
});

test("local calendar arithmetic handles week/year boundaries and leap dates", () => {
  assert.equal(dateKey(new Date(2026, 8, 24, 23, 59)), "2026-09-24");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  assert.equal(weekStart("2026-01-01"), "2025-12-29");
  assert.equal(weekStart("2026-09-27"), "2026-09-21");
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
});

test("volume adds varying sets and never counts unfinished sets", () => {
  const entry = {
    sets: [
      makeSet(30, 10),
      makeSet(30, 9),
      makeSet(27.5, 11),
      makeSet(500, 99, false),
    ],
  };
  assert.equal(setVolume(makeSet(30, 10)), 300);
  assert.equal(setVolume(makeSet(30, 10, false)), 0);
  assert.equal(exerciseVolume(entry), 872.5);
  assert.equal(
    sessionVolume({ exercises: [entry, { sets: [makeSet(15, 10)] }] }),
    1022.5,
  );
  assert.equal(setVolume(makeSet(0, 12)), 0);
});

test("hydration, sleep and readiness use only user-entered data", () => {
  const state = createInitialState();
  state.hydration = [
    {
      id: "water-1",
      date: "2026-09-24",
      amount: 500,
      createdAt: "2026-09-24T08:00:00.000Z",
    },
    {
      id: "water-2",
      date: "2026-09-24",
      amount: 750,
      createdAt: "2026-09-24T12:00:00.000Z",
    },
  ];
  state.sleep = [
    {
      id: "sleep-1",
      date: "2026-09-23",
      hours: 7.5,
      quality: "good",
      note: "",
    },
    {
      id: "sleep-2",
      date: "2026-09-24",
      hours: 6.5,
      quality: "average",
      note: "",
    },
  ];
  state.meals = [
    {
      id: "meal-1",
      date: "2026-09-24",
      name: "Repas",
      quantity: "1",
      protein: 65,
    },
  ];
  assert.equal(dailyWater(state, "2026-09-24"), 1250);
  assert.equal(waterRemaining(state, "2026-09-24"), 1250);
  assert.equal(averageSleep(state, 7, "2026-09-24"), 7);
  assert.equal(sleepForDate(state, "2026-09-22"), null);
  const status = readiness(state, "2026-09-24");
  assert.ok(status.parts.some((part) => part.key === "water"));
  assert.ok(status.parts.some((part) => part.key === "sleep"));
  assert.ok(status.score >= 0 && status.score <= 100);
});

test("training streak counts planned sessions fairly and rank never fabricates sessions", () => {
  const state = createInitialState();
  state.sessions = [
    session("monday", "2026-09-21", [makeSet(30, 10)]),
    {
      ...session("wednesday", "2026-09-23", [makeSet(30, 10)]),
      programId: "pull",
      name: "PULL",
    },
  ];
  const result = trainingStreak(state, "2026-09-24");
  assert.equal(result.current, 2);
  assert.equal(result.best, 2);
  assert.equal(result.total, 2);
  assert.equal(result.seven.done, 2);
  const rank = rankStatus(state, "2026-09-24");
  assert.equal(rank.streak.total, 2);
  assert.ok(rank.score >= 2);
});

test("complete-day streak requires the enabled daily objectives", () => {
  const state = createInitialState();
  state.profile.streakMode = "complete";
  state.profile.proteinTarget = 100;
  state.profile.waterGoal = 2000;
  state.schedule = {};
  for (const date of ["2026-09-22", "2026-09-23"]) {
    state.meals.push({
      id: `meal-${date}`,
      date,
      name: "Journée",
      quantity: "1",
      protein: 100,
    });
    state.hydration.push({
      id: `water-${date}`,
      date,
      amount: 2000,
      createdAt: `${date}T12:00:00.000Z`,
    });
    state.supplements[date] = { creatine: true, whey: false, creatineDose: 3 };
  }
  const streakResult = trainingStreak(state, "2026-09-24");
  assert.equal(streakResult.current, 2);
  assert.equal(streakResult.mode, "complete");
  state.hydration = state.hydration.filter(
    (entry) => entry.date !== "2026-09-23",
  );
  assert.equal(trainingStreak(state, "2026-09-24").current, 0);
});

test("weekly totals, planned exceptions and primary-muscle allocation remain consistent", () => {
  const state = fixture();
  state.exceptions["2026-09-21"] = null;
  state.exceptions["2026-09-22"] = "push";
  assert.equal(plannedProgram(state, "2026-09-21"), null);
  assert.equal(plannedProgram(state, "2026-09-22").id, "push");
  assert.equal(plannedProgram(state, "2026-09-24"), null);
  const stats = weeklyStats(state, "2026-09-24");
  assert.equal(stats.count, 2);
  assert.equal(stats.planned, 4);
  assert.equal(stats.sets, 4);
  assert.equal(stats.reps, 53);
  assert.equal(stats.volume, 1160);
  assert.equal(stats.duration, 5400);
  assert.equal(stats.byMuscle.Pectoraux, stats.volume);
  assert.equal(stats.proteinDays, 1);
  assert.equal(stats.creatineDays, 2);
  assert.equal(weeklyStats(state, "2026-09-20").count, 1);
});

test("protein arithmetic is daily and never returns negative remaining protein", () => {
  const state = fixture();
  assert.equal(dailyProtein(state, "2026-09-21"), 55);
  assert.equal(proteinRemaining(state, "2026-09-21"), 0);
  assert.equal(proteinRemaining(state, "2026-09-22"), 50);
  assert.equal(estimateProtein(72, "gain", 4), 130);
  assert.equal(estimateProtein(75, "maintain", 4), 120);
});

test("weekly exercise comparison counts validated sets and reports missing weight baselines", () => {
  const state = fixture();
  state.sessions
    .at(-1)
    .exercises.push({ exerciseId: "shoulder-press", sets: [makeSet(20, 10)] });
  const comparison = weeklyExerciseComparison(state, "2026-09-24");
  const incline = comparison.find(
    (entry) => entry.exerciseId === "incline-press",
  );
  assert.deepEqual(incline.current, {
    volume: 1160,
    reps: 53,
    sets: 4,
    maxWeight: 30,
    sessions: 2,
  });
  assert.deepEqual(incline.previous, {
    volume: 450,
    reps: 18,
    sets: 2,
    maxWeight: 25,
    sessions: 1,
  });
  assert.equal(incline.weightChange, 5);
  assert.equal(incline.volumeChange, percentageChange(1160, 450));
  const shoulder = comparison.find(
    (entry) => entry.exerciseId === "shoulder-press",
  );
  assert.equal(shoulder.weightChange, null);
  assert.equal(shoulder.volumeChange, null);
  assert.equal(shoulder.previous.maxWeight, null);
  assert.deepEqual(weeklyExerciseComparison(state, "2026-10-20"), []);
});

test("weekly weight comparison averages sampled days without inventing missing readings", () => {
  const weights = [
    { date: "2026-09-14", weight: 70 },
    { date: "2026-09-20", weight: 72 },
    { date: "2026-09-21", weight: 73 },
    { date: "2026-09-23", weight: 76 },
    { date: "2026-09-23", weight: 75 },
  ];
  const result = weeklyWeightComparison(weights, "2026-09-24");
  assert.equal(result.previous, 71);
  assert.equal(result.current, 74);
  assert.equal(result.change, 3);
  assert.equal(result.currentCount, 2);
  assert.equal(result.previousCount, 2);
  assert.equal(result.percentage, percentageChange(74, 71));
  const empty = weeklyWeightComparison(weights, "2026-10-10");
  assert.equal(empty.current, null);
  assert.equal(empty.change, null);
  assert.equal(empty.percentage, null);
});

test("history pairs repetitions with max load; records also retain repetitions at lower loads", () => {
  const state = fixture();
  const history = exerciseHistory(state, "incline-press");
  assert.deepEqual(
    history.map(({ date, weight, reps, volume, sets }) => ({
      date,
      weight,
      reps,
      volume,
      sets,
    })),
    [
      { date: "2026-09-14", weight: 25, reps: 10, volume: 450, sets: 2 },
      { date: "2026-09-21", weight: 30, reps: 10, volume: 630, sets: 2 },
      { date: "2026-09-23", weight: 30, reps: 11, volume: 530, sets: 2 },
    ],
  );
  assert.deepEqual(exerciseRecords(state, "incline-press"), {
    weight: 30,
    reps: 20,
    volume: 630,
  });
  assert.deepEqual(exerciseRecords(state, "leg-press"), {
    weight: 0,
    reps: 0,
    volume: 0,
  });
});

test("weight trend uses calendar days, latest daily value, and reports missing baselines honestly", () => {
  const weights = [
    { date: "2026-09-01", weight: 70 },
    { date: "2026-09-02", weight: 72 },
    { date: "2026-09-08", weight: 74 },
    { date: "2026-09-08", weight: 73 },
    { date: "2026-09-09", weight: 74 },
  ];
  const series = weightSeries(weights);
  assert.equal(series.length, 4);
  assert.equal(series[0].secondary, 70);
  assert.equal(series[2].secondary, 72.5);
  assert.equal(series[3].secondary, 73.5);
  assert.equal(weightChange(weights, 7), 2);
  assert.equal(weightChange(weights, 30), null);
  assert.equal(weightChange([], 7), null);
});

test("same-day exercise history is chronological even when import array order differs", () => {
  const state = createInitialState();
  const morning = session("morning", "2026-09-24", [makeSet(25, 10)]);
  morning.startedAt = "2026-09-24T08:00:00.000Z";
  morning.endedAt = "2026-09-24T09:00:00.000Z";
  const evening = session("evening", "2026-09-24", [makeSet(30, 10)]);
  state.sessions = [evening, morning];
  assert.deepEqual(
    exerciseHistory(state, "incline-press").map((entry) => entry.sessionId),
    ["morning", "evening"],
  );
});

test("progress handles gain, loss, zero baseline, missing ratios and unit conversions", () => {
  assert.equal(goalProgress(70, 72, 74), 50);
  assert.equal(goalProgress(90, 85, 80), 50);
  assert.equal(goalProgress(70, 65, 74), 0);
  assert.equal(goalProgress(70, 80, 74), 100);
  assert.equal(goalProgress(70, 70, 70), 100);
  assert.equal(percentageChange(31250, 29700), ((31250 - 29700) / 29700) * 100);
  assert.equal(percentageChange(10, 0), null);
  assert.equal(percentageChange(0, 10), -100);
  assert.ok(
    Math.abs(fromDisplayWeight(toDisplayWeight(72, "lb"), "lb") - 72) < 1e-10,
  );
});

test("streak allows today pending but breaks on a missed past day; adherence denominator is inclusive", () => {
  const supplements = {
    "2026-09-20": { creatine: true },
    "2026-09-21": { creatine: true },
    "2026-09-23": { creatine: true },
  };
  assert.equal(streak(supplements, "creatine", "2026-09-22"), 2);
  assert.equal(streak(supplements, "creatine", "2026-09-23"), 1);
  assert.equal(streak(supplements, "creatine", "2026-09-25"), 0);
  assert.deepEqual(
    supplementStats(supplements, "creatine", "2026-09-20", "2026-09-23"),
    { count: 3, total: 4, rate: 75 },
  );
  assert.deepEqual(
    supplementStats(supplements, "creatine", "2026-09-23", "2026-09-20"),
    { count: 0, total: 0, rate: 0 },
  );
});

test("export/import round-trip validates entire state and does not share mutable references", () => {
  const state = fixture();
  const result = validateImport(JSON.parse(exportData(state)));
  assert.deepEqual(result, state);
  result.profile.firstName = "Alice";
  assert.equal(state.profile.firstName, "");
  assert.deepEqual(validateImport(createInitialState()), createInitialState());
});

test("version 1 backups migrate recovery fields without losing training data", () => {
  const legacy = fixture();
  legacy.schemaVersion = 1;
  delete legacy.hydration;
  delete legacy.sleep;
  delete legacy.rankHistory;
  delete legacy.profile.waterGoal;
  delete legacy.profile.sleepGoal;
  delete legacy.profile.streakMode;
  delete legacy.reminders.water;
  const migrated = validateImport(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.sessions.length, 3);
  assert.deepEqual(migrated.hydration, []);
  assert.equal(migrated.profile.waterGoal, 2500);
  assert.equal(migrated.reminders.water.time, "16:00");
});

test("nested import rejects invalid dates, foreign references, numeric corruption and future schemas", () => {
  const cases = [
    (s) => {
      s.schemaVersion = 3;
    },
    (s) => {
      s.profile.proteinTarget = Infinity;
    },
    (s) => {
      s.profile.weight = -72;
    },
    (s) => {
      s.profile.startDate = "2026-02-30";
    },
    (s) => {
      s.profile.futureFeature = true;
    },
    (s) => {
      s.schedule[8] = "push";
    },
    (s) => {
      s.schedule[1] = "missing-program";
    },
    (s) => {
      s.exceptions["not-a-date"] = "push";
    },
    (s) => {
      s.programs[0].exercises[0].exerciseId = "missing-exercise";
    },
    (s) => {
      s.programs[0].exercises[0].repsMin = 20;
    },
    (s) => {
      s.exercises[0].muscle = "Unknown";
    },
    (s) => {
      s.sessions[0].exercises[0].sets[0].reps = 2.5;
    },
    (s) => {
      s.sessions[0].exercises[0].sets[0].done = "true";
    },
    (s) => {
      s.sessions[0].exercises[0].sets[0].weight = "30";
    },
    (s) => {
      s.sessions[0].endedAt = "2026-09-13T00:00:00.000Z";
    },
    (s) => {
      s.sessions[0].exercises = [];
    },
    (s) => {
      s.sessions.push(structuredClone(s.sessions[0]));
    },
    (s) => {
      s.reminders.training.days = [1, 1];
    },
    (s) => {
      s.reminders.creatine.time = "28:00";
    },
    (s) => {
      s.supplements["2026-09-21"].creatineDose = 500;
    },
    (s) => {
      s.meals[0].protein = NaN;
    },
    (s) => {
      s.meals[0].source = "whey";
    },
  ];
  for (const mutate of cases) {
    const state = fixture();
    mutate(state);
    assert.throws(() => validateImport(state), /Données invalides/);
  }
  assert.throws(
    () =>
      validateImport({
        app: "momentum",
        version: 3,
        exportedAt: new Date().toISOString(),
        data: fixture(),
      }),
    /version/,
  );
  assert.throws(() => validateImport(null), /Données invalides/);
});

test("hostile imports cannot trigger getters, prototype pollution, circular structures or excessive depth", () => {
  const poisoned = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => validateImport(poisoned), /clé interdite/);
  assert.equal({}.polluted, undefined);
  const state = fixture();
  let invoked = false;
  Object.defineProperty(state.profile, "trap", {
    enumerable: true,
    get() {
      invoked = true;
      return 10;
    },
  });
  assert.throws(() => validateImport(state), /dynamique/);
  assert.equal(invoked, false);
  const circular = {};
  circular.self = circular;
  assert.throws(() => validateImport(circular), /circulaire/);
  let deep = {};
  for (let i = 0; i < 25; i++) deep = { child: deep };
  assert.throws(() => validateImport(deep), /complexe/);
  assert.throws(() => validateImport({ huge: "a".repeat(100001) }), /long/);
});

test("draft survives validation with timer and programmed rest without becoming history", () => {
  const state = fixture();
  state.draft = {
    ...session("draft", "2026-09-24", [makeSet(30, 10, false)]),
    endedAt: "",
    currentIndex: 0,
    focused: true,
    timerEnd: Date.now() + 90000,
  };
  state.draft.exercises[0].rest = 120;
  const restored = validateImport(state);
  assert.equal(restored.draft.exercises[0].sets[0].done, false);
  assert.equal(weeklyStats(restored, "2026-09-24").count, 2);
});

test("whey source must be unique and correspond to checked supplement tracking", () => {
  const state = fixture();
  state.supplements["2026-09-21"].whey = true;
  state.meals.push({
    id: "whey",
    date: "2026-09-21",
    name: "Whey",
    quantity: "1 shaker",
    protein: 25,
    source: "whey",
  });
  assert.equal(dailyProtein(validateImport(state), "2026-09-21"), 80);
  state.meals.push({ ...state.meals.at(-1), id: "duplicate-whey" });
  assert.throws(() => validateImport(state), /plusieurs shakers/);
});

test("IndexedDB unavailability is an explicit error, never a pretend successful save", async () => {
  assert.equal(globalThis.indexedDB, undefined);
  await assert.rejects(loadState(), /IndexedDB est indisponible/);
  await assert.rejects(
    saveState(createInitialState()),
    /IndexedDB est indisponible/,
  );
});

function installControlledDatabase({
  stored,
  writeError = null,
  readError = null,
  onPut = () => {},
} = {}) {
  const database = {
    close() {},
    transaction() {
      const transaction = {
        objectStore() {
          return {
            get() {
              const request = {};
              queueMicrotask(() => {
                if (readError) {
                  transaction.error = new Error(readError);
                  transaction.onerror?.();
                } else {
                  request.result = stored;
                  request.onsuccess?.();
                  transaction.oncomplete?.();
                }
              });
              return request;
            },
            put(value) {
              onPut(value);
              setTimeout(() => {
                if (writeError) {
                  transaction.error = new Error(writeError);
                  transaction.onerror?.();
                } else {
                  stored = value;
                  transaction.oncomplete?.();
                }
              }, 15);
            },
          };
        },
      };
      return transaction;
    },
  };
  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    },
  };
  return () => {
    database.onversionchange?.();
    delete globalThis.indexedDB;
  };
}

test("storage acknowledges a write only after the IndexedDB transaction commits", async () => {
  let putIssued = false;
  const restore = installControlledDatabase({
    onPut: () => {
      putIssued = true;
    },
  });
  try {
    let finished = false;
    const saving = saveState(fixture()).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(putIssued, true);
    assert.equal(finished, false);
    await saving;
    assert.deepEqual(await loadState(), fixture());
  } finally {
    restore();
  }
});

test("quota and read errors are reported with no fallback storage", async () => {
  let restore = installControlledDatabase({ writeError: "QuotaExceededError" });
  try {
    await assert.rejects(saveState(fixture()), /QuotaExceededError/);
  } finally {
    restore();
  }
  restore = installControlledDatabase({ readError: "NotReadableError" });
  try {
    await assert.rejects(loadState(), /NotReadableError/);
  } finally {
    restore();
  }
});

test("corrupted persisted data is preserved and never silently replaced by fresh defaults", async () => {
  let writes = 0;
  const restore = installControlledDatabase({
    stored: { schemaVersion: 999 },
    onPut: () => {
      writes++;
    },
  });
  try {
    await assert.rejects(loadState(), /conservées/);
    assert.equal(writes, 0);
  } finally {
    restore();
  }
});
