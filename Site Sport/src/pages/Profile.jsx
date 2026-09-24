import React, { useState } from "react";
import { useApp } from "../context";
import { useAuth } from "../auth";
import {
  PageHeader,
  Card,
  Button,
  Field,
  Icon,
  ProgressBar,
  Badge,
  StatCard,
} from "../components";
import { RANKS, rankStatus, toDisplayWeight, fmt } from "../calculations";
export function RankBadge({ rank, size = "normal" }) {
  return (
    <div
      className={`rank-badge rank-${size}`}
      style={{ "--rank-color": rank.color }}
    >
      <span className="rank-wings">◆</span>
      <strong>{rank.symbol}</strong>
      <small>{rank.name}</small>
    </div>
  );
}
export default function Profile() {
  const { state, update, notify } = useApp(),
    auth = useAuth(),
    status = rankStatus(state),
    [username, setUsername] = useState(auth.user.username),
    [avatar, setAvatar] = useState(auth.user.avatar);
  async function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 650000)
      return notify("Choisissez une image de moins de 650 Ko.", "error");
    if (!file.type.startsWith("image/"))
      return notify("Choisissez un fichier image.", "error");
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  }
  async function save(e) {
    e.preventDefault();
    try {
      await auth.updateProfile({ username, avatar });
      update((s) => ({ ...s, profile: { ...s.profile, firstName: username } }));
      notify("Votre profil est mis à jour.");
    } catch (err) {
      notify(err.message, "error");
    }
  }
  const latest =
    [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
      ?.weight ?? state.profile.weight;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="VOTRE PARCOURS"
        title="Profil & rank"
        description="Votre identité, votre régularité et le chemin déjà parcouru."
      />
      <Card className="profile-hero">
        <div className="profile-avatar">
          {avatar ? (
            <img src={avatar} alt="Photo de profil" />
          ) : (
            <span>{username.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="profile-info">
          <Badge>
            {state.profile.goal === "gain"
              ? "PRISE DE MASSE"
              : state.profile.goal === "lose"
                ? "PERTE DE POIDS"
                : "MAINTIEN"}
          </Badge>
          <h2>{username}</h2>
          <p>{auth.user.email}</p>
          <div className="row wrap">
            <span>
              <Icon name="scale" />
              {fmt(toDisplayWeight(latest, state.profile.unit))}{" "}
              {state.profile.unit}
            </span>
            <span>
              <Icon name="target" />
              {fmt(
                toDisplayWeight(state.profile.targetWeight, state.profile.unit),
              )}{" "}
              {state.profile.unit}
            </span>
            <span>
              <Icon name="dumbbell" />
              {state.sessions.length} séances
            </span>
            <span>
              <Icon name="award" />
              Niveau{" "}
              {RANKS.findIndex((rank) => rank.name === status.rank.name) + 1}
            </span>
          </div>
        </div>
        <RankBadge rank={status.rank} size="large" />
      </Card>
      <div className="grid-4">
        <StatCard
          label="Streak actuel"
          value={status.streak.current}
          unit={status.streak.mode === "complete" ? "jours" : "séances"}
          icon="flame"
        />
        <StatCard
          label="Meilleur streak"
          value={status.streak.best}
          unit={status.streak.mode === "complete" ? "jours" : "séances"}
          icon="trophy"
        />
        <StatCard
          label="Régularité · 7 jours"
          value={status.streak.seven.rate}
          unit="%"
          icon="calendar"
        />
        <StatCard
          label="Régularité · 30 jours"
          value={status.streak.thirty.rate}
          unit="%"
          icon="chart"
        />
      </div>
      <Card className="rank-progress-card">
        <div className="rank-road">
          <RankBadge rank={status.rank} />
          <div>
            <div className="eyebrow">RANK ACTUEL</div>
            <h2>{status.rank.name}</h2>
            <p>
              {status.next
                ? `${status.remaining} points avant ${status.next.name}`
                : "Vous avez atteint le rang maximal."}
            </p>
          </div>
          {status.next && (
            <>
              <Icon name="arrow-right" />
              <RankBadge rank={status.next} />
            </>
          )}
        </div>
        <ProgressBar value={status.progress} />
        <div className="row between small">
          <span>{status.score} points de constance</span>
          <span>
            {status.next
              ? `${Math.round(status.progress)} % vers ${status.next.name}`
              : "100 %"}
          </span>
        </div>
        <p className="small muted">
          Les points combinent vos séances terminées, votre meilleur
          enchaînement de séances prévues et votre régularité récente. Aucune
          activité n’est ajoutée artificiellement.
        </p>
      </Card>
      <Card>
        <h2>Tous les ranks</h2>
        <div className="rank-gallery">
          {RANKS.map((rank) => (
            <div
              key={rank.name}
              className={rank.threshold <= status.score ? "unlocked" : "locked"}
            >
              <RankBadge rank={rank} />
              <span>{rank.threshold} pts</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="section-heading">
          <h2>Ranks atteints</h2>
          <Badge tone="subtle">{state.rankHistory.length}</Badge>
        </div>
        <div className="rank-history">
          {state.rankHistory.length ? (
            [...state.rankHistory].reverse().map((item, index) => (
              <div
                className="list-row"
                key={`${item.rank}-${item.date}-${index}`}
              >
                <Icon name="award" />
                <strong>{item.rank}</strong>
                <span className="muted">
                  {new Date(item.date + "T12:00:00").toLocaleDateString(
                    "fr-FR",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">
              Votre premier rank sera enregistré automatiquement.
            </p>
          )}
        </div>
      </Card>
      <div className="grid-2">
        <Card>
          <h2>Modifier mon profil</h2>
          <form onSubmit={save}>
            <div className="profile-edit-avatar">
              {avatar ? (
                <img src={avatar} alt="Aperçu de la photo" />
              ) : (
                <span>{username.slice(0, 1).toUpperCase()}</span>
              )}
              <label className="btn btn-secondary">
                Choisir une photo
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={choose}
                />
              </label>
              {avatar && (
                <Button variant="ghost" onClick={() => setAvatar("")}>
                  Retirer
                </Button>
              )}
            </div>
            <Field label="Pseudo">
              <input
                value={username}
                minLength="2"
                maxLength="40"
                required
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Button type="submit">Enregistrer le profil</Button>
          </form>
        </Card>
        <Card>
          <h2>Compte sécurisé</h2>
          <div className="account-row">
            <Icon name="shield" />
            <div>
              <strong>Session protégée</strong>
              <p>
                Données chiffrées séparément pour ce compte. La session locale
                expire après 12 heures.
              </p>
            </div>
          </div>
          <div className="account-row">
            <Icon name="wifi-off" />
            <div>
              <strong>Mode local</strong>
              <p>
                L’adaptateur d’authentification est prêt à être remplacé par le
                futur service hébergé.
              </p>
            </div>
          </div>
          <Button variant="danger" onClick={auth.logout}>
            <Icon name="arrow-left" />
            Se déconnecter
          </Button>
        </Card>
      </div>
    </div>
  );
}
