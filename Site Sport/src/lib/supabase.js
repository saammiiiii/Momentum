import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
function isPublicKey(value) {
  if (value?.startsWith("sb_publishable_")) return true;
  try { return JSON.parse(atob(value.split(".")[1])).role === "anon"; } catch { return false; }
}
export const configured = Boolean(url && /^https:\/\//.test(url) && isPublicKey(key));
export const authStorageKey = "momentum.supabase.session";
export const supabase = configured ? createClient(url, key, {
  auth: { storageKey: authStorageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
}) : null;
export function authRedirect(action = "confirm") {
  const redirect = new URL(import.meta.env.BASE_URL, window.location.origin);
  redirect.searchParams.set("auth", action);
  return redirect.href;
}
