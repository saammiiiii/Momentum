import { validateImport } from "../storage.js";
export function equalState(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equalState(a[key], b[key]));
}
export function createRemote(client, userId) {
  async function rpc(name, parameters) {
    const { data } = await client.auth.getSession();
    if (!data.session || data.session.user.id !== userId) throw new Error("Session du compte terminée.");
    // Pin the request identity even if sign-out/account switching races with fetch.
    return client.rpc(name, parameters).setHeader("Authorization", "Bearer " + data.session.access_token);
  }
  return {
    async read() {
      const { data, error } = await rpc("momentum_read");
      if (error) throw error;
      if (!data || !Number.isSafeInteger(data.revision)) throw new Error("Réponse de synchronisation invalide.");
      return { revision: data.revision, state: data.state ? validateImport(data.state) : null };
    },
    async write(revision, state) {
      const { data, error } = await rpc("momentum_save", { expected_revision: revision, document: validateImport(state) });
      if (error) throw error;
      if (!Number.isSafeInteger(data?.revision)) throw new Error("Réponse de synchronisation invalide.");
      return data.revision;
    },
  };
}

// The durable queue is one pending snapshot. Network requests never block local edits.
export class SyncEngine {
  constructor({ cache, remote, initial, onState = () => {}, onStatus = () => {}, online = () => globalThis.navigator?.onLine !== false }) {
    Object.assign(this, { cache, remote, initial, onState, onStatus, online });
    this.record = null; this.queue = Promise.resolve(); this.conflict = null; this.stopped = false;
  }
  serial(action) {
    const next = this.queue.then(action);
    this.queue = next.catch(() => {});
    return next;
  }
  async initialize() {
    this.record = await this.cache.read();
    if (!this.record) {
      const remote = await this.remote.read();
      this.record = await this.cache.write({ state: remote.state || this.initial(), revision: remote.revision, pending: !remote.state }, 0);
    }
    this.onState(this.record.state);
    this.status(this.record.pending ? "pending" : "saved");
  }
  status(value) { if (!this.stopped) this.onStatus(value, this.conflict); }
  async commit(patch, emit = true) {
    this.record = await this.cache.write({ ...this.record, ...patch }, this.record.version);
    if (emit && !this.stopped) this.onState(this.record.state);
  }
  edit(updater, backupReason) {
    return this.serial(async () => {
      const state = validateImport(typeof updater === "function" ? updater(this.record.state) : updater);
      if (equalState(state, this.record.state)) return;
      if (backupReason) await this.cache.backup(this.record.state, backupReason);
      await this.commit({ state, pending: true });
      this.status(this.conflict ? "conflict" : this.online() ? "pending" : "offline");
    });
  }
  async sync() {
    if (this.stopped || !this.record || this.running || this.conflict) return;
    if (!this.online()) { this.status("offline"); return; }
    this.running = true; this.status("syncing");
    try {
      await this.queue;
      const remote = await this.remote.read();
      if (this.stopped) return;
      let upload;
      await this.serial(async () => {
        // A second tab may have saved while this request was in flight.
        const disk = await this.cache.read();
        if (disk.version !== this.record.version) {
          this.record = disk; this.onState(disk.state);
        }
        if (this.record.pending) {
          if (remote.state && equalState(remote.state, this.record.state)) {
            await this.commit({ revision: remote.revision, pending: false });
          } else if (remote.revision !== this.record.revision) {
            this.conflict = remote;
          } else upload = this.record;
        } else if (remote.revision !== this.record.revision) {
          if (!remote.state) { this.conflict = remote; return; }
          await this.commit({ state: remote.state, revision: remote.revision, pending: false });
        }
      });
      if (upload && !this.stopped) {
        const revision = await this.remote.write(upload.revision, upload.state);
        await this.serial(async () => {
          await this.commit({ revision, pending: !equalState(this.record.state, upload.state) }, false);
        });
      }
      this.status(this.conflict ? "conflict" : this.record.pending ? "pending" : "saved");
    } catch (error) {
      if (error?.message?.includes("MOMENTUM_CONFLICT")) {
        try { this.conflict = await this.remote.read(); this.status("conflict"); }
        catch { this.status("error"); }
      } else this.status(error?.code === "LOCAL_CONFLICT" ? "tab-conflict" : this.online() ? "error" : "offline");
    } finally { this.running = false; }
  }
  async resolve(choice) {
    if (!this.conflict) return;
    await this.serial(async () => {
      const remote = this.conflict;
      await this.cache.backup(this.record.state, "Avant résolution du conflit — appareil");
      if (remote.state) await this.cache.backup(remote.state, "Avant résolution du conflit — compte");
      if (choice === "remote" && !remote.state) throw new Error("Aucune copie distante disponible.");
      await this.commit({ state: choice === "remote" ? remote.state : this.record.state, revision: remote.revision, pending: choice !== "remote" });
      this.conflict = null;
    });
    await this.sync();
  }
  async flush() { await this.queue; }
  stop() { this.stopped = true; }
}
