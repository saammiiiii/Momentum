import React, { useState } from "react";
import { useApp } from "../context";
import {
  PageHeader,
  Card,
  Button,
  Field,
  Icon,
  ProgressBar,
  StatCard,
  LineChart,
  Badge,
  Empty,
} from "../components";
import {
  today,
  addDays,
  formatDate,
  fmt,
  dailyWater,
  waterRemaining,
  averageSleep,
  sleepForDate,
  readiness,
} from "../calculations";

export function Hydration() {
  const { state, update, notify, navigate } = useApp(),
    [date, setDate] = useState(today()),
    total = dailyWater(state, date),
    remaining = waterRemaining(state, date),
    goal = state.profile.waterGoal;
  function add(amount) {
    if (total + amount > 20000)
      return notify(
        "Le total de la journée ne peut pas dépasser 20 L.",
        "error",
      );
    update((s) => ({
      ...s,
      hydration: [
        ...s.hydration,
        {
          id: crypto.randomUUID(),
          date,
          amount,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    notify(
      `${amount >= 1000 ? `${amount / 1000} L` : `${amount} ml`} ajouté${amount >= 1000 ? "" : "s"}.`,
    );
  }
  function undo() {
    const entries = state.hydration
      .filter((e) => e.date === date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!entries.length) return;
    const id = entries.at(-1).id;
    update((s) => ({
      ...s,
      hydration: s.hydration.filter((e) => e.id !== id),
    }));
    notify("Dernier ajout retiré.", "info");
  }
  const history = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(date, i - 13);
    return {
      label: formatDate(day, { day: "numeric", month: "short" }),
      value: dailyWater(state, day) / 1000,
      secondary: goal / 1000,
    };
  });
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="HYDRATATION"
        title="Chaque verre compte."
        description="Un suivi simple, sans interrompre votre journée."
      >
        <Button variant="secondary" onClick={() => navigate("settings")}>
          <Icon name="bell" />
          Régler le rappel
        </Button>
      </PageHeader>
      <div className="row between recovery-date">
        <Field label="Journée">
          <input
            type="date"
            max={today()}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </Field>
        <Button variant="ghost" onClick={() => setDate(today())}>
          Aujourd’hui
        </Button>
      </div>
      <Card className="water-hero">
        <div className="water-gauge">
          <div style={{ "--fill": `${Math.min(100, (total / goal) * 100)}%` }}>
            <Icon name="glass" size={42} />
          </div>
        </div>
        <div className="water-summary">
          <Badge>
            {date === today()
              ? "AUJOURD’HUI"
              : formatDate(date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
          </Badge>
          <div className="water-number">
            {fmt(total / 1000, 2)} <small>L</small>
            <span>/ {fmt(goal / 1000, 2)} L</span>
          </div>
          <ProgressBar value={total} max={goal} />
          <p>
            {remaining > 0
              ? `Encore ${remaining >= 1000 ? `${fmt(remaining / 1000, 2)} L` : `${remaining} ml`} pour atteindre votre objectif.`
              : "Objectif atteint. Votre suivi reste informatif."}
          </p>
        </div>
      </Card>
      <div className="quick-water">
        {[250, 500, 750, 1000].map((amount) => (
          <Button key={amount} variant="secondary" onClick={() => add(amount)}>
            <Icon name="plus" />
            {amount === 1000 ? "1 L" : `${amount} ml`}
          </Button>
        ))}
      </div>
      <div className="grid-3">
        <StatCard
          label="Eau bue"
          value={fmt(total / 1000, 2)}
          unit="L"
          icon="glass"
        />
        <StatCard
          label="Objectif quotidien"
          value={fmt(goal / 1000, 2)}
          unit="L"
          icon="target"
        />
        <StatCard
          label="Restant"
          value={fmt(remaining / 1000, 2)}
          unit="L"
          icon="activity"
        />
      </div>
      <Card>
        <div className="section-heading">
          <div>
            <h2>Les 14 derniers jours</h2>
            <p className="small muted">
              La ligne pointillée représente votre objectif actuel.
            </p>
          </div>
          <Button
            variant="ghost"
            disabled={!state.hydration.some((e) => e.date === date)}
            onClick={undo}
          >
            <Icon name="reset" />
            Annuler le dernier ajout
          </Button>
        </div>
        <LineChart
          data={history}
          height={240}
          unit="L"
          secondaryLabel="Objectif"
        />
      </Card>
      <Card>
        <h2>Journal de la journée</h2>
        {state.hydration.filter((e) => e.date === date).length ? (
          <div className="hydration-log">
            {state.hydration
              .filter((e) => e.date === date)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((entry) => (
                <div className="list-row" key={entry.id}>
                  <span className="resource-icon">
                    <Icon name="glass" />
                  </span>
                  <strong>
                    +{" "}
                    {entry.amount >= 1000
                      ? `${fmt(entry.amount / 1000, 2)} L`
                      : `${entry.amount} ml`}
                  </strong>
                  <span className="muted">
                    {new Date(entry.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label={`Supprimer ${entry.amount} ml`}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        hydration: s.hydration.filter((e) => e.id !== entry.id),
                      }))
                    }
                  >
                    <Icon name="trash-2" />
                  </Button>
                </div>
              ))}
          </div>
        ) : (
          <Empty
            icon="glass"
            title="Votre premier verre de la journée"
            description="Utilisez un raccourci ci-dessus pour commencer le suivi."
          />
        )}
      </Card>
    </div>
  );
}

export function Recovery() {
  const { state, update, notify } = useApp(),
    [date, setDate] = useState(today()),
    [period, setPeriod] = useState(7),
    entry = sleepForDate(state, date),
    ready = readiness(state, today()),
    avg7 = averageSleep(state, 7),
    avg30 = averageSleep(state, 30);
  function save(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      hours = Number(form.get("hours")) + Number(form.get("minutes")) / 60;
    if (!Number.isFinite(hours) || hours < 0 || hours > 24)
      return notify(
        "Indiquez une durée comprise entre 0 et 24 heures.",
        "error",
      );
    const record = {
      id: entry?.id || crypto.randomUUID(),
      date,
      hours,
      quality: form.get("quality"),
      note: String(form.get("note")).trim(),
    };
    update((s) => ({
      ...s,
      sleep: [...s.sleep.filter((x) => x.date !== date), record],
    }));
    notify("Votre nuit est enregistrée.");
  }
  const chart = Array.from({ length: period }, (_, i) => {
    const day = addDays(today(), i - period + 1),
      sleep = sleepForDate(state, day);
    return sleep
      ? {
          label: formatDate(day, { day: "numeric", month: "short" }),
          value: sleep.hours,
          secondary: state.profile.sleepGoal,
        }
      : null;
  }).filter(Boolean);
  const hours = entry ? Math.floor(entry.hours) : 7,
    minutes = entry ? Math.round((entry.hours - hours) * 60) : 30;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="RÉCUPÉRATION"
        title="Écouter le rythme."
        description="Sommeil et habitudes réunis dans un indicateur simple, sans diagnostic médical."
      />
      <div className="grid-2">
        <Card
          className={`readiness-card readiness-${ready.label === "À améliorer" ? "low" : ready.score >= 68 ? "high" : "mid"}`}
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">ÉTAT DU JOUR</div>
              <h2>{ready.label}</h2>
            </div>
            <div className="readiness-score">
              {ready.score}
              <small>/100</small>
            </div>
          </div>
          <ProgressBar value={ready.score} />
          <div className="readiness-parts">
            {ready.parts.map((part) => (
              <div key={part.key}>
                <span>{part.label}</span>
                <strong>{fmt(part.score, 0)} %</strong>
              </div>
            ))}
          </div>
          <p className="small muted">
            Ce score reflète uniquement les informations enregistrées
            aujourd’hui. Il ne mesure pas votre santé ou votre aptitude à vous
            entraîner.
          </p>
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Votre nuit</h2>
            <Field label="Date">
              <input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </Field>
          </div>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Heures">
                <input
                  name="hours"
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  defaultValue={hours}
                  key={`h-${date}-${entry?.id}`}
                />
              </Field>
              <Field label="Minutes">
                <select
                  name="minutes"
                  defaultValue={minutes}
                  key={`m-${date}-${entry?.id}`}
                >
                  {[0, 15, 30, 45].map((value) => (
                    <option key={value} value={value}>
                      {value} min
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Qualité ressentie">
              <select
                name="quality"
                defaultValue={entry?.quality || "good"}
                key={`q-${date}-${entry?.id}`}
              >
                <option value="good">Bonne</option>
                <option value="average">Moyenne</option>
                <option value="bad">Mauvaise</option>
              </select>
            </Field>
            <Field label="Note (facultative)">
              <textarea
                name="note"
                maxLength="500"
                defaultValue={entry?.note || ""}
                key={`n-${date}-${entry?.id}`}
                placeholder="Réveils, sensations au lever…"
              />
            </Field>
            <Button type="submit">
              <Icon name="check" />
              Enregistrer la nuit
            </Button>
          </form>
        </Card>
      </div>
      <div className="grid-3">
        <StatCard
          label="Moyenne sur 7 jours"
          value={avg7 === null ? "—" : formatHours(avg7)}
          icon="moon"
        />
        <StatCard
          label="Moyenne sur 30 jours"
          value={avg30 === null ? "—" : formatHours(avg30)}
          icon="calendar"
        />
        <StatCard
          label="Nuits renseignées"
          value={state.sleep.length}
          icon="check-circle"
        />
      </div>
      <Card>
        <div className="section-heading">
          <div>
            <h2>Votre sommeil</h2>
            <p className="small muted">
              Durées déclarées et objectif personnel.
            </p>
          </div>
          <div className="segmented">
            {[7, 30].map((value) => (
              <button
                key={value}
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value} jours
              </button>
            ))}
          </div>
        </div>
        <LineChart
          data={chart}
          height={250}
          unit="h"
          secondaryLabel="Objectif"
        />
      </Card>
      <Card>
        <h2>Historique récent</h2>
        {state.sleep.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Durée</th>
                  <th>Qualité</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...state.sleep]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 30)
                  .map((item) => (
                    <tr key={item.id}>
                      <td>
                        {formatDate(item.date, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td>
                        <strong>{formatHours(item.hours)}</strong>
                      </td>
                      <td>
                        <Badge
                          tone={item.quality === "good" ? "accent" : "subtle"}
                        >
                          {item.quality === "good"
                            ? "Bonne"
                            : item.quality === "average"
                              ? "Moyenne"
                              : "Mauvaise"}
                        </Badge>
                      </td>
                      <td className="muted">{item.note || "—"}</td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-label={`Supprimer la nuit du ${item.date}`}
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              sleep: s.sleep.filter((x) => x.id !== item.id),
                            }))
                          }
                        >
                          <Icon name="trash-2" />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon="moon"
            title="Une première nuit à renseigner"
            description="Quelques jours suffiront pour afficher une moyenne utile."
          />
        )}
      </Card>
    </div>
  );
}
function formatHours(value) {
  const h = Math.floor(value),
    m = Math.round((value - h) * 60);
  return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}
