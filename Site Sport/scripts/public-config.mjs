// Fail before bundling if a server credential was accidentally supplied to Vite.
export function validatePublicConfig(env) {
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
  if (!url && !key) return;
  let validURL = false, publicKey = false;
  try { const parsed = new URL(url); validURL = parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.pathname === "/"; } catch { /* invalid URL */ }
  if (key?.startsWith("sb_publishable_")) publicKey = true;
  else try { publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon"; } catch { /* invalid key */ }
  if (!validURL || !publicKey) throw new Error("Configuration Supabase invalide : utilisez une URL HTTPS de projet et sa clé publique anon/publishable. Aucune clé serveur ne doit être fournie à Vite.");
}
