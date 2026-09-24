import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);
const DB_NAME = "momentum-auth";
const SESSION_KEY = "momentum.secure-session.v1";
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
async function transaction(mode, run) {
  const db = await openAuthDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("users", mode),
      store = tx.objectStore("users");
    let result;
    try {
      result = run(store, tx);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result?.value ?? result);
    };
    tx.onerror = () => {
      db.close();
      reject(
        tx.error?.name === "ConstraintError"
          ? new Error("Un compte utilise déjà cette adresse e-mail.")
          : new Error("Le coffre des comptes n’a pas pu être mis à jour."),
      );
    };
    tx.onabort = tx.onerror;
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
async function getById(id) {
  const db = await openAuthDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("users", "readonly"),
      request = tx.objectStore("users").get(id);
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
async function aesEncrypt(bytes, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes),
  );
  return { iv: bytesToB64(iv), cipher: bytesToB64(cipher) };
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
function generateRecovery() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from({ length: 6 }, (_, group) =>
    Array.from(
      { length: 4 },
      (_, i) => alphabet[bytes[group * 4 + i] % alphabet.length],
    ).join(""),
  ).join("-");
}
function passwordPolicy(password) {
  if (
    password.length < 10 ||
    password.length > 128 ||
    !/[A-Za-zÀ-ÿ]/.test(password) ||
    !/[0-9]/.test(password)
  )
    throw new Error(
      "Le mot de passe doit contenir 10 caractères minimum, avec au moins une lettre et un chiffre.",
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
function setSession(user, dataKeyBytes) {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ user, dataKey: bytesToB64(dataKeyBytes), expiresAt }),
  );
  return { user, dataKey: dataKeyBytes, expiresAt };
}

