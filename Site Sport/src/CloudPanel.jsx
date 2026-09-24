import React, { useEffect, useState } from "react";
import { useApp } from "./context";
import { useAuth } from "./auth";
import { Button, Field, Modal, Icon } from "./components";
import { loadState } from "./storage";

export const syncLabels = {
  loading: "Chargement du compte…", saved: "Données synchronisées", syncing: "Synchronisation…",
  pending: "Modifications enregistrées, en attente d’envoi", offline: "Hors ligne : vos données seront synchronisées au retour de la connexion.",
  error: "Synchronisation indisponible. Vos données restent sur cet appareil.",
  conflict: "Deux copies ont été modifiées. Choisissez celle à conserver.",
  "tab-conflict": "Un autre onglet a modifié le cache. Rechargez cette page.",
};
export default function CloudPanel() {
  const { syncStatus, conflict, synchronize, resolveConflict, notify } = useApp();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const ready = () => setUpdateReady(true);
    navigator.serviceWorker?.getRegistration().then((registration) => { if (registration?.waiting) ready(); });
    window.addEventListener("momentum-update-ready", ready);
    return () => window.removeEventListener("momentum-update-ready", ready);
  }, []);
  async function resolve(choice) {
    setBusy(true);
    try { await resolveConflict(choice); } catch (error) { notify(error.message, "error"); }
    finally { setBusy(false); }
  }
  return <>
    <div className="cloud-status" role="status"><Icon name={syncStatus === "saved" ? "check-circle" : "cloud"} size={16} /><span>{syncLabels[syncStatus]}</span>
      {["pending", "error", "offline"].includes(syncStatus) && <Button variant="ghost" onClick={synchronize}>Réessayer</Button>}
      {syncStatus === "tab-conflict" && <Button variant="ghost" onClick={() => location.reload()}>Recharger</Button>}
    </div>
    {auth.error && <div className="auth-error" role="alert">{auth.error}<Button variant="ghost" onClick={auth.clearError}>Fermer</Button></div>}
    {conflict && <Modal title="Résoudre le conflit de synchronisation" onClose={() => {}}><div className="page-stack">
      <p>Les données de cet appareil et celles du compte ont changé séparément. Aucun envoi ne remplacera l’autre copie sans votre choix.</p>
      <p>Les deux copies seront sauvegardées sur cet appareil et exportables depuis Paramètres. Votre choix concerne l’ensemble du suivi.</p>
      <Button disabled={busy} onClick={() => resolve("local")}>Conserver la copie de cet appareil</Button>
      <Button variant="secondary" disabled={busy || !conflict.state} onClick={() => resolve("remote")}>Utiliser la copie du compte</Button>
    </div></Modal>}
    <LegacyMigration />
    {updateReady && <div className="cloud-status"><span>Une nouvelle version de Momentum est disponible.</span><Button variant="secondary" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await auth.beforeLogout.current?.(); const registration = await navigator.serviceWorker.getRegistration(); registration?.waiting?.postMessage({ type: "SKIP_WAITING" }); }
      catch (error) { notify(error.message, "error"); setBusy(false); }
    }}>Mettre à jour</Button></div>}
  </>;
}

export function LegacyMigration({ manual = false }) {
  const { update, synchronize, cache, notify } = useApp(), { user } = useAuth();
  const [accounts, setAccounts] = useState([]), [oldState, setOldState] = useState(null),
    [open, setOpen] = useState(false), [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false), [preview, setPreview] = useState(null), [error, setError] = useState("");
  const marker = "momentum.migrated:" + user.id;
  useEffect(() => {
    let active = true;
    Promise.all([import("./legacyAuth.js").then((module) => module.findLegacyAccounts()), loadState()])
      .then(([found, legacy]) => {
        if (!active) return;
        setAccounts(found); setOldState(legacy); setSelected(found[0]?.id || "unscoped");
        let done = false; try { done = localStorage.getItem(marker) === "true"; } catch { /* optional hint */ }
        if (!manual && !done && (found.length || legacy)) setOpen(true);
      }).catch(() => { if (active && manual) setError("Impossible de lire les anciennes données. Elles sont conservées ; vous pouvez aussi importer votre sauvegarde JSON."); });
    return () => { active = false; };
  }, [user.id, manual]);
  async function unlock(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const state = selected === "unscoped" ? oldState : await (await import("./legacyAuth.js")).unlockLegacy({ email: accounts.find((a) => a.id === selected).email, ...values });
      if (!state) throw new Error("Aucune donnée trouvée.");
      setPreview(state);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function migrate() {
    setBusy(true); setError("");
    try {
      await cache.backup(preview, "Copie historique avant migration");
      await update(preview, "Avant migration des données historiques");
      await synchronize();
      const saved = await cache.read();
      if (!saved.pending) {
        try { localStorage.setItem(marker, "true"); } catch { /* never delete the source */ }
        notify("Données synchronisées. La copie historique est conservée.");
      } else notify("Copie importée sur cet appareil. La synchronisation reste en attente ; consultez son état en haut de page.", "info");
      setOpen(false); setPreview(null);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <>
    {manual && <Button variant="secondary" onClick={() => setOpen(true)}>Retrouver mes anciennes données locales</Button>}
    {open && <Modal title="Vos données sur cet appareil" onClose={() => { if (!busy) setOpen(false); }}><div className="page-stack">
      <p>Des données Momentum existent sur cet appareil. Voulez-vous les synchroniser avec votre compte ?</p>
      {!preview ? <form onSubmit={unlock} className="page-stack">
        <Field label="Ancienne sauvegarde"><select value={selected} onChange={(e) => setSelected(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.username} — {a.email}</option>)}{oldState && <option value="unscoped">Données historiques sans compte</option>}</select></Field>
        {selected !== "unscoped" && <><Field label="Ancien mot de passe local"><input name="password" type="password" autoComplete="off" /></Field><Field label="Ou ancien code de récupération"><input name="recoveryCode" autoComplete="off" /></Field><p className="small muted">Ces identifiants servent uniquement à déverrouiller la copie locale sur cet appareil.</p></>}
        <Button type="submit" disabled={busy || (!accounts.length && !oldState)}>{busy ? "Déverrouillage…" : "Préparer la synchronisation"}</Button>
      </form> : <><p>La copie contient {preview.sessions.length} séances, {preview.weights.length} pesées et {preview.meals.length} aliments.</p><p>Elle remplacera le suivi actuel de ce compte après synchronisation. Une sauvegarde des données actuelles sera conservée et exportable depuis Paramètres. La copie historique reste intacte.</p><Button disabled={busy} onClick={migrate}>{busy ? "Synchronisation…" : "Synchroniser mes données"}</Button></>}
      {error && <p className="auth-error" role="alert">{error}</p>}<Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Plus tard</Button>
    </div></Modal>}
  </>;
}
