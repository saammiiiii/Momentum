import React, { useState, useEffect } from "react";
import { useApp } from "./context";
import { Brand, Icon, Button, Modal, Empty } from "./components";
import { useReminders } from "./notifications";
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Program from "./pages/Program";
import Exercises from "./pages/Exercises";
import History from "./pages/History";
import Weight from "./pages/Weight";
import Nutrition from "./pages/Nutrition";
import Supplements from "./pages/Supplements";
import Goals from "./pages/Goals";
import { Meals, Advice, Arms, Accessories } from "./pages/Resources";
import {
  Progression,
  Statistics,
  Records,
  GlobalProgress,
} from "./pages/Insights";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import { Hydration, Recovery } from "./pages/Recovery";
import { useAuth } from "./auth";
import Onboarding from "./Onboarding";
const main = [
  ["dashboard", "Vue d’ensemble", "home"],
  ["training", "Entraînement", "dumbbell"],
  ["program", "Programme", "calendar"],
  ["progression", "Progression", "trending-up"],
];
const tracking = [
  ["weight", "Poids", "scale"],
  ["nutrition", "Nutrition", "utensils"],
  ["hydration", "Hydratation", "glass"],
  ["recovery", "Récupération", "moon"],
  ["supplements", "Suppléments", "pill"],
  ["goals", "Objectifs", "target"],
];
const discover = [
  ["exercises", "Exercices", "activity"],
  ["profile", "Profil & rank", "award"],
  ["advice", "Conseils", "book-open"],
  ["accessories", "Accessoires", "grip"],
];
const extra = [
  ["history", "Calendrier & historique", "history"],
  ["statistics", "Statistiques", "chart"],
  ["records", "Records", "trophy"],
  ["global", "Progression globale", "trending-up"],
  ["meals", "Repas protéinés", "utensils"],
  ["arms", "Spécial bras", "dumbbell"],
];
const all = [
  ...main,
  ...tracking,
  ...discover,
  ...extra,
  ["settings", "Paramètres", "settings"],
];
const pages = {
  dashboard: Dashboard,
  training: Training,
  program: Program,
  progression: Progression,
  weight: Weight,
  nutrition: Nutrition,
  hydration: Hydration,
  recovery: Recovery,
  supplements: Supplements,
  goals: Goals,
  exercises: Exercises,
  advice: Advice,
  accessories: Accessories,
  history: History,
  statistics: Statistics,
  records: Records,
  global: GlobalProgress,
  meals: Meals,
  arms: Arms,
  profile: Profile,
  settings: Settings,
};
export default function App() {
  const auth = useAuth();
  const {
    state,
    route,
    navigate,
    saveStatus,
    loadError,
    notify,
    toast,
    dismissToast,
  } = useApp();
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [more, setMore] = useState(false),
    [install, setInstall] = useState(null);
  useReminders(state, notify);
  useEffect(() => {
    const a = () => setOnline(navigator.onLine),
      b = (e) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener("online", a);
    window.addEventListener("offline", a);
    window.addEventListener("beforeinstallprompt", b);
    return () => {
      window.removeEventListener("online", a);
      window.removeEventListener("offline", a);
      window.removeEventListener("beforeinstallprompt", b);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [route]);
  if (loadError)
    return (
      <main className="fatal">
        <Brand />
        <h1>Vos données méritent toute notre attention.</h1>
        <p>{loadError}</p>
        <p>
          La base locale n’a pas été remplacée. Vérifiez l’accès au stockage de
          votre navigateur, puis réessayez.
        </p>
        <Button onClick={() => location.reload()}>Réessayer</Button>
      </main>
    );
  if (!state)
    return (
      <main className="loading-screen">
        <Brand />
        <span className="loading-line" />
        <p>On prépare votre espace.</p>
      </main>
    );
  const Page = pages[route];
  const label = all.find((x) => x[0] === route)?.[1] || "Page introuvable";
  const link = ([id, title, icon]) => (
    <button
      key={id}
      className={`nav-item ${route === id ? "active" : ""}`}
      onClick={() => navigate(id)}
      aria-current={route === id ? "page" : undefined}
    >
      <Icon name={icon} size={19} />
      <span>{title}</span>
      {id === "training" && state.draft && <i className="nav-dot" />}
    </button>
  );
  return (
    <div className="app-shell">
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          href="#dashboard"
          className="brand-link"
          aria-label="Momentum accueil"
        >
          <Brand />
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {auth.user.avatar ? <img src={auth.user.avatar} alt="" /> : (state.profile.firstName || "M").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>Mon espace</strong>
            <small>Un peu plus fort chaque jour</small>
          </div>
          <Icon name="chevron-down" size={14} />
        </div>
        <nav aria-label="Navigation principale">
          <div className="nav-group">
            <div className="nav-caption">ENTRAÎNEMENT</div>
            {main.map(link)}
          </div>
          <div className="nav-group">
            <div className="nav-caption">SUIVI QUOTIDIEN</div>
            {tracking.map(link)}
          </div>
          <div className="nav-group">
            <div className="nav-caption">EXPLORER</div>
            {discover.map(link)}
            <button
              className={`nav-item ${more ? "expanded" : ""}`}
              onClick={() => setMore(!more)}
              aria-expanded={more}
            >
              <Icon name="more" size={19} />
              <span>Plus de ressources</span>
              <Icon name="chevron-down" size={14} />
            </button>
            {more && <div className="extra-nav">{extra.map(link)}</div>}
          </div>
        </nav>
        <div className="sidebar-bottom">
          {install && (
            <button
              className="install-card"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              <Icon name="download" size={20} />
              <span>
                Votre salle, dans la poche<small>Installer l’application</small>
              </span>
              <Icon name="arrow-up-right" size={15} />
            </button>
          )}
          {link(["profile", "Profil & rank", "award"])}
          {link(["settings", "Paramètres", "settings"])}
          <div className="local-status">
            <span
              className={`status-dot ${saveStatus === "error" ? "error" : ""}`}
            />
            {saveStatus === "saving"
              ? "Enregistrement…"
              : saveStatus === "error"
                ? "Sauvegarde à vérifier"
                : "Données sauvegardées en local"}
            <Icon name="shield" size={13} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="row">
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label="Ouvrir le menu"
              onClick={() => setMenu(!menu)}
            >
              <Icon name="menu" />
            </Button>
            <span className="breadcrumb">
              Mon espace
              <Icon name="chevron-right" size={14} />
              <strong>{label}</strong>
            </span>
          </div>
          <div className="row topbar-actions">
            <span className="today-label">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            {!online && (
              <span className="offline-pill">
                <Icon name="wifi-off" size={14} />
                Hors ligne
              </span>
            )}
            <Button
              variant="ghost"
              aria-label="Rechercher une page"
              onClick={() => setSearch(true)}
            >
              <Icon name="search" size={19} />
            </Button>
            <Button
              variant="ghost"
              aria-label="Rappels et notifications"
              onClick={() => navigate("settings")}
            >
              <Icon name="bell" size={19} />
            </Button>
            <button
              className="avatar"
              onClick={() => navigate("profile")}
              aria-label="Mon profil"
            >
              {auth.user.avatar ? <img src={auth.user.avatar} alt="" /> : (state.profile.firstName || "M").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content" key={route}>
          {Page ? (
            <Page />
          ) : (
            <Empty
              title="Cette page n’existe pas"
              action={
                <Button onClick={() => navigate("dashboard")}>
                  Revenir à l’accueil
                </Button>
              }
            />
          )}
        </main>
        <footer className="app-footer">
          <span>Chaque séance compte.</span>
          <span>
            momentum <span className="accent">/</span> votre progression, au
            quotidien
          </span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navigation mobile">
        {[main[0], main[1], main[3], tracking[1]].map(([id, title, icon]) => (
          <button
            key={id}
            className={route === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon name={icon} />
            <span>{id === "dashboard" ? "Accueil" : title}</span>
          </button>
        ))}
        <button className={menu ? "active" : ""} onClick={() => setMenu(!menu)}>
          <Icon name="menu" />
          <span>Menu</span>
        </button>
      </nav>
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          <Icon
            name={
              toast.kind === "error"
                ? "info"
                : toast.kind === "info"
                  ? "bell"
                  : "check-circle"
            }
            size={20}
          />
          <span>{toast.message}</span>
          <button aria-label="Fermer la notification" onClick={dismissToast}>
            <Icon name="x" size={17} />
          </button>
        </div>
      )}
      {saveStatus === "error" && (
        <div className="save-error-banner">
          Sauvegarde locale impossible.{" "}
          <button onClick={() => navigate("settings")}>
            Exporter une copie
          </button>
        </div>
      )}
      {!state.onboardingComplete && <Onboarding />}
      {search && (
        <Modal
          title="Où souhaitez-vous aller ?"
          onClose={() => setSearch(false)}
        >
          <div className="search-input">
            <Icon name="search" />
            <input
              autoFocus
              aria-label="Rechercher une page"
              placeholder="Programme, protéines, records…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="search-results">
            {all
              .filter((x) =>
                x[1]
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .includes(
                    query
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, ""),
                  ),
              )
              .map(([id, title, icon]) => (
                <button
                  key={id}
                  onClick={() => {
                    navigate(id);
                    setSearch(false);
                    setQuery("");
                  }}
                >
                  <Icon name={icon} />
                  {title}
                  <Icon name="arrow-right" size={16} />
                </button>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
