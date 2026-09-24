import React, { useState } from "react";
import { useAuth } from "./auth";
import { Brand, Button, Field, Icon, Modal } from "./components";

export default function AuthPage() {
  const auth = useAuth(),
    [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "create") {
        if (form.get("password") !== form.get("confirm"))
          throw new Error("Les mots de passe ne correspondent pas.");
        await auth.create({
          email: form.get("email"),
          username: form.get("username"),
          password: form.get("password"),
        });
      } else if (mode === "reset")
        await auth.reset({
          email: form.get("email"),
          recoveryCode: form.get("code"),
          newPassword: form.get("password"),
        });
      else
        await auth.login({
          email: form.get("email"),
          password: form.get("password"),
        });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const changeMode = (next) => {
    setMode(next);
    setError("");
  };
  return (
    <main className="auth-screen">
      <section className="auth-brand">
        <Brand />
        <div className="auth-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>
          Votre progression.
          <br />
          <span>Rien qu’à vous.</span>
        </h1>
        <p>
          Entraînement, nutrition et récupération dans un espace personnel
          chiffré sur cet appareil.
        </p>
        <div className="auth-trust">
          <span>
            <Icon name="shield" />
            Données chiffrées
          </span>
          <span>
            <Icon name="wifi-off" />
            Fonctionne hors ligne
          </span>
          <span>
            <Icon name="activity" />
            Pensé pour progresser
          </span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="eyebrow">ESPACE PERSONNEL</div>
          <h2>
            {mode === "create"
              ? "Créer votre compte"
              : mode === "reset"
                ? "Retrouver votre espace"
                : "Heureux de vous revoir."}
          </h2>
          <p className="muted">
            {mode === "create"
              ? "Un profil distinct, vos données séparées."
              : mode === "reset"
                ? "Utilisez le code remis lors de la création du compte."
                : "Connectez-vous pour reprendre là où vous en étiez."}
          </p>
          <form onSubmit={submit} className="page-stack">
            {mode === "create" && (
              <Field label="Pseudo">
                <input
                  name="username"
                  autoComplete="nickname"
                  minLength="2"
                  maxLength="40"
                  required
                  autoFocus
                  placeholder="Votre nom dans Momentum"
                />
              </Field>
            )}
            <Field label="Adresse e-mail">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus={mode !== "create"}
                placeholder="vous@exemple.fr"
              />
            </Field>
            {mode === "reset" && (
              <Field label="Code de récupération">
                <input
                  name="code"
                  autoComplete="off"
                  required
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                />
              </Field>
            )}
            <Field
              label={mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}
            >
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength="10"
                maxLength="128"
                required
              />
              <span className="field-hint">
                10 caractères minimum, avec une lettre et un chiffre.
              </span>
            </Field>
            {mode === "create" && (
              <Field label="Confirmer le mot de passe">
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength="10"
                  required
                />
              </Field>
            )}
            {error && (
              <div className="auth-error" role="alert">
                <Icon name="info" />
                {error}
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? "Ouverture du coffre…"
                : mode === "create"
                  ? "Créer mon compte"
                  : mode === "reset"
                    ? "Réinitialiser mon mot de passe"
                    : "Se connecter"}
              <Icon name="arrow-right" />
            </Button>
          </form>
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <button onClick={() => changeMode("reset")}>
                  Mot de passe oublié ?
                </button>
                <span>
                  Nouveau ici ?{" "}
                  <button onClick={() => changeMode("create")}>
                    Créer un compte
                  </button>
                </span>
              </>
            ) : (
              <button onClick={() => changeMode("login")}>
                <Icon name="arrow-left" size={14} />
                Retour à la connexion
              </button>
            )}
          </div>
          <p className="auth-note">
            <Icon name="info" size={14} />
            Version locale sécurisée : la récupération par e-mail sera activée
            avec le futur serveur. Votre code de récupération fonctionne dès
            maintenant.
          </p>
        </div>
      </section>
      {auth.pendingRecovery && (
        <Modal title="Conservez votre code de récupération" onClose={() => {}}>
          <div className="page-stack">
            <p>
              Ce code est la seule façon de choisir un nouveau mot de passe dans
              la version locale. Il ne sera plus affiché.
            </p>
            <div className="recovery-code">{auth.pendingRecovery}</div>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(auth.pendingRecovery);
                } finally {
                  auth.confirmRecovery();
                }
              }}
            >
              Copier et continuer
            </Button>
            <Button variant="secondary" onClick={auth.confirmRecovery}>
              Je l’ai noté, continuer
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
