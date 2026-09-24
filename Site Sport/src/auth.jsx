import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase, configured, authRedirect, authStorageKey } from "./lib/supabase";
import { authMessage, createAuthService } from "./lib/authService";

const AuthContext = createContext(null);
const service = createAuthService(supabase, authRedirect);
const callbackURL = new URL(location.href);
const callbackAction = callbackURL.searchParams.get("auth");
const callbackHash = new URLSearchParams(location.hash.slice(1));
const callbackError = callbackURL.searchParams.get("error") || callbackHash.get("error");
const isCallback = Boolean(callbackAction || callbackHash.has("access_token") || callbackError);
const recoveryLink = callbackAction === "recovery" || callbackHash.get("type") === "recovery";
const RECOVERY = "momentum.recovery-user";
const publicUser = (user, profile) => user?.email_confirmed_at ? {
  id: user.id, email: user.email, verified: true,
  username: profile?.username ?? user.user_metadata?.username ?? "",
  avatar: profile?.avatar || "", createdAt: user.created_at,
} : null;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null), [profile, setProfile] = useState(null),
    [loading, setLoading] = useState(true), [busy, setBusy] = useState(false),
    [pendingEmail, setPendingEmail] = useState(""),
    [recovery, setRecovery] = useState(recoveryLink),
    [callback, setCallback] = useState(isCallback ? "loading" : ""),
    [error, setError] = useState("");
  const beforeLogout = useRef(null);
  const user = session?.expires_at * 1000 > Date.now() ? publicUser(session.user, profile) : null;
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    const accept = (event, next) => {
      if (!active) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        try { sessionStorage.setItem(RECOVERY, next.user.id); } catch { /* memory protects this tab */ }
      }
      if (event === "SIGNED_OUT") {
        setProfile(null); setRecovery(false);
        try { sessionStorage.removeItem(RECOVERY); } catch { /* no persisted marker */ }
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(accept);
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!active) return;
      accept("INITIAL_SESSION", data?.session || null);
      if (failure) setError(authMessage(failure));
      try { if (data?.session && sessionStorage.getItem(RECOVERY) === data.session.user.id) setRecovery(true); } catch { /* optional marker */ }
      if (isCallback) {
        const ok = !callbackError && !failure && data?.session?.user?.email_confirmed_at;
        setCallback(ok ? (recoveryLink ? "" : "success") : "error");
        if (!ok) { setRecovery(false); setError("Ce lien est invalide, expiré ou déjà utilisé. Demandez un nouvel e-mail."); }
        if (ok && recoveryLink) {
          setRecovery(true);
          try { sessionStorage.setItem(RECOVERY, data.session.user.id); } catch { /* optional marker */ }
        }
        history.replaceState(null, "", location.pathname);
      }
    }).catch(() => { if (active) { setCallback(isCallback ? "error" : ""); setError("Impossible de restaurer la session. Vérifiez votre connexion."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    setProfile(null);
    if (!session?.user?.email_confirmed_at) return;
    let active = true;
    supabase.from("profiles").select("username,avatar").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => { if (active) setProfile(data); });
    return () => { active = false; };
  }, [session?.user?.id]);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (session.expires_at * 1000 <= Date.now()) {
        setSession(null); setError("Votre session a expiré. Reconnectez-vous ; vos données locales sont conservées.");
      }
    };
    const timer = setTimeout(expire, Math.max(0, session.expires_at * 1000 - Date.now()) + 1000);
    window.addEventListener("online", expire);
    return () => { clearTimeout(timer); window.removeEventListener("online", expire); };
  }, [session]);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await beforeLogout.current?.();
      if (navigator.onLine) await Promise.race([supabase.auth.signOut({ scope: "local" }), new Promise((resolve) => setTimeout(resolve, 5000))]);
      await supabase.auth.stopAutoRefresh();
      localStorage.removeItem(authStorageKey);
      sessionStorage.removeItem(RECOVERY);
      sessionStorage.removeItem("momentum.secure-session.v1");
      setSession(null); setProfile(null); setPendingEmail(""); setCallback("");
      location.replace(location.pathname);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function updateProfile(patch) {
    const username = String(patch.username || "").trim(), avatar = String(patch.avatar || "");
    if (username.length < 2 || username.length > 40) throw new Error("Le pseudo doit contenir entre 2 et 40 caractères.");
    if (avatar.length > 900000 || (avatar && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))) throw new Error("Utilisez une image PNG, JPEG ou WebP de moins de 650 Ko.");
    const { error: failure } = await supabase.from("profiles").update({ username, avatar }).eq("user_id", user.id);
    if (failure) throw new Error("Impossible de modifier le profil. Vérifiez votre connexion.");
    setProfile({ username, avatar });
  }
  return <AuthContext.Provider value={{ session, user, loading, busy, configured, pendingEmail, recovery, callback, error, beforeLogout,
    clearError: () => setError(""),
    dismissCallback: () => { location.hash = "dashboard"; setCallback(""); setError(""); },
    create: async (values) => { const email = await service.create(values); setPendingEmail(email); },
    login: async (values) => { await service.login(values); location.hash = "dashboard"; }, resend: service.resend, forgot: service.forgot, changeEmail: service.changeEmail,
    reset: async (password) => { await service.reset(password); setRecovery(false); try { sessionStorage.removeItem(RECOVERY); } catch { /* no marker */ } setCallback("password"); },
    showLogin: () => { setPendingEmail(""); setCallback(""); setError(""); },
    logout, updateProfile,
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
