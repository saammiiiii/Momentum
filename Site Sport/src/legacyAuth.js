const DB_NAME = "momentum-auth";
const ITERATIONS = 310000;
const encoder = new TextEncoder();

const bytesToB64 = (bytes) => {
  let value = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    value += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(value);
};
const b64ToBytes = (value) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const publicUser = (record) => ({
  id: record.id,
  email: record.email,
  username: record.username,
  avatar: record.avatar || "",
  createdAt: record.createdAt,
});

function openAuthDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(
        new Error("Le stockage sécurisé est indisponible dans ce navigateur."),
      );
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("users")) {
        const store = db.createObjectStore("users", { keyPath: "id" });
        store.createIndex("email", "email", { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Impossible d’ouvrir le coffre des comptes."));
    request.onblocked = () =>
      reject(new Error("Fermez les autres onglets Momentum puis réessayez."));
  });
}
async function getByEmail(email) {
  const db = await openAuthDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("users", "readonly"),
      request = tx
        .objectStore("users")
        .index("email")
        .get(normalizeEmail(email));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error("Lecture du compte impossible."));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}
async function derive(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
      material,
      512,
    ),
  );
  return {
    verifier: bytesToB64(bits.slice(0, 32)),
    key: await crypto.subtle.importKey(
      "raw",
      bits.slice(32),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    ),
  };
}
async function aesDecrypt(payload, key) {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
      key,
      b64ToBytes(payload.cipher),
    ),
  );
}
function loginGuard(email, success = false) {
  const key = `momentum.auth-attempts:${normalizeEmail(email)}`;
  if (success) {
    try {
      localStorage.removeItem(key);
    } catch {
      // La connexion reste disponible si le stockage privé du navigateur est restreint.
    }
    return;
  }
  let value;
  try {
    value = JSON.parse(
      localStorage.getItem(key) || '{"count":0,"lockedUntil":0}',
    );
  } catch {
    value = { count: 0, lockedUntil: 0 };
  }
  if (value.lockedUntil > Date.now())
    throw new Error(
      `Trop de tentatives. Réessayez dans ${Math.ceil((value.lockedUntil - Date.now()) / 1000)} secondes.`,
    );
  return { key, value };
}
function recordLoginFailure(guard) {
  if (!guard) return;
  const count = guard.value.count + 1;
  try {
    localStorage.setItem(
      guard.key,
      JSON.stringify({
        count,
        lockedUntil:
          count >= 5 ? Date.now() + Math.min(300000, 30000 * (count - 4)) : 0,
      }),
    );
  } catch {
    // Le contrôle reste facultatif quand localStorage est bloqué.
  }
}
export async function findLegacyAccounts() {
  const db = await openAuthDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("users","readonly"), request = tx.objectStore("users").getAll();
    request.onsuccess = () => resolve(request.result.map(publicUser));
    request.onerror = () => reject(new Error("Lecture des anciens comptes impossible."));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}
export async function unlockLegacy({ email, password, recoveryCode }) {
  const record = await getByEmail(email), guard = loginGuard(email);
  if (!record) { recordLoginFailure(guard); throw new Error("Ancien compte ou identifiant incorrect."); }
  const recovery = Boolean(recoveryCode);
  const derived = await derive(recovery ? String(recoveryCode).trim().toUpperCase() : password,
    b64ToBytes(recovery ? record.recoverySalt : record.passwordSalt));
  if (derived.verifier !== (recovery ? record.recoveryVerifier : record.passwordVerifier)) {
    recordLoginFailure(guard); throw new Error("Ancien mot de passe ou code incorrect.");
  }
  const dataKey = await aesDecrypt(recovery ? record.recoveryWrappedKey : record.wrappedDataKey, derived.key);
  loginGuard(email, true);
  const { loadUserState } = await import("./secureStorage.js");
  const state = await loadUserState(record.id, dataKey);
  if (!state) throw new Error("Aucune donnée enregistrée pour cet ancien compte.");
  return state;
}
