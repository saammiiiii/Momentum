import { validateImport } from "./storage.js";
const DB = "momentum-user-data";
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const b64 = (bytes) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};
const bytes = (value) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("profiles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Impossible d’ouvrir les données de ce profil."));
    request.onblocked = () =>
      reject(new Error("Le stockage est bloqué par un autre onglet."));
  });
}
async function keyFrom(raw) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function loadUserState(userId, rawKey) {
  const db = await open();
  const payload = await new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readonly"),
      r = tx.objectStore("profiles").get(userId);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(new Error("Lecture du profil impossible."));
    tx.oncomplete = () => db.close();
  });
  if (!payload) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(payload.iv),
        additionalData: encoder.encode(userId),
      },
      await keyFrom(rawKey),
      bytes(payload.cipher),
    );
    return validateImport(JSON.parse(decoder.decode(plain)));
  } catch (error) {
    throw new Error(
      "Les données chiffrées de ce profil ne peuvent pas être ouvertes. Réessayez avec le bon compte.",
    );
  }
}
export async function saveUserState(state, userId, rawKey) {
  const normalized = validateImport(state),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(userId) },
      await keyFrom(rawKey),
      encoder.encode(JSON.stringify(normalized)),
    ),
    payload = {
      iv: b64(iv),
      cipher: b64(new Uint8Array(cipher)),
      updatedAt: new Date().toISOString(),
    };
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").put(payload, userId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Sauvegarde chiffrée impossible."));
    };
    tx.onabort = tx.onerror;
  });
}
