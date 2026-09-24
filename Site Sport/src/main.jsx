import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./context";
import { AuthProvider, useAuth } from "./auth";
import AuthPage from "./AuthPage";
const App = lazy(() => import("./App"));
import "./styles.css";
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Un petit contretemps.</h1>
        <p>
          L’application n’a pas pu afficher cette page. Vos données enregistrées
          sont conservées.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            location.hash = "dashboard";
            location.reload();
          }}
        >
          Revenir à l’accueil
        </button>

      </main>
    ) : (
      this.props.children
    );
  }
}
function Root() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <main className="loading-screen">
        <span className="loading-line" />
        <p>Ouverture de votre espace sécurisé…</p>
      </main>
    );
  if (!auth.user || auth.pendingEmail || auth.recovery || auth.callback) return <AuthPage />;
  return (
    <AppProvider key={auth.user.id}>
      <Suspense fallback={<main className="loading-screen"><p>Chargement de Momentum…</p></main>}><App /></Suspense>
    </AppProvider>
  );
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </ErrorBoundary>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let refreshing = false;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !refreshing) { refreshing = true; location.reload(); }
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((registration) => {
      const announce = () => window.dispatchEvent(new Event("momentum-update-ready"));
      if (registration.waiting) announce();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) announce(); });
      });
      const check = () => { if (document.visibilityState === "visible") registration.update().catch(() => {}); };
      document.addEventListener("visibilitychange", check);
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}
