import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { createCloudCache } from "../src/lib/cloudCache.js";
import { SyncEngine, equalState, createRemote } from "../src/lib/syncEngine.js";
import { createInitialState } from "../src/data.js";
import { createAuthService, authMessage, passwordPolicy } from "../src/lib/authService.js";

function backend() {
  let state = null, revision = 0;
  return { read: async () => ({ state: structuredClone(state), revision }), write: async (expected, next) => {
    if (expected !== revision) throw new Error("MOMENTUM_CONFLICT");
    state = structuredClone(next); return ++revision;
  } };
}
const engine = (remote, options = {}) => new SyncEngine({ cache: createCloudCache(crypto.randomUUID()), remote, initial: createInitialState, ...options });
test("JSONB key order does not create a false synchronization conflict", () => {
  assert.equal(equalState({ profile: { weight: 72, name: "A" }, entries: [1, 2] }, { entries: [1, 2], profile: { name: "A", weight: 72 } }), true);
  assert.equal(equalState({ entries: [1, 2] }, { entries: [2, 1] }), false);
});
test("remote requests pin the account token and reject a changed identity", async () => {
  let id = "account-A", sentHeader;
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id }, access_token: "fake-token" } } }) },
    rpc: () => ({ setHeader: (name, value) => { sentHeader = [name, value]; return Promise.resolve({ data: { state: null, revision: 0 } }); } }) };
  const remote = createRemote(client, "account-A"); await remote.read();
  assert.deepEqual(sentHeader, ["Authorization", "Bearer fake-token"]);
  id = "account-B"; await assert.rejects(remote.read(), /Session du compte terminée/);
});
test("auth validates before sending and never exposes raw backend errors", async () => {
  let calls = 0;
  const service = createAuthService({ auth: { signUp: async () => { calls++; return { data: {} }; }, signInWithPassword: async () => ({ error: { code: "invalid_credentials", message: "private internal details" } }) } }, () => "https://example.test/?auth=confirm");
  await assert.rejects(service.create({email:"bad",username:"ok",password:"Momentum1234"}));
  await assert.rejects(service.create({email:"fake@example.test",username:"ok",password:"short"}));
  assert.equal(calls,0);
  assert.equal(await service.create({email:" FAKE@EXAMPLE.TEST ",username:"ok",password:"Momentum1234"}),"fake@example.test");
  await assert.rejects(service.login({email:"fake@example.test",password:"wrong"}), /Vérifiez vos informations/);
  assert.match(authMessage({code:"email_not_confirmed"}),/confirmée/);
  assert.match(authMessage({code:"otp_expired"}),/expiré/);
  assert.throws(() => passwordPolicy("abcdefghijk"));
});
test("cache isolates accounts, commits durable pending queue and rejects stale tab writes", async () => {
  const a=createCloudCache(crypto.randomUUID()), b=createCloudCache(crypto.randomUUID());
  const record=await a.write({state:createInitialState(),revision:0,pending:true},0);
  assert.equal((await a.read()).pending,true); assert.equal(await b.read(),null);
  await assert.rejects(a.write({...record,pending:false},0),{code:"LOCAL_CONFLICT"});
  assert.equal((await a.read()).pending,true);
  await a.backup(record.state,"test"); assert.equal((await a.backups()).length,1); assert.equal((await b.backups()).length,0);
});
test("first load reads remote before any upload, network failure cannot overwrite it", async () => {
  const remote=backend(), initial=createInitialState(); initial.profile.firstName="Remote";
  await remote.write(0,initial);
  const app=engine(remote); await app.initialize(); assert.equal(app.record.state.profile.firstName,"Remote");
  const unavailable=engine({read:async()=>{throw new Error("network");},write:()=>assert.fail("must not write")});
  await assert.rejects(unavailable.initialize()); assert.equal(await unavailable.cache.read(),null);
});
test("offline edits survive reload, sync once and appear on another device", async () => {
  const remote=backend(), app=engine(remote,{online:()=>false}); await app.initialize();
  await app.edit(s=>({...s,hydration:[{id:"water",date:"2026-09-24",amount:500,createdAt:"2026-09-24T12:00:00Z"}]}));
  await app.sync(); assert.equal(app.record.pending,true);
  const resumed=engine(remote,{cache:app.cache}); await resumed.initialize(); await resumed.sync();
  assert.equal(resumed.record.pending,false);
  const other=engine(remote); await other.initialize(); assert.equal(other.record.state.hydration[0].amount,500);
  await resumed.sync(); assert.equal((await remote.read()).state.hydration.length,1);
});
test("two devices preserve both versions and require explicit conflict resolution", async () => {
  const remote=backend(), a=engine(remote),b=engine(remote);
  await a.initialize(); await a.sync(); await b.initialize();
  await a.edit(s=>({...s,profile:{...s.profile,firstName:"A"}})); await a.sync();
  await b.edit(s=>({...s,profile:{...s.profile,firstName:"B"}})); await b.sync();
  assert.ok(b.conflict); assert.equal((await remote.read()).state.profile.firstName,"A");
  await b.resolve("local"); assert.equal((await remote.read()).state.profile.firstName,"B");
  assert.equal((await b.cache.backups()).length,2);
});
test("an edit during an upload stays pending and is not lost by acknowledgement", async () => {
  const remote=backend(), app=engine(remote); await app.initialize(); await app.sync();
  const write=remote.write; let release,started;
  const began=new Promise(r=>started=r);
  remote.write=async(...args)=>{started(); await new Promise(r=>release=r); return write(...args);};
  await app.edit(s=>({...s,profile:{...s.profile,firstName:"One"}}));
  const pending=app.sync(); await began;
  await app.edit(s=>({...s,profile:{...s.profile,firstName:"Two"}})); release(); await pending;
  assert.equal(app.record.state.profile.firstName,"Two"); assert.equal(app.record.pending,true);
  remote.write=write; await app.sync(); assert.equal((await remote.read()).state.profile.firstName,"Two");
});
test("lost response after server commit is reconciled without duplicated events", async () => {
  const remote=backend(), write=remote.write, app=engine(remote); await app.initialize();
  remote.write=async(...args)=>{await write(...args);throw new Error("response lost");};
  await app.sync(); assert.equal(app.record.pending,true);
  remote.write=write; await app.sync(); assert.equal(app.record.pending,false); assert.equal(app.conflict,null);
});
