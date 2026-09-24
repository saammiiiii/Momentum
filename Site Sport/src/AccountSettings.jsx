import React, { useState } from "react";
import { useAuth } from "./auth";
import { useApp } from "./context";
import { Card, Button, Field, Badge } from "./components";
import { LegacyMigration } from "./CloudPanel";
import { exportData } from "./storage";
import { downloadFile } from "./notifications";

export default function AccountSettings() {
  const auth = useAuth(), { cache, navigate, notify } = useApp();
  const [busy, setBusy] = useState(false), [backups, setBackups] = useState(null);
  async function run(action) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { notify(error.message, "error"); } finally { setBusy(false); }
  }
  return <Card><div className="page-stack">
    <div className="section-heading"><h2>Compte</h2><Badge>Adresse vérifiée ✓</Badge></div>
    <p>{auth.user.email}</p>
    <div className="row wrap">
      <Button variant="secondary" disabled={busy} onClick={() => run(async () => { await auth.forgot(auth.user.email); notify("Un lien sécurisé de changement de mot de passe a été envoyé par e-mail."); })}>Modifier le mot de passe</Button>
      <Button variant="secondary" onClick={() => navigate("profile")}>Ouvrir mon profil</Button>
      <Button variant="danger" disabled={auth.busy || busy} onClick={auth.logout}>{auth.busy ? "Déconnexion…" : "Se déconnecter"}</Button>
    </div>
    <details><summary>Modifier mon adresse e-mail</summary><form className="page-stack" onSubmit={(event) => {
      event.preventDefault(); const email = new FormData(event.currentTarget).get("email");
      run(async () => { await auth.changeEmail(email); notify("Vérifiez les e-mails envoyés pour confirmer le changement d’adresse."); });
    }}><Field label="Nouvelle adresse e-mail"><input type="email" name="email" required maxLength="254" autoComplete="email" /></Field><Button type="submit" disabled={busy}>Demander le changement</Button></form></details>
    <LegacyMigration manual />
    <Button variant="secondary" disabled={busy} onClick={() => run(async () => setBackups(await cache.backups()))}>Voir mes copies de secours locales</Button>
    {backups && <div className="page-stack">{!backups.length && <p>Aucune copie de secours pour ce compte sur cet appareil.</p>}{backups.map((backup) => <div className="list-row" key={backup.id}><span>{backup.reason}<small>{new Date(backup.createdAt).toLocaleString("fr-FR")}</small></span><Button variant="secondary" onClick={() => run(async () => downloadFile("momentum-secours-" + backup.id + ".json", exportData(backup.state)))}>Exporter cette copie</Button></div>)}</div>}
    <p className="small muted">La déconnexion ferme la session sur cet appareil. Les données et les envois en attente restent conservés pour votre prochaine connexion. Sur un appareil partagé, déconnectez-vous après utilisation.</p>
  </div></Card>;
}
