import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createInitialState } from "./data";
import { createCloudCache } from "./lib/cloudCache";
import { SyncEngine, createRemote } from "./lib/syncEngine";
import { supabase } from "./lib/supabase";
import { extendExerciseLibrary } from "./exerciseCatalog";
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
  const { user, beforeLogout } = useAuth();
  const [state, setState] = useState(null), [loadError, setLoadError] = useState(""),
    [saveStatus, setSaveStatus] = useState("saved"), [syncStatus, setSyncStatus] = useState("loading"),
    [conflict, setConflict] = useState(null), [toast, setToast] = useState(null),
    [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  const engine = useRef(null), loaded = useRef(false), toastTimer = useRef(null);
  useEffect(() => {
    let mounted = true;
    const current = new SyncEngine({
      cache: createCloudCache(user.id), remote: createRemote(supabase, user.id),
      initial: () => { const fresh = createInitialState(); fresh.profile.firstName = user.username; return fresh; },
      onState: (value) => { if (mounted) { setState(value); setSaveStatus("saved"); loaded.current = true; } },
      onStatus: (value, incoming) => { if (mounted) { setSyncStatus(value); setConflict(incoming); } },
    });
    engine.current = current;
    current.initialize().then(() => current.sync()).catch(() => {
      if (mounted) setLoadError("Impossible de charger vos données. Vérifiez votre connexion et la configuration du compte, puis réessayez. Aucune copie existante n’a été remplacée.");
    });
    const resume = () => { if (document.visibilityState !== "hidden") current.sync(); };
    const offline = () => setSyncStatus("offline");
    const timer = setInterval(resume, 30000);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    beforeLogout.current = async () => { await current.flush(); if (current.localError) throw current.localError; };
    return () => {
      mounted = false; current.stop(); clearInterval(timer); beforeLogout.current = null;
      window.removeEventListener("online", resume); window.removeEventListener("offline", offline);
      window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume);
    };
  }, [user.id]);
  const update = useCallback((updater, backupReason) => {
    setSaveStatus("saving");
    const current = engine.current;
    const result = current.edit(updater, backupReason).then(() => {
      current.localError = null;
      setSaveStatus("saved");
      current.sync();
    }).catch((error) => {
      current.localError = error;
      setSaveStatus("error");
      setToast({ message: error.message + " Vos données existantes sont conservées.", kind: "error" });
      throw error;
    });
    // Callers may await the result; synchronous UI handlers still get an error toast.
    result.catch(() => {});
    return result;
  }, []);
  useEffect(() => {
    const handler = () => { setRoute(location.hash.slice(1) || "dashboard"); window.scrollTo(0,0); };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    const warn = (event) => { if (saveStatus !== "saved") { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);
  useEffect(() => { if (state) document.documentElement.dataset.theme = state.profile.theme || "dark"; }, [state?.profile.theme]);
  useEffect(() => { if (state && extendExerciseLibrary(state) !== state) update(extendExerciseLibrary); }, [state?.exercises.length]);
  useEffect(() => {
    if (!state || !loaded.current) return;
    const rank = rankStatus(state).rank.name;
    if (!state.rankHistory.some((entry) => entry.rank === rank)) {
      if (rank !== "Beginner" && state.rankHistory.length) setToast({ message: "Nouveau rank débloqué : " + rank + " !", kind: "rank" });
      update((previous) => ({ ...previous, rankHistory: [...previous.rankHistory, { rank, date: today() }] }));
    }
  }, [state?.sessions.length, state?.rankHistory.length]);
  const notify = useCallback((message, kind = "success") => {
    clearTimeout(toastTimer.current); setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 6500);
  }, []);
  const navigate = useCallback((page) => {
    if (location.hash.slice(1) === page) window.scrollTo(0,0); else location.hash = page;
  }, []);
  const toggleSupplement = useCallback((key, date = today()) => {
    update((prev) => {
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

  return <AppContext.Provider value={{
    state, update, notify, navigate, route, saveStatus, loadError, toggleSupplement, toast,
    syncStatus, conflict, synchronize: () => engine.current.sync(),
    resolveConflict: (choice) => engine.current.resolve(choice),
    cache: engine.current?.cache, dismissToast: () => setToast(null),
  }}>{children}</AppContext.Provider>;
}
