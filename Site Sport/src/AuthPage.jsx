import React, { useState } from "react";
import { useAuth } from "./auth";
import { Brand, Button, Field, Icon } from "./components";

export default function AuthPage() {
  const auth = useAuth(), [mode, setMode] = useState("login"), [busy, setBusy] = useState(false),
    [error, setError] = useState(""), [message, setMessage] = useState(""), [email, setEmail] = useState("");
  const view = auth.recovery ? "password" : auth.pendingEmail ? "verify" : auth.callback === "error" ? "link-error" : ["success", "password"].includes(auth.callback) ? "success" : mode;
  const changeMode = (next) => { setMode(next); setError(""); setMessage(""); auth.showLogin(); };
  async function run(action) {
    if (busy) return;
    setBusy(true); setError(""); auth.clearError();
    try { await action(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    run(async () => {
      if (["create", "password"].includes(view) && values.password !== values.confirm) throw new Error("Les mots de passe ne correspondent pas.");
      if (view === "create") await auth.create(values);
      else if (view === "password") await auth.reset(values.password);
      else if (view === "forgot") { await auth.forgot(values.email); setMessage("Si cette adresse correspond à un compte, un lien de récupération a été envoyé. Vérifiez votre boîte mail."); }
      else await auth.login(values);
    });
  }
  const titles = { login: "Heureux de vous revoir.", create: "Créer votre compte", forgot: "Mot de passe oublié", password: "Choisir un nouveau mot de passe", verify: "Vérifiez votre adresse e-mail", success: auth.callback === "password" ? "Mot de passe modifié" : "Adresse e-mail confirmée", "link-error": "Ce lien ne peut plus être utilisé" };
  return <main className="auth-screen">
    <section className="auth-brand">
      <Brand /><div className="auth-orbit" aria-hidden="true"><span /><span /><span /></div>
      <h1>Votre progression.<br /><span>Rien qu’à vous.</span></h1>
      <p>Entraînement, nutrition et récupération dans votre espace personnel, sur tous vos appareils.</p>
      <div className="auth-trust"><span><Icon name="shield" />Compte personnel</span><span><Icon name="wifi-off" />Suivi hors ligne</span><span><Icon name="activity" />Pensé pour progresser</span></div>
    </section>
    <section className="auth-panel"><div className="auth-card">
      <div className="eyebrow">ESPACE PERSONNEL</div><h2>{titles[view]}</h2>
      {!auth.configured && <div role="status" className="info-box"><div>
        {import.meta.env.DEV ? <>
          <strong>Configuration Supabase manquante en local.</strong>
          <p>Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local, à côté de package.json, puis redémarrez npm run dev.</p>
          <p>Vous pouvez tester sur localhost sans publier sur GitHub Pages. Consultez docs/LOCAL_SETUP.md pour les étapes.</p>
        </> : <p>Le service de compte est en cours de configuration.</p>}
        <p>Vos anciennes données restent conservées sur cet appareil.</p>
      </div></div>}
      {view === "verify" && <div className="page-stack"><p>Nous avons envoyé un lien de confirmation à <strong>{auth.pendingEmail}</strong>.</p><p className="muted">Vérifiez votre boîte mail pour continuer. Pensez aussi aux courriers indésirables.</p><Button disabled={busy} onClick={() => run(async () => { await auth.resend(auth.pendingEmail); setMessage("Un nouvel e-mail a été demandé. Vérifiez votre boîte mail."); })}>{busy ? "Envoi…" : "Renvoyer l’e-mail"}</Button><Button variant="secondary" onClick={() => changeMode("login")}>Retour à la connexion</Button></div>}
      {view === "success" && <div className="page-stack"><p>Votre compte est prêt. Vous pouvez poursuivre sur Momentum.</p><Button onClick={auth.dismissCallback}>Continuer</Button></div>}
      {view === "link-error" && <div className="page-stack"><p>Demandez un nouveau lien de confirmation ou de récupération depuis la connexion.</p><Button onClick={() => changeMode("login")}>Retour à la connexion</Button></div>}
      {["login", "create", "forgot", "password"].includes(view) && <form onSubmit={submit} className="page-stack">
        {view === "create" && <Field label="Pseudo"><input name="username" autoComplete="nickname" minLength="2" maxLength="40" required /></Field>}
        {view !== "password" && <Field label="Adresse e-mail"><input name="email" type="email" autoComplete="email" maxLength="254" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" /></Field>}
        {view !== "forgot" && <Field label={view === "password" ? "Nouveau mot de passe" : "Mot de passe"} hint={view !== "login" ? "10 caractères minimum, avec une lettre et un chiffre." : undefined}><input name="password" type="password" autoComplete={view === "login" ? "current-password" : "new-password"} minLength={view === "login" ? 1 : 10} maxLength="128" required /></Field>}
        {["create", "password"].includes(view) && <Field label="Confirmer le mot de passe"><input name="confirm" type="password" autoComplete="new-password" required minLength="10" maxLength="128" /></Field>}
        <Button type="submit" disabled={busy || !auth.configured}>{busy ? "Veuillez patienter…" : view === "create" ? "Créer mon compte" : view === "forgot" ? "Envoyer le lien de récupération" : view === "password" ? "Enregistrer le mot de passe" : "Se connecter"}<Icon name="arrow-right" /></Button>
      </form>}
      {(error || auth.error) && <div className="auth-error" role="alert"><Icon name="info" />{error || auth.error}</div>}
      {message && <p role="status" className="info-box">{message}</p>}
      <div className="auth-links">
        {view === "login" ? <><button disabled={busy} onClick={() => changeMode("forgot")}>Mot de passe oublié ?</button><button disabled={busy || !email || !auth.configured} onClick={() => run(async () => { await auth.resend(email); setMessage("Si nécessaire, un e-mail de confirmation a été envoyé."); })}>Renvoyer l’e-mail de confirmation</button><span>Nouveau ici ? <button disabled={busy} onClick={() => changeMode("create")}>Créer un compte</button></span></> : ["create", "forgot"].includes(view) ? <button disabled={busy} onClick={() => changeMode("login")}>Retour à la connexion</button> : null}
      </div><p className="auth-note"><Icon name="info" size={14} />Vos anciennes données pourront être importées après connexion à votre compte vérifié.</p>
    </div></section>
  </main>;
}
