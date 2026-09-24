import React, { useState } from "react";
import { useApp } from "../context";
import {
  PageHeader,
  Card,
  Button,
  Icon,
  Badge,
  ProgressBar,
  StatCard,
  LineChart,
} from "../components";
import {
  today,
  addDays,
  weekStart,
  plannedProgram,
  weeklyStats,
  dailyProtein,
  proteinRemaining,
  weightChange,
  fmt,
  toDisplayWeight,
  weightSeries,
  percentageChange,
  exerciseHistory,
  dailyWater,
  averageSleep,
  readiness,
  rankStatus,
} from "../calculations";
function WeightArt() {
  return (
    <svg
      className="weight-art"
      viewBox="0 0 340 260"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="193"
        cy="135"
        r="112"
        stroke="currentColor"
        strokeOpacity=".1"
      />
      <circle
        cx="193"
        cy="135"
        r="87"
        stroke="currentColor"
        strokeOpacity=".08"
      />
      <circle
        cx="193"
        cy="135"
        r="61"
        stroke="currentColor"
        strokeOpacity=".07"
      />
      <g transform="rotate(-30 180 135)">
        <rect x="90" y="119" width="191" height="27" rx="7" fill="#758969" />
        <rect x="92" y="122" width="185" height="7" rx="3" fill="#a6b798" />
        <rect
          x="108"
          y="66"
          width="38"
          height="134"
          rx="11"
          fill="#394d34"
          stroke="#849a73"
          strokeWidth="2"
        />
        <rect x="122" y="66" width="27" height="134" rx="9" fill="#586f48" />
        <rect
          x="96"
          y="83"
          width="21"
          height="99"
          rx="6"
          fill="#273c24"
          stroke="#708760"
        />
        <rect
          x="237"
          y="66"
          width="38"
          height="134"
          rx="11"
          fill="#394d34"
          stroke="#849a73"
          strokeWidth="2"
        />
        <rect x="251" y="66" width="27" height="134" rx="9" fill="#73895f" />
        <rect
          x="268"
          y="83"
          width="21"
          height="99"
          rx="6"
          fill="#34482d"
          stroke="#849a73"
        />
        <path
          d="M130 76v113M260 76v113"
          stroke="#acc695"
          strokeOpacity=".4"
          strokeWidth="2"
        />
      </g>
      <path
        d="M64 57h11m-5-5v10M285 222h11m-5-5v10"
        stroke="currentColor"
        strokeOpacity=".4"
      />
    </svg>
  );
}
export default function Dashboard() {
  const { state, navigate, toggleSupplement } = useApp(),
    [period, setPeriod] = useState(30);
  const date = today(),
    program = plannedProgram(state, date),
    week = weeklyStats(state, date),
    previous = weeklyStats(state, addDays(date, -7)),
    start = weekStart(date),
    protein = dailyProtein(state, date),
    remaining = proteinRemaining(state, date),
    weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)),
    latest = weights.at(-1),
    unit = state.profile.unit,
    delta = weightChange(weights, 7),
    volumeChange = percentageChange(week.volume, previous.volume),
    done = state.sessions.some(
      (s) => s.date === date && s.programId === program?.id,
    );
  let next = null;
  for (let n = 1; n < 8 && !next; n++) {
    const d = addDays(date, n),
      p = plannedProgram(state, d);
    if (p) next = { date: d, program: p };
  }
  const hero = program || next?.program;
  const chart = weightSeries(state.weights, period).map((d) => ({
    ...d,
    value: toDisplayWeight(d.value, unit),
    secondary: toDisplayWeight(d.secondary, unit),
  }));
  const milestones = state.programs
    .flatMap((p) => p.exercises)
    .filter(
      (x, i, arr) => arr.findIndex((y) => y.exerciseId === x.exerciseId) === i,
    )
    .map((x) => ({
      exercise: state.exercises.find((e) => e.id === x.exerciseId),
      history: exerciseHistory(state, x.exerciseId),
    }))
    .filter((x) => x.history.length >= 2)
    .slice(0, 3);
  const ready = readiness(state, date);
  const rank = rankStatus(state, date);
  const water = dailyWater(state, date);
  const sleep = averageSleep(state, 7, date);
  return (
    <div className="page-stack dashboard">
      <PageHeader
        eyebrow="VOTRE PROGRESSION, AU QUOTIDIEN"
        title={`Bonjour${state.profile.firstName ? `, ${state.profile.firstName}` : ""} ${"✦"}`}
        description="Un peu plus fort qu’hier. Une séance à la fois."
      >
        <Button variant="secondary" onClick={() => navigate("history")}>
          <Icon name="calendar" size={17} />
          Mon calendrier
        </Button>
      </PageHeader>
      <div className="motivation-strip">
        <button className="motivation-rank" onClick={() => navigate("profile")}>
          <span
            className="motivation-medal"
            style={{ "--rank-color": rank.rank.color }}
          >
            {rank.rank.symbol}
          </span>
          <span>
            <small>RANK ACTUEL</small>
            <strong>{rank.rank.name}</strong>
            <em>
              {rank.remaining
                ? `${rank.remaining} pts avant ${rank.next.name}`
                : "Rang maximal"}
            </em>
          </span>
          <ProgressBar value={rank.progress} />
        </button>
        <button
          className="motivation-streak"
          onClick={() => navigate("profile")}
        >
          <Icon name="flame" size={28} />
          <span>
            <small>STREAK ACTUEL</small>
            <strong>
              {rank.streak.current}{" "}
              {rank.streak.mode === "complete"
                ? `jour${rank.streak.current > 1 ? "s" : ""}`
                : `séance${rank.streak.current > 1 ? "s" : ""}`}
            </strong>
            <em>Meilleur : {rank.streak.best}</em>
          </span>
        </button>
        <button
          className="motivation-ready"
          onClick={() => navigate("recovery")}
        >
          <span className="readiness-mini">{ready.score}</span>
          <span>
            <small>ÉTAT DU JOUR</small>
            <strong>{ready.label}</strong>
            <em>
              {ready.parts.length} repère{ready.parts.length > 1 ? "s" : ""}{" "}
              renseigné{ready.parts.length > 1 ? "s" : ""}
            </em>
          </span>
        </button>
      </div>
      <div className="dashboard-lead">
        <Card className="session-hero">
          <div className="hero-content">
            <div className="row hero-kicker">
              <span className="status-dot" />
              {state.draft
                ? "SÉANCE EN COURS"
                : program
                  ? "VOTRE SÉANCE DU JOUR"
                  : "VOTRE PROCHAINE SÉANCE"}
              <Badge tone="subtle">
                {state.draft
                  ? "À reprendre"
                  : done
                    ? "Terminée"
                    : program
                      ? state.scheduleTime
                      : next
                        ? new Date(next.date + "T12:00:00").toLocaleDateString(
                            "fr-FR",
                            { weekday: "long" },
                          )
                        : "À planifier"}
              </Badge>
            </div>
            <h2>
              {state.draft?.name || hero?.name || "À votre rythme"}
              <span>.</span>
            </h2>
            <p>
              {state.draft
                ? "Reprenez exactement là où vous en étiez."
                : program
                  ? hero?.description
                  : "Aujourd’hui, place à la récupération."}
            </p>
            <div className="hero-meta">
              <span>
                <Icon name="dumbbell" size={15} />
                {hero?.exercises.length || 0} exercices
              </span>
              <span>
                <Icon name="clock" size={15} />
                {hero
                  ? `${hero.exercises.reduce((sum, x) => sum + x.sets, 0)} séries prévues`
                  : "Votre programme personnel"}
              </span>
            </div>
            <Button onClick={() => navigate("training")}>
              <Icon name="play" size={16} />
              {state.draft
                ? "Reprendre la séance"
                : done
                  ? "Voir mon entraînement"
                  : program
                    ? "Commencer ma séance"
                    : "Préparer ma prochaine séance"}
              <Icon name="arrow-right" size={17} />
            </Button>
          </div>
          <WeightArt />
        </Card>
        <Card className="weekly-goal">
          <div className="row between">
            <h3>La régularité fait la différence.</h3>
            <Icon name="flame" className="accent" size={21} />
          </div>
          <div className="week-number">
            {week.count}
            <span>/ {week.planned}</span>
          </div>
          <p>séances cette semaine</p>
          <ProgressBar value={week.count} max={week.planned || 1} />
          <div className="small muted">
            {week.count === 0
              ? "La prochaine séance est un pas de plus."
              : week.count >= week.planned
                ? "Votre programme de la semaine est accompli."
                : "Continuez à construire votre progression."}
          </div>
          <button className="text-link" onClick={() => navigate("program")}>
            Voir mon programme
            <Icon name="arrow-up-right" size={15} />
          </button>
        </Card>
      </div>
      <div className="grid-4 dashboard-stats">
        <StatCard
          label="Mon poids"
          icon="scale"
          value={latest ? fmt(toDisplayWeight(latest.weight, unit)) : "—"}
          unit={unit}
          change={
            <>
              <span className={delta === null ? "muted" : "accent"}>
                {delta === null
                  ? "Première pesée à enregistrer"
                  : `${delta > 0 ? "+" : ""}${fmt(toDisplayWeight(delta, unit))} ${unit}`}
              </span>
              {delta !== null && <span className="muted"> sur 7 jours</span>}
            </>
          }
        />
        <StatCard
          label="Protéines aujourd’hui"
          icon="utensils"
          value={state.profile.trackProtein ? fmt(protein) : "—"}
          unit={
            state.profile.trackProtein
              ? `/ ${state.profile.proteinTarget} g`
              : ""
          }
          change={
            state.profile.trackProtein ? (
              <>
                <ProgressBar
                  value={protein}
                  max={state.profile.proteinTarget}
                />
                <span className="muted">
                  {remaining > 0
                    ? `${fmt(remaining)} g pour atteindre votre repère`
                    : "Objectif quotidien atteint"}
                </span>
              </>
            ) : (
              <span className="muted">Suivi désactivé dans les paramètres</span>
            )
          }
        />
        <StatCard
          label="Volume de la semaine"
          icon="dumbbell"
          value={fmt(toDisplayWeight(week.volume, unit), 0)}
          unit={unit}
          change={
            <>
              <span className="accent">
                {volumeChange === null
                  ? "À vous de commencer"
                  : `${volumeChange > 0 ? "+" : ""}${fmt(volumeChange)} %`}
              </span>
              {volumeChange !== null && (
                <span className="muted"> vs semaine précédente</span>
              )}
            </>
          }
        />
        <StatCard
          label="Temps d’entraînement"
          icon="clock"
          value={Math.round(week.duration / 60)}
          unit="min"
          change={
            <>
              <span className="accent">{week.sets} séries</span>
              <span className="muted">
                {" "}
                · {week.reps} répétitions cette semaine
              </span>
            </>
          }
        />
      </div>
      <div className="grid-2 dashboard-wellness">
        <Card
          className="wellness-shortcut"
          onClick={() => navigate("hydration")}
        >
          <span className="resource-icon">
            <Icon name="glass" />
          </span>
          <div>
            <small>HYDRATATION</small>
            <h2>
              {fmt(water / 1000, 2)} / {fmt(state.profile.waterGoal / 1000, 2)}{" "}
              L
            </h2>
            <ProgressBar value={water} max={state.profile.waterGoal} />
          </div>
          <Icon name="arrow-right" />
        </Card>
        <Card
          className="wellness-shortcut"
          onClick={() => navigate("recovery")}
        >
          <span className="resource-icon">
            <Icon name="moon" />
          </span>
          <div>
            <small>SOMMEIL · MOYENNE 7 JOURS</small>
            <h2>
              {sleep === null
                ? "À renseigner"
                : `${Math.floor(sleep)} h ${String(Math.round((sleep - Math.floor(sleep)) * 60)).padStart(2, "0")}`}
            </h2>
            <ProgressBar value={sleep ?? 0} max={state.profile.sleepGoal} />
          </div>
          <Icon name="arrow-right" />
        </Card>
      </div>
      <Card className="week-card">
        <div className="section-heading">
          <div className="row">
            <Icon name="calendar" size={18} />
            <h2>Votre semaine</h2>
          </div>
          <button className="text-link" onClick={() => navigate("history")}>
            {new Date(start + "T12:00:00").toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {new Date(addDays(start, 6) + "T12:00:00").toLocaleDateString(
              "fr-FR",
              { day: "numeric", month: "short" },
            )}
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
        <div className="week-strip">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i),
              p = plannedProgram(state, d),
              completed = state.sessions.filter((s) => s.date === d);
            return (
              <button
                key={d}
                className={`week-day ${d === date ? "is-today" : ""} ${completed.length ? "is-done" : ""}`}
                onClick={() => navigate("history")}
              >
                <span className="day-label">
                  {["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"][i]}
                  <strong>{d.slice(-2)}</strong>
                </span>
                <span className={`day-icon ${p ? "training-day" : ""}`}>
                  <Icon
                    name={completed.length ? "check" : p ? "dumbbell" : "leaf"}
                    size={17}
                  />
                </span>
                <span className="day-session">
                  {completed.length ? completed[0].name : p?.name || "Repos"}
                </span>
                <small>
                  {d === date
                    ? "Aujourd’hui"
                    : completed.length
                      ? "Terminée"
                      : p
                        ? d < date
                          ? "Non réalisée"
                          : state.scheduleTime
                        : "Récupération"}
                </small>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="dashboard-bottom">
        <Card className="weight-overview">
          <div className="section-heading">
            <div>
              <div className="row">
                <h2>Évolution du poids</h2>
                <Badge tone="subtle">{unit}</Badge>
              </div>
              <p className="small muted">
                La tendance compte plus qu’un chiffre.
              </p>
            </div>
            <div className="segmented">
              {[7, 30, 90].map((n) => (
                <button
                  key={n}
                  className={period === n ? "active" : ""}
                  onClick={() => setPeriod(n)}
                >
                  {n === 90 ? "3 mois" : `${n} j`}
                </button>
              ))}
            </div>
          </div>
          <LineChart
            data={chart}
            height={205}
            unit={unit}
            secondaryLabel="Moyenne sur 7 jours"
          />
          <button className="text-link" onClick={() => navigate("weight")}>
            Enregistrer mon poids
            <Icon name="plus" size={16} />
          </button>
        </Card>
        <Card className="daily-habits">
          <div className="section-heading">
            <h2>Mes essentiels du jour</h2>
            <Icon name="check-circle" size={18} />
          </div>
          {state.profile.trackCreatine && (
            <button
              className={`habit-row ${state.supplements[date]?.creatine ? "done" : ""}`}
              onClick={() => toggleSupplement("creatine")}
            >
              <span className="habit-icon">
                <Icon name="pill" />
              </span>
              <span>
                <strong>Créatine</strong>
                <small>
                  {state.profile.creatineDose} g · votre quantité habituelle
                </small>
              </span>
              <span className="habit-check">
                {state.supplements[date]?.creatine && (
                  <Icon name="check" size={15} />
                )}
              </span>
            </button>
          )}
          {state.profile.trackWhey && (
            <button
              className={`habit-row ${state.supplements[date]?.whey ? "done" : ""}`}
              onClick={() => toggleSupplement("whey")}
            >
              <span className="habit-icon">
                <Icon name="glass" />
              </span>
              <span>
                <strong>Shaker de whey</strong>
                <small>
                  {state.profile.wheyProtein} g de protéines · si besoin
                </small>
              </span>
              <span className="habit-check">
                {state.supplements[date]?.whey && (
                  <Icon name="check" size={15} />
                )}
              </span>
            </button>
          )}
          <button className="habit-row" onClick={() => navigate("nutrition")}>
            <span className="habit-icon">
              <Icon name="utensils" />
            </span>
            <span>
              <strong>Mes protéines</strong>
              <small>
                {state.profile.trackProtein
                  ? `${fmt(protein)} / ${state.profile.proteinTarget} g aujourd’hui`
                  : "Activer le suivi dans les paramètres"}
              </small>
            </span>
            <Icon name="chevron-right" size={17} />
          </button>
          <div className="habit-tip">
            <Icon name="sparkles" size={16} />
            <span>Les petites habitudes font les grands progrès.</span>
          </div>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card>
          <div className="section-heading">
            <h2>Vos dernières progressions</h2>
            <button
              className="text-link"
              onClick={() => navigate("progression")}
            >
              Tout voir
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
          {milestones.length ? (
            milestones.map(({ exercise, history }) => (
              <div className="list-row" key={exercise.id}>
                <span className="resource-icon">
                  <Icon name="dumbbell" />
                </span>
                <strong>{exercise.name}</strong>
                <span className="muted">
                  {fmt(toDisplayWeight(history[0].weight, unit))}
                  <Icon name="arrow-right" size={14} />
                </span>
                <Badge>
                  {fmt(toDisplayWeight(history.at(-1).weight, unit))} {unit}
                </Badge>
              </div>
            ))
          ) : (
            <div className="compact-empty">
              <Icon name="trending-up" size={25} />
              <p>
                Vos progrès, séance après séance.
                <small>
                  Enregistrez deux séances pour comparer vos performances.
                </small>
              </p>
              <Button variant="secondary" onClick={() => navigate("training")}>
                S’entraîner
              </Button>
            </div>
          )}
        </Card>
        <Card className="arms-teaser">
          <Badge tone="subtle">FOCUS DU MOMENT</Badge>
          <h2>
            Des bras plus forts.
            <br />
            Un programme qui vous ressemble.
          </h2>
          <p>Découvrez les compléments possibles pour vos biceps et triceps.</p>
          <button className="text-link" onClick={() => navigate("arms")}>
            Explorer le focus bras
            <Icon name="arrow-up-right" size={17} />
          </button>
        </Card>
      </div>
    </div>
  );
}