export const localAuthAdapter = {
  async create({ email, username, password }) {
    email = normalizeEmail(email);
    username = String(username || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new Error("Saisissez une adresse e-mail valide.");
    if (username.length < 2 || username.length > 40)
      throw new Error("Le pseudo doit contenir entre 2 et 40 caractères.");
    passwordPolicy(password);
    if (await getByEmail(email))
      throw new Error("Un compte utilise déjà cette adresse e-mail.");
    const id = crypto.randomUUID(),
      passwordSalt = crypto.getRandomValues(new Uint8Array(16)),
      passwordDerived = await derive(password, passwordSalt),
      dataKey = crypto.getRandomValues(new Uint8Array(32)),
      wrappedDataKey = await aesEncrypt(dataKey, passwordDerived.key),
      recoveryCode = generateRecovery(),
      recoverySalt = crypto.getRandomValues(new Uint8Array(16)),
      recoveryDerived = await derive(recoveryCode, recoverySalt),
      recoveryWrappedKey = await aesEncrypt(dataKey, recoveryDerived.key);
    const record = {
      id,
      email,
      username,
      avatar: "",
      createdAt: new Date().toISOString(),
      passwordSalt: bytesToB64(passwordSalt),
      passwordVerifier: passwordDerived.verifier,
      wrappedDataKey,
      recoverySalt: bytesToB64(recoverySalt),
      recoveryVerifier: recoveryDerived.verifier,
      recoveryWrappedKey,
    };
    await transaction("readwrite", (store) => store.add(record));
    return { ...setSession(publicUser(record), dataKey), recoveryCode };
  },
  async login({ email, password }) {
    const guard = loginGuard(email);
    const record = await getByEmail(email);
    if (!record) {
      recordLoginFailure(guard);
      throw new Error("Adresse e-mail ou mot de passe incorrect.");
    }
    const derived = await derive(password, b64ToBytes(record.passwordSalt));
    if (derived.verifier !== record.passwordVerifier) {
      recordLoginFailure(guard);
      throw new Error("Adresse e-mail ou mot de passe incorrect.");
    }
    let dataKey;
    try {
      dataKey = await aesDecrypt(record.wrappedDataKey, derived.key);
    } catch {
      throw new Error("Le coffre de ce compte ne peut pas être déverrouillé.");
    }
    loginGuard(email, true);
    return setSession(publicUser(record), dataKey);
  },
  async restore() {
    let parsed;
    try {
      parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
    if (!parsed || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const record = await getById(parsed.user?.id);
    if (!record) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      user: publicUser(record),
      dataKey: b64ToBytes(parsed.dataKey),
      expiresAt: parsed.expiresAt,
    };
  },
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },
  async reset({ email, recoveryCode, newPassword }) {
    passwordPolicy(newPassword);
    const record = await getByEmail(email);
    if (!record) throw new Error("Compte ou code de récupération incorrect.");
    const recovery = await derive(
      String(recoveryCode || "")
        .trim()
        .toUpperCase(),
      b64ToBytes(record.recoverySalt),
    );
    if (recovery.verifier !== record.recoveryVerifier)
      throw new Error("Compte ou code de récupération incorrect.");
    let dataKey;
    try {
      dataKey = await aesDecrypt(record.recoveryWrappedKey, recovery.key);
    } catch {
      throw new Error("Compte ou code de récupération incorrect.");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16)),
      derived = await derive(newPassword, salt);
    record.passwordSalt = bytesToB64(salt);
    record.passwordVerifier = derived.verifier;
    record.wrappedDataKey = await aesEncrypt(dataKey, derived.key);
    await transaction("readwrite", (store) => store.put(record));
    return setSession(publicUser(record), dataKey);
  },
  async updateProfile(userId, patch) {
    const record = await getById(userId);
    if (!record) throw new Error("Compte introuvable.");
    if (Object.hasOwn(patch, "username")) {
      const value = String(patch.username).trim();
      if (value.length < 2 || value.length > 40)
        throw new Error("Le pseudo doit contenir entre 2 et 40 caractères.");
      record.username = value;
    }
    if (Object.hasOwn(patch, "avatar")) {
      const value = String(patch.avatar || "");
      if (
        value.length > 900000 ||
        (!value.startsWith("data:image/") && value !== "")
      )
        throw new Error("La photo de profil est invalide ou trop volumineuse.");
      record.avatar = value;
    }
    await transaction("readwrite", (store) => store.put(record));
    const user = publicUser(record);
    const current = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (current) {
      current.user = user;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(current));
    }
    return user;
  },
};

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(null),
    [loading, setLoading] = useState(true),
    [pendingRecovery, setPendingRecovery] = useState("");
  useEffect(() => {
    localAuthAdapter
      .restore()
      .then(setSessionState)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!session?.expiresAt) return;
    const timer = setTimeout(
      () => {
        localAuthAdapter.logout();
        setSessionState(null);
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session?.expiresAt]);
  const create = useCallback(async (values) => {
    const result = await localAuthAdapter.create(values);
    setSessionState(result);
    setPendingRecovery(result.recoveryCode);
    return result;
  }, []);
  const login = useCallback(async (values) => {
    const result = await localAuthAdapter.login(values);
    setSessionState(result);
    return result;
  }, []);
  const reset = useCallback(async (values) => {
    const result = await localAuthAdapter.reset(values);
    setSessionState(result);
    return result;
  }, []);
  const logout = useCallback(() => {
    localAuthAdapter.logout();
    setPendingRecovery("");
    setSessionState(null);
  }, []);
  const updateProfile = useCallback(
    async (patch) => {
      const user = await localAuthAdapter.updateProfile(session.user.id, patch);
      setSessionState((s) => ({ ...s, user }));
      return user;
    },
    [session?.user.id],
  );
  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        dataKey: session?.dataKey || null,
        loading,
        create,
        login,
        reset,
        logout,
        updateProfile,
        pendingRecovery,
        confirmRecovery: () => setPendingRecovery(""),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
export const AUTH_ADAPTER_CONTRACT = [
  "create",
  "login",
  "restore",
  "logout",
  "reset",
  "updateProfile",
];
