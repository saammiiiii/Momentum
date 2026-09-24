import { validateImport } from "../storage.js";
const DATABASE = "momentum-cloud-cache-v1";
function open() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("Le stockage local est indisponible."));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("accounts");
      request.result.createObjectStore("backups", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Impossible d’ouvrir le cache local."));
    request.onblocked = () => reject(new Error("Fermez les autres onglets puis réessayez."));
  });
}
async function transaction(storeName, mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let result, failure;
    const set = (value) => { result = value; };
    const fail = (error) => { failure = error; tx.abort(); };
    try { operation(tx.objectStore(storeName), set, fail); } catch (error) { fail(error); }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || new Error("Sauvegarde locale impossible. Vérifiez l’espace disponible.")); };
  });
}
export function createCloudCache(userId) {
  if (!userId) throw new Error("Compte requis pour le cache.");
  return {
    async read() {
      const record = await transaction("accounts", "readonly", (store, set) => {
        const request = store.get(userId); request.onsuccess = () => set(request.result || null);
      });
      if (!record) return null;
      if (!Number.isSafeInteger(record.version) || !Number.isSafeInteger(record.revision) || typeof record.pending !== "boolean")
        throw new Error("Le cache local est invalide. Il a été conservé.");
      return { ...record, state: validateImport(record.state) };
    },
    async write(record, expectedVersion) {
      const next = { ...record, state: validateImport(record.state), version: expectedVersion + 1 };
      return transaction("accounts", "readwrite", (store, set, fail) => {
        const request = store.get(userId);
        request.onsuccess = () => {
          if ((request.result?.version || 0) !== expectedVersion) {
            const error = new Error("Un autre onglet a modifié vos données. Rechargez cet onglet avant de continuer.");
            error.code = "LOCAL_CONFLICT"; fail(error); return;
          }
          store.put(next, userId); set(next);
        };
      });
    },
    async backup(state, reason) {
      const backup = { id: crypto.randomUUID(), userId, createdAt: new Date().toISOString(), reason, state: validateImport(state) };
      await transaction("backups", "readwrite", (store) => store.add(backup));
      return backup.id;
    },
    async backups() {
      const all = await transaction("backups", "readonly", (store, set) => { const r = store.getAll(); r.onsuccess = () => set(r.result); });
      return all.filter((item) => item.userId === userId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
