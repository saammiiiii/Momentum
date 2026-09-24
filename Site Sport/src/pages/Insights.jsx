import React, { useState } from "react";
import { useApp } from "../context";
import {
  PageHeader,
  Card,
  Button,
  Field,
  Icon,
  Empty,
  Badge,
  StatCard,
  LineChart,
  ProgressBar,
} from "../components";
import {
  today,
  addDays,
  weekStart,
  weeklyStats,
  exerciseHistory,
  exerciseRecords,
  fmt,
  toDisplayWeight,
  percentageChange,
  weeklyWeightComparison,
  weeklyWellnessStats,
} from "../calculations";
function InsightTabs() {
  const { navigate, route } = useApp();
  return (
    <div className="page-tabs">
      {[
        ["progression", "Par exercice"],
        ["global", "Vue globale"],
        ["statistics", "Statistiques"],
        ["records", "Records"],
      ].map(([id, name]) => (
        <button
          key={id}
          onClick={() => navigate(id)}
          className={route === id ? "active" : ""}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
export function Progression() {
  const { state, navigate } = useApp(),
    [exerciseId, setExerciseId] = useState(state.exercises[0]?.id || ""),
    [metric, setMetric] = useState("weight"),
    [period, setPeriod] = useState(90);
  const unit = state.profile.unit,
    exercise = state.exercises.find((e) => e.id === exerciseId),
    all = exerciseHistory(state, exerciseId),
    history = all.filter(
      (x) => !period || x.date >= addDays(today(), -period + 1),
    ),
    records = exerciseRecords(state, exerciseId),
    change = all.length > 1 ? all.at(-1).weight - all[0].weight : null;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CONSTRUIRE SUR VOS ACQUIS"
        title="Votre progression"
        description="Des repères concrets, séance après séance."
      />
      <InsightTabs />
      <Card>
        <div className="form-grid">
          <Field label="Exercice">
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              {state.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Période">
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              {[
                [30, "30 jours"],
                [90, "3 mois"],
                [180, "6 mois"],
                [365, "1 an"],
                [0, "Depuis le début"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
      <div className="grid-3">
        <StatCard
          label="Meilleure charge"
          value={all.length ? fmt(toDisplayWeight(records.weight, unit)) : "—"}
          unit={unit}
          icon="trophy"
        />
        <StatCard
          label="Meilleure série (répétitions)"
          value={all.length ? records.reps : "—"}
          unit="rép."
          icon="activity"
        />
        <StatCard
          label="Depuis le début"
          value={
            change !== null
              ? `${change > 0 ? "+" : ""}${fmt(toDisplayWeight(change, unit))}`
              : "—"
          }
          unit={unit}
          icon="trending-up"
        />
      </div>
      <Card>
        <div className="section-heading">
          <h2>{exercise?.name}</h2>
          <div className="segmented">
            {[
              ["weight", "Charge"],
              ["reps", "Répétitions"],
              ["volume", "Volume"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={metric === id ? "active" : ""}
                onClick={() => setMetric(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <LineChart
          height={270}
          unit={metric === "reps" ? "rép." : unit}
          data={history.map((d) => ({
            label: new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            }),
            value:
              metric === "reps" ? d.reps : toDisplayWeight(d[metric], unit),
          }))}
        />
        <p className="small muted">
          {metric === "weight"
            ? "Charge maximale utilisée par séance. Comparez aussi les répétitions et l’amplitude."
            : metric === "reps"
              ? "Meilleure répétition à la charge maximale de la séance."
              : "Somme de charge × répétitions pour les séries validées de cet exercice."}
        </p>
      </Card>
      <Card>
        <div className="section-heading">
          <h2>Historique des performances</h2>
          <Badge tone="subtle">{history.length} séances</Badge>
        </div>
        {history.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meilleure série à charge max.</th>
                  <th>Séries</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((d) => (
                  <tr key={d.sessionId}>
                    <td>
                      {new Date(d.date + "T12:00:00").toLocaleDateString(
                        "fr-FR",
                      )}
                    </td>
                    <td>
                      {fmt(toDisplayWeight(d.weight, unit))} {unit} × {d.reps}
                    </td>
                    <td>{Array.isArray(d.sets) ? d.sets.length : d.sets}</td>
                    <td>
                      {fmt(toDisplayWeight(d.volume, unit))} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon="trending-up"
            title="Le point de départ vous appartient"
            description="Enregistrez cet exercice pendant une séance pour retrouver ses performances ici."
            action={
              <Button onClick={() => navigate("training")}>
                Ouvrir l’entraînement
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}
export function Statistics() {
  const { state } = useApp(),
    [offset, setOffset] = useState(0);
  const anchor = addDays(today(), offset * 7),
    current = weeklyStats(state, anchor),
    prev = weeklyStats(state, addDays(anchor, -7)),
    wellness = weeklyWellnessStats(state, anchor),
    weightComparison = weeklyWeightComparison(state.weights, anchor),
    unit = state.profile.unit,
    series = Array.from({ length: 8 }, (_, i) => {
      const d = addDays(anchor, -(7 - i) * 7);
      return {
        label: new Date(weekStart(d) + "T12:00:00").toLocaleDateString(
          "fr-FR",
          { day: "numeric", month: "short" },
        ),
        value: toDisplayWeight(weeklyStats(state, d).volume, unit),
      };
    }),
    groups = {
      Pectoraux: 0,
      Dos: 0,
      Épaules: 0,
      Biceps: 0,
      Triceps: 0,
      Jambes: 0,
      Abdominaux: 0,
    };
  Object.entries(current.byMuscle).forEach(([key, val]) => {
    groups[
      ["Quadriceps", "Ischio-jambiers", "Fessiers", "Mollets"].includes(key)
        ? "Jambes"
        : key
    ] =
      (groups[
        ["Quadriceps", "Ischio-jambiers", "Fessiers", "Mollets"].includes(key)
          ? "Jambes"
          : key
      ] || 0) + val;
  });
  const comparison = [
    ["Volume total", current.volume, prev.volume, unit, true],
    ["Séances", current.count, prev.count, "", false],
    ["Séries", current.sets, prev.sets, "", false],
    ["Répétitions", current.reps, prev.reps, "", false],
    [
      "Durée",
      Math.round(current.duration / 60),
      Math.round(prev.duration / 60),
      "min",
      false,
    ],
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="LES CHIFFRES QUI COMPTENT"
        title="Statistiques"
        description="La vue d’ensemble de votre entraînement."
      />
      <InsightTabs />
      <Card className="row between">
        <Button
          variant="ghost"
          aria-label="Semaine précédente"
          onClick={() => setOffset(offset - 1)}
        >
          <Icon name="chevron-left" />
        </Button>
        <strong>
          {offset === 0
            ? "Cette semaine"
            : `Semaine du ${new Date(weekStart(anchor) + "T12:00:00").toLocaleDateString("fr-FR")}`}
        </strong>
        <Button
          variant="ghost"
          aria-label="Semaine suivante"
          disabled={offset === 0}
          onClick={() => setOffset(offset + 1)}
        >
          <Icon name="chevron-right" />
        </Button>
      </Card>
      <div className="grid-4">
        <StatCard
          label="Séances"
          value={current.count}
          unit={`/ ${current.planned}`}
          icon="calendar"
        />
        <StatCard
          label="Séries validées"
          value={current.sets}
          icon="dumbbell"
        />
        <StatCard label="Répétitions" value={current.reps} icon="activity" />
        <StatCard
          label="Durée totale"
          value={Math.round(current.duration / 60)}
          unit="min"
          icon="clock"
        />
      </div>
      <div className="grid-2">
        <Card>
          <h2>Volume sur 8 semaines</h2>
          <LineChart data={series} unit={unit} />
          <p className="small muted">
            Volume = somme des charges × répétitions de chaque série validée.
          </p>
        </Card>
        <Card>
          <h2>Répartition musculaire</h2>
          <p className="small muted">
            Attribution au muscle principal, sans double comptage.
          </p>
          <div className="muscle-bars">
            {Object.entries(groups).map(([muscle, volume]) => (
              <div key={muscle}>
                <div className="row between small">
                  <span>{muscle}</span>
                  <span className="muted">
                    {fmt(toDisplayWeight(volume, unit), 0)} {unit}
                  </span>
                </div>
                <ProgressBar value={volume} max={current.volume || 1} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <h2>Comparaison avec la semaine précédente</h2>
        <p className="small muted">
          Semaines calendaires complètes ; la semaine en cours est encore
          partielle.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Indicateur</th>
                <th>Semaine sélectionnée</th>
                <th>Précédente</th>
                <th>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(([label, a, b, u, convert]) => {
                const delta = percentageChange(a, b);
                return (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>
                      {fmt(convert ? toDisplayWeight(a, unit) : a, 0)} {u}
                    </td>
                    <td>
                      {fmt(convert ? toDisplayWeight(b, unit) : b, 0)} {u}
                    </td>
                    <td>
                      {delta === null ? (
                        <span className="muted">Sans référence</span>
                      ) : (
                        <Badge tone={delta >= 0 ? "accent" : "subtle"}>
                          {delta > 0 ? "+" : ""}
                          {fmt(delta)} %
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid-3">
        <StatCard
          label="Objectif protéines atteint"
          value={current.proteinDays}
          unit="jours / 7"
          icon="utensils"
        />
        <StatCard
          label="Créatine suivie"
          value={current.creatineDays}
          unit="jours / 7"
          icon="pill"
        />
        <StatCard
          label="Hydratation atteinte"
          value={wellness.waterDays}
          unit="jours / 7"
          icon="droplets"
        />
        <StatCard
          label="Sommeil moyen"
          value={
            wellness.averageSleep === null ? "—" : fmt(wellness.averageSleep)
          }
          unit={
            wellness.averageSleep === null
              ? ""
              : `h · ${wellness.sleepDays} nuits`
          }
          icon="moon"
        />
        <StatCard
          label="Variation du poids moyen"
          value={
            weightComparison.change === null
              ? "—"
              : `${weightComparison.change > 0 ? "+" : ""}${fmt(toDisplayWeight(weightComparison.change, unit))}`
          }
          unit={unit}
          icon="scale"
        />
      </div>
    </div>
  );
}
export function Records() {
  const { state, navigate } = useApp(),
    [query, setQuery] = useState("");
  const entries = state.exercises
    .map((e) => ({
      ...e,
      records: exerciseRecords(state, e.id),
      count: exerciseHistory(state, e.id).length,
    }))
    .filter(
      (e) => e.count && e.name.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="VOS REPÈRES PERSONNELS"
        title="Les records sont faits pour évoluer."
        description="Chaque nouvelle référence est une petite victoire."
      />
      <InsightTabs />
      <div className="search-input">
        <Icon name="search" />
        <input
          aria-label="Filtrer les records"
          placeholder="Rechercher un exercice…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {entries.length ? (
        <div className="grid-3">
          {entries.map((e) => (
            <Card className="record-card" key={e.id}>
              <span className="record-icon">
                <Icon name="trophy" size={25} />
              </span>
              <Badge tone="subtle">{e.muscle}</Badge>
              <h2>{e.name}</h2>
              <div className="record-number">
                {fmt(toDisplayWeight(e.records.weight, state.profile.unit))}
                <small>{state.profile.unit}</small>
              </div>
              <span className="muted small">Meilleure charge utilisée</span>
              <div className="record-details">
                <span>
                  <strong>{e.records.reps}</strong>Répétitions max.
                </span>
                <span>
                  <strong>
                    {fmt(
                      toDisplayWeight(e.records.volume, state.profile.unit),
                      0,
                    )}{" "}
                    {state.profile.unit}
                  </strong>
                  Volume max. / séance
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon="trophy"
            title={
              query
                ? "Aucun record pour cette recherche"
                : "Votre premier record vous attend"
            }
            description="Terminez une séance : vos meilleures charges, répétitions et volumes seront enregistrés automatiquement."
            action={
              <Button onClick={() => navigate("training")}>
                Commencer une séance
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
export function GlobalProgress() {
  const { state, navigate } = useApp();
  const unit = state.profile.unit,
    weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)),
    rows = state.exercises
      .map((e) => ({
        name: e.name,
        muscle: e.muscle,
        history: exerciseHistory(state, e.id),
      }))
      .filter((e) => e.history.length);
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="REGARDEZ LE CHEMIN PARCOURU"
        title="Votre progression globale"
        description="Du premier jour à aujourd’hui, vos évolutions réunies."
      />
      <InsightTabs />
      <Card className="global-weight">
        <Icon name="scale" size={26} />
        <div>
          <h2>Poids corporel</h2>
          <span className="muted small">Première pesée → dernière pesée</span>
        </div>
        <div className="global-values">
          <span>
            {weights.length
              ? fmt(toDisplayWeight(weights[0].weight, unit))
              : "—"}
          </span>
          <Icon name="arrow-right" />
          <strong>
            {weights.length
              ? fmt(toDisplayWeight(weights.at(-1).weight, unit))
              : "—"}{" "}
            {unit}
          </strong>
        </div>
      </Card>
      {rows.length ? (
        <div className="grid-2">
          {rows.map((e) => {
            const first = e.history[0],
              last = e.history.at(-1),
              delta = last.weight - first.weight;
            return (
              <Card key={e.name}>
                <div className="section-heading">
                  <Badge tone="subtle">{e.muscle}</Badge>
                  <Badge>
                    {delta > 0 ? "+" : ""}
                    {fmt(toDisplayWeight(delta, unit))} {unit}
                  </Badge>
                </div>
                <h2>{e.name}</h2>
                <div className="global-values">
                  <span>
                    {fmt(toDisplayWeight(first.weight, unit))} {unit} ×{" "}
                    {first.reps}
                  </span>
                  <Icon name="arrow-right" />
                  <strong>
                    {fmt(toDisplayWeight(last.weight, unit))} {unit} ×{" "}
                    {last.reps}
                  </strong>
                </div>
                <LineChart
                  data={e.history.map((h) => ({
                    label: new Date(h.date + "T12:00:00").toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "short" },
                    ),
                    value: toDisplayWeight(h.weight, unit),
                  }))}
                  height={120}
                  unit={unit}
                />
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty
            icon="trending-up"
            title="Construisez votre histoire"
            description="Chaque exercice enregistré apparaîtra ici, avec votre première et votre dernière performance."
            action={
              <Button onClick={() => navigate("training")}>
                Faire une séance
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
