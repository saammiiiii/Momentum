import React from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./context";
import { AuthProvider, useAuth } from "./auth";
import AuthPage from "./AuthPage";
import App from "./App";
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
        <details>
          <summary>Détail de l’erreur</summary>
          {String(this.state.error)}
        </details>
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
  if (!auth.user || auth.pendingRecovery) return <AuthPage />;
  return (
    <AppProvider key={auth.user.id}>
      <App />
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
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) =>
        console.warn("Mode hors connexion indisponible", error),
      ),
  );
