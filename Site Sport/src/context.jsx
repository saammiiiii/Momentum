import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createInitialState } from "./data";
import { loadUserState, saveUserState } from "./secureStorage";
import { rankStatus, today } from "./calculations";
import { useAuth } from "./auth";
const AppContext = createContext(null);
export function useApp() {
  return useContext(AppContext);
}
export async function sendNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return false;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration)
      await registration.showNotification(title, {
        body,
        icon: "./icon-192.png",
        tag: title,
      });
    else new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}
export function AppProvider({ children }) {
  const { user, dataKey } = useAuth();
  const [state, setState] = useState(null),
    [loadError, setLoadError] = useState(""),
    [saveStatus, setSaveStatus] = useState("saved"),
    [toast, setToast] = useState(null),
    [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  const queue = useRef(Promise.resolve()),
    loaded = useRef(false),
    toastTimer = useRef(null);
  useEffect(() => {
    let mounted = true;
    loaded.current = false;
    loadUserState(user.id, dataKey)
      .then((value) => {
        if (mounted) {
          const next = value || createInitialState();
          if (!next.profile.firstName) next.profile.firstName = user.username;
          setState(next);
          loaded.current = true;
        }
      })
      .catch((e) => {
        if (mounted)
          setLoadError(e.message || "Impossible de lire les données locales.");
      });
    return () => {
      mounted = false;
    };
  }, [user.id]);
  useEffect(() => {
    const handler = () => {
      setRoute(location.hash.slice(1) || "dashboard");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!state || !loaded.current) return;
    setSaveStatus("saving");
    let current = true;
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveUserState(state, user.id, dataKey))
      .then(() => {
        if (current) setSaveStatus("saved");
      })
      .catch((error) => {
        if (current) {
          setSaveStatus("error");
          setToast({
            message: `Sauvegarde impossible : ${error.message}. Exportez vos données depuis les paramètres.`,
            kind: "error",
          });
        }
      });
    return () => {
      current = false;
    };
  }, [state, user.id]);
  useEffect(() => {
    const warn = (e) => {
      if (saveStatus !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);
  useEffect(() => {
    if (state)
      document.documentElement.dataset.theme = state.profile.theme || "dark";
  }, [state?.profile.theme]);
  useEffect(() => {
    if (!state || !loaded.current) return;
    const rank = rankStatus(state).rank.name;
    if (!state.rankHistory.some((entry) => entry.rank === rank)) {
      if (rank !== "Beginner" && state.rankHistory.length) {
        setToast({
          message: `Nouveau rank débloqué : ${rank} !`,
          kind: "rank",
        });
      }
      setState((previous) => ({
        ...previous,
        rankHistory: [...previous.rankHistory, { rank, date: today() }],
      }));
    }
  }, [state?.sessions.length, state?.rankHistory.length]);
  const notify = useCallback((message, kind = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 6500);
  }, []);
  const update = useCallback(
    (updater) =>
      setState((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      ),
    [],
  );
  const navigate = useCallback((page) => {
    if (location.hash.slice(1) === page) window.scrollTo(0, 0);
    else location.hash = page;
  }, []);
  const toggleSupplement = useCallback((key, date = today()) => {
    setState((prev) => {
      const existing = {
        creatine: false,
        whey: false,
        ...prev.supplements[date],
      };
      const enabled = !existing[key];
      let meals = prev.meals;
      if (key === "whey") {
        meals = meals.filter((m) => !(m.date === date && m.source === "whey"));
        if (enabled && prev.profile.trackProtein)
          meals = [
            ...meals,
            {
              id: crypto.randomUUID(),
              date,
              name: "Shaker de whey",
              quantity: "1 shaker",
              protein: prev.profile.wheyProtein,
              source: "whey",
            },
          ];
      }
      return {
        ...prev,
        meals,
        supplements: {
          ...prev.supplements,
          [date]: {
            ...existing,
            [key]: enabled,
            ...(key === "creatine" && enabled
              ? { creatineDose: prev.profile.creatineDose }
              : {}),
          },
        },
      };
    });
  }, []);
  return (
    <AppContext.Provider
      value={{
        state,
        update,
        notify,
        navigate,
        route,
        saveStatus,
        loadError,
        toggleSupplement,
        toast,
        dismissToast: () => setToast(null),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
