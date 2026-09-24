const finite = (value) => typeof value === "number" && Number.isFinite(value);
const numeric = (value) => (finite(value) ? value : 0);
const validSets = (entry) =>
  (entry?.sets ?? []).filter((set) => set.done === true);
const kgPerLb = 0.45359237;

function localDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }
  return new Date(value);
}

export function dateKey(value) {
  const date = localDate(value);
  if (Number.isNaN(date.getTime())) throw new Error("Date invalide.");
  return `${date.getFullYear().toString().padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function today() {
  return dateKey(new Date());
}
export function addDays(value, days) {
  const date = localDate(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function weekStart(value = today()) {
  const date = localDate(value);
  return addDays(dateKey(date), -((date.getDay() + 6) % 7));
}
export function formatDate(value, options = {}) {
  return localDate(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...options,
  });
}
export function round(value, digits = 1) {
  const power = 10 ** digits;
  return Math.round((numeric(value) + Number.EPSILON) * power) / power;
}
export function fmt(value, digits = 1) {
  return finite(value)
    ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(
        value,
      )
    : "—";
}
export function toDisplayWeight(kg, unit = "kg") {
  return unit === "lb" ? numeric(kg) / kgPerLb : numeric(kg);
}
export function fromDisplayWeight(value, unit = "kg") {
  return unit === "lb" ? numeric(value) * kgPerLb : numeric(value);
}
export function setVolume(set) {
  return set?.done === true
    ? Math.max(0, numeric(set.weight)) * Math.max(0, numeric(set.reps))
    : 0;
}
export function exerciseVolume(entry) {
  return (entry?.sets ?? []).reduce((sum, set) => sum + setVolume(set), 0);
}
export function sessionVolume(session) {
  return (session?.exercises ?? []).reduce(
    (sum, entry) => sum + exerciseVolume(entry),
    0,
  );
}
export function dailyProtein(state, date = today()) {
  return (state.meals ?? [])
    .filter((meal) => meal.date === date)
    .reduce((sum, meal) => sum + numeric(meal.protein), 0);
}
export function proteinRemaining(state, date = today()) {
  return Math.max(
    0,
    numeric(state.profile.proteinTarget) - dailyProtein(state, date),
  );
}
export function dailyWater(state, date = today()) {
  return (state.hydration ?? [])
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + numeric(entry.amount), 0);
}
export function waterRemaining(state, date = today()) {
  return Math.max(
    0,
    numeric(state.profile.waterGoal) - dailyWater(state, date),
  );
}
export function sleepForDate(state, date = today()) {
  return (
    [...(state.sleep ?? [])].reverse().find((entry) => entry.date === date) ??
    null
  );
}
export function averageSleep(state, days = 7, date = today()) {
  const start = addDays(date, -days + 1),
    entries = (state.sleep ?? []).filter(
      (entry) => entry.date >= start && entry.date <= date,
    );
  return entries.length
    ? round(
        entries.reduce((sum, entry) => sum + numeric(entry.hours), 0) /
          entries.length,
        2,
      )
    : null;
}
export function estimateProtein(weight, goal = "gain", frequency = 4) {
  const factor =
    frequency < 2
      ? goal === "maintain"
        ? 1.4
        : 1.6
      : goal === "maintain"
        ? 1.6
        : goal === "lose"
          ? 2
          : 1.8;
  return round(Math.max(0, numeric(weight)) * factor, 0);
}
export function plannedProgram(state, date = today()) {
  const id = Object.hasOwn(state.exceptions ?? {}, date)
    ? state.exceptions[date]
    : state.schedule?.[localDate(date).getDay()];
  return state.programs.find((program) => program.id === id) ?? null;
}

function scheduledDayComplete(state, date) {
  const program = plannedProgram(state, date);
  if (!program) return null;
  return state.sessions.some(
    (session) =>
      session.date === date &&
      (session.programId === program.id || session.name === program.name),
  );
}
export function trainingStreak(state, date = today()) {
  if (state.profile.streakMode === "complete") {
    const complete = (day) => {
      const program = plannedProgram(state, day);
      return (
        (!program || scheduledDayComplete(state, day) === true) &&
        (!state.profile.trackProtein ||
          dailyProtein(state, day) >= state.profile.proteinTarget) &&
        dailyWater(state, day) >= state.profile.waterGoal &&
        (!state.profile.trackCreatine ||
          state.supplements[day]?.creatine === true)
      );
    };
    const dates = Array.from({ length: 365 }, (_, offset) =>
      addDays(date, -offset),
    );
    let current = 0;
    for (const day of dates) {
      if (complete(day)) current++;
      else if (day === date) continue;
      else break;
    }
    let best = 0,
      running = 0;
    for (const day of [...dates].reverse()) {
      if (complete(day)) {
        running++;
        best = Math.max(best, running);
      } else running = 0;
    }
    const adherence = (days) => {
      const list = Array.from({ length: days }, (_, offset) =>
        addDays(date, -offset),
      );
      const done = list.filter(complete).length;
      return { done, planned: days, rate: round((done / days) * 100, 0) };
    };
    return {
      current,
      best,
      total: state.sessions.length,
      seven: adherence(7),
      thirty: adherence(30),
      mode: "complete",
    };
  }
  const planned = [];
  for (let offset = 0; offset < 730; offset++) {
    const day = addDays(date, -offset);
    if (plannedProgram(state, day)) planned.push(day);
  }
  let current = 0;
  for (const day of planned) {
    const done = scheduledDayComplete(state, day);
    if (done) current++;
    else if (day === date) continue;
    else break;
  }
  let best = 0,
    running = 0;
  for (const day of [...planned].reverse()) {
    if (scheduledDayComplete(state, day)) {
      running++;
      best = Math.max(best, running);
    } else running = 0;
  }
  const adherence = (days) => {
    const start = addDays(date, -days + 1);
    const dates = [];
    for (let day = start; day <= date; day = addDays(day, 1))
      if (plannedProgram(state, day)) dates.push(day);
    const done = dates.filter((day) => scheduledDayComplete(state, day)).length;
    return {
      done,
      planned: dates.length,
      rate: dates.length ? round((done / dates.length) * 100, 0) : 100,
    };
  };
  return {
    current,
    best,
    total: state.sessions.length,
    seven: adherence(7),
    thirty: adherence(30),
    mode: "training",
  };
}
export const RANKS = [
  { name: "Beginner", threshold: 0, color: "#8c968a", symbol: "I" },
  { name: "Rookie", threshold: 4, color: "#9bad8e", symbol: "II" },
  { name: "Bronze", threshold: 12, color: "#b8815c", symbol: "III" },
  { name: "Silver", threshold: 28, color: "#bdc7cb", symbol: "IV" },
  { name: "Gold", threshold: 55, color: "#e0bd58", symbol: "V" },
  { name: "Platinum", threshold: 95, color: "#7dd5c3", symbol: "VI" },
  { name: "Diamond", threshold: 150, color: "#80b9ec", symbol: "VII" },
  { name: "Elite", threshold: 230, color: "#b794e8", symbol: "VIII" },
  { name: "Master", threshold: 350, color: "#ed8c83", symbol: "IX" },
  { name: "Legend", threshold: 520, color: "#c4ed83", symbol: "X" },
];
export function rankStatus(state, date = today()) {
  const streak = trainingStreak(state, date),
    score =
      streak.total + streak.best * 2 + Math.round(streak.thirty.rate / 10),
    index = Math.max(
      0,
      RANKS.findLastIndex((rank) => score >= rank.threshold),
    ),
    rank = RANKS[index],
    next = RANKS[index + 1] ?? null,
    progress = next
      ? Math.max(
          0,
          Math.min(
            100,
            ((score - rank.threshold) / (next.threshold - rank.threshold)) *
              100,
          ),
        )
      : 100;
  return {
    score,
    rank,
    next,
    progress,
    remaining: next ? next.threshold - score : 0,
    streak,
  };
}
export function readiness(state, date = today()) {
  const parts = [];
  const sleep = sleepForDate(state, date);
  if (sleep)
    parts.push({
      key: "sleep",
      label: "Sommeil",
      score: Math.min(
        100,
        (sleep.hours / Math.max(1, state.profile.sleepGoal)) * 100,
      ),
    });
  const water = dailyWater(state, date);
  if (water > 0)
    parts.push({
      key: "water",
      label: "Hydratation",
      score: Math.min(
        100,
        (water / Math.max(1, state.profile.waterGoal)) * 100,
      ),
    });
  if (state.profile.trackProtein && dailyProtein(state, date) > 0)
    parts.push({
      key: "protein",
      label: "Protéines",
      score: Math.min(
        100,
        (dailyProtein(state, date) / Math.max(1, state.profile.proteinTarget)) *
          100,
      ),
    });
  const planned = plannedProgram(state, date);
  if (planned)
    parts.push({
      key: "training",
      label: "Séance",
      score: scheduledDayComplete(state, date)
        ? 100
        : date === today()
          ? 50
          : 0,
    });
  const adherence = trainingStreak(state, date).seven.rate;
  parts.push({ key: "regularity", label: "Régularité", score: adherence });
  const score = parts.length
    ? round(parts.reduce((sum, part) => sum + part.score, 0) / parts.length, 0)
    : 0;
  return {
    score,
    label:
      score >= 85
        ? "Très bon suivi"
        : score >= 68
          ? "Bon suivi"
          : score >= 45
            ? "Moyen"
            : "À améliorer",
    parts,
  };
}
export function weeklyWellnessStats(state, date = today()) {
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const waterValues = days.map((day) => dailyWater(state, day));
  const sleepValues = days
    .map((day) => sleepForDate(state, day)?.hours)
    .filter(finite);
  return {
    waterDays: waterValues.filter((value) => value >= state.profile.waterGoal)
      .length,
    averageWater: round(
      waterValues.reduce((sum, value) => sum + value, 0) / 7,
      0,
    ),
    sleepDays: sleepValues.length,
    averageSleep: sleepValues.length
      ? round(
          sleepValues.reduce((sum, value) => sum + value, 0) /
            sleepValues.length,
          2,
        )
      : null,
  };
}
export function weeklyStats(state, date = today()) {
  const start = weekStart(date);
  const end = addDays(start, 7);
  const sessions = state.sessions.filter(
    (session) => session.date >= start && session.date < end,
  );
  const byMuscle = {};
  let sets = 0;
  let reps = 0;
  for (const session of sessions)
    for (const entry of session.exercises) {
      const completed = validSets(entry);
      sets += completed.length;
      reps += completed.reduce((sum, set) => sum + numeric(set.reps), 0);
      const muscle =
        state.exercises.find((item) => item.id === entry.exerciseId)?.muscle ??
        "Autres";
      byMuscle[muscle] = (byMuscle[muscle] ?? 0) + exerciseVolume(entry);
    }
  let planned = 0;
  let proteinDays = 0;
  let creatineDays = 0;
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(start, offset);
    if (plannedProgram(state, day)) planned++;
    if (
      state.profile.proteinTarget > 0 &&
      dailyProtein(state, day) >= state.profile.proteinTarget
    )
      proteinDays++;
    if (state.supplements[day]?.creatine === true) creatineDays++;
  }
  return {
    sessions,
    count: sessions.length,
    sets,
    reps,
    volume: sessions.reduce((sum, session) => sum + sessionVolume(session), 0),
    duration: sessions.reduce(
      (sum, session) => sum + numeric(session.duration),
      0,
    ),
    planned,
    proteinDays,
    creatineDays,
    byMuscle,
  };
}
export function weeklyExerciseComparison(state, date = today()) {
  const start = weekStart(date);
  const previousStart = addDays(start, -7);
  const end = addDays(start, 7);
  const result = new Map();
  const blank = () => ({
    volume: 0,
    reps: 0,
    sets: 0,
    maxWeight: null,
    sessions: 0,
  });
  for (const session of state.sessions) {
    if (session.date < previousStart || session.date >= end) continue;
    const period = session.date >= start ? "current" : "previous";
    const seen = new Set();
    for (const entry of session.exercises) {
      const sets = validSets(entry);
      if (!sets.length) continue;
      if (!result.has(entry.exerciseId))
        result.set(entry.exerciseId, {
          exerciseId: entry.exerciseId,
          name:
            state.exercises.find((exercise) => exercise.id === entry.exerciseId)
              ?.name ?? "Exercice",
          current: blank(),
          previous: blank(),
        });
      const group = result.get(entry.exerciseId)[period];
      group.volume += exerciseVolume(entry);
      group.reps += sets.reduce((sum, set) => sum + set.reps, 0);
      group.sets += sets.length;
      group.maxWeight = sets.reduce(
        (best, set) => Math.max(best ?? 0, set.weight),
        group.maxWeight,
      );
      if (!seen.has(entry.exerciseId)) group.sessions++;
      seen.add(entry.exerciseId);
    }
  }
  return [...result.values()]
    .map((entry) => ({
      ...entry,
      volumeChange: percentageChange(
        entry.current.volume,
        entry.previous.volume,
      ),
      repsChange: percentageChange(entry.current.reps, entry.previous.reps),
      weightChange:
        entry.current.maxWeight === null || entry.previous.maxWeight === null
          ? null
          : entry.current.maxWeight - entry.previous.maxWeight,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
export function exerciseHistory(state, id) {
  const sessions = [...state.sessions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt),
  );
  return sessions.flatMap((session) => {
    const entries = session.exercises.filter(
      (entry) => entry.exerciseId === id,
    );
    const sets = entries.flatMap(validSets);
    if (!sets.length) return [];
    const weight = sets.reduce((best, set) => Math.max(best, set.weight), 0);
    const reps = sets.reduce(
      (best, set) => (set.weight === weight ? Math.max(best, set.reps) : best),
      0,
    );
    return [
      {
        date: session.date,
        weight,
        reps,
        volume: entries.reduce((sum, entry) => sum + exerciseVolume(entry), 0),
        sets: sets.length,
        sessionId: session.id,
      },
    ];
  });
}
export function exerciseRecords(state, id) {
  const history = exerciseHistory(state, id);
  const allSets = state.sessions.flatMap((session) =>
    session.exercises
      .filter((entry) => entry.exerciseId === id)
      .flatMap(validSets),
  );
  return {
    weight: allSets.reduce((best, set) => Math.max(best, set.weight), 0),
    reps: allSets.reduce((best, set) => Math.max(best, set.reps), 0),
    volume: history.reduce((best, entry) => Math.max(best, entry.volume), 0),
  };
}
function dailyWeights(weights) {
  const byDay = new Map();
  for (const entry of weights)
    if (finite(entry.weight)) byDay.set(entry.date, entry);
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function weeklyWeightComparison(weights, date = today()) {
  const start = weekStart(date);
  const previousStart = addDays(start, -7);
  const end = addDays(start, 7);
  const all = dailyWeights(weights);
  const currentEntries = all.filter(
    (entry) => entry.date >= start && entry.date < end,
  );
  const previousEntries = all.filter(
    (entry) => entry.date >= previousStart && entry.date < start,
  );
  const mean = (entries) =>
    entries.length
      ? entries.reduce((sum, entry) => sum + entry.weight, 0) / entries.length
      : null;
  const current = mean(currentEntries);
  const previous = mean(previousEntries);
  return {
    current,
    previous,
    change: current === null || previous === null ? null : current - previous,
    percentage:
      current === null || previous === null
        ? null
        : percentageChange(current, previous),
    currentCount: currentEntries.length,
    previousCount: previousEntries.length,
  };
}
export function weightSeries(weights, days = 0) {
  const all = dailyWeights(weights);
  const cutoff = days > 0 ? addDays(today(), -(days - 1)) : null;
  return all
    .filter((entry) => !cutoff || entry.date >= cutoff)
    .map((entry) => {
      const windowStart = addDays(entry.date, -6);
      const samples = all.filter(
        (sample) => sample.date >= windowStart && sample.date <= entry.date,
      );
      return {
        label: formatDate(entry.date),
        date: entry.date,
        value: entry.weight,
        secondary:
          samples.reduce((sum, sample) => sum + sample.weight, 0) /
          samples.length,
      };
    });
}
export function weightChange(weights, days) {
  const entries = dailyWeights(weights);
  if (!entries.length) return null;
  const last = entries.at(-1);
  const cutoff = addDays(last.date, -days);
  const baseline = entries.filter((entry) => entry.date <= cutoff).at(-1);
  return baseline ? last.weight - baseline.weight : null;
}
export function goalProgress(start, current, target) {
  if (![start, current, target].every(finite)) return 0;
  if (start === target) return current === target ? 100 : 0;
  return Math.max(
    0,
    Math.min(100, ((current - start) / (target - start)) * 100),
  );
}
export function streak(supplements, key, date = today()) {
  let cursor = supplements[date]?.[key] ? date : addDays(date, -1);
  let count = 0;
  while (supplements[cursor]?.[key] === true) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
export function supplementStats(
  supplements,
  key,
  startDate,
  endDate = today(),
) {
  const end = endDate > today() ? today() : endDate;
  if (startDate > end) return { count: 0, total: 0, rate: 0 };
  const start = localDate(startDate);
  const finish = localDate(end);
  // UTC calendar components avoid DST days of 23 or 25 hours.
  const dayNumber = (date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const total = dayNumber(finish) - dayNumber(start) + 1;
  const count = Object.entries(supplements).filter(
    ([date, record]) =>
      date >= startDate && date <= end && record[key] === true,
  ).length;
  return { count, total, rate: total > 0 ? (count / total) * 100 : 0 };
}
export function percentageChange(current, previous) {
  return !finite(current) || !finite(previous) || previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}
