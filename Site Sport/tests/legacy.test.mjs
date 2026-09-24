import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { findLegacyAccounts, unlockLegacy } from "../src/legacyAuth.js";
import { saveUserState } from "../src/secureStorage.js";
import { createInitialState } from "../src/data.js";

test("historical encrypted accounts unlock with password or recovery without changing any record",async()=>{
  const encoder=new TextEncoder(), b64=bytes=>Buffer.from(bytes).toString("base64");
  const rawKey=crypto.getRandomValues(new Uint8Array(32));
  const userId=crypto.randomUUID(), email="legacy@example.test";
  async function wrap(password){
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const material=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
    const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:310000},material,512));
    const key=await crypto.subtle.importKey("raw",bits.slice(32),"AES-GCM",false,["encrypt"]);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    return {salt:b64(salt),verifier:b64(bits.slice(0,32)),wrapped:{iv:b64(iv),cipher:b64(new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,rawKey)))}};
  }
  const password=await wrap("OldMomentum123"),recovery=await wrap("ABCD-EFGH-JKLM-NPQR-STUV-WXYZ");
  const record={id:userId,email,username:"Ancien profil",createdAt:"2026-01-01T12:00:00Z",passwordSalt:password.salt,passwordVerifier:password.verifier,wrappedDataKey:password.wrapped,recoverySalt:recovery.salt,recoveryVerifier:recovery.verifier,recoveryWrappedKey:recovery.wrapped};
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("momentum-auth",1);r.onupgradeneeded=()=>r.result.createObjectStore("users",{keyPath:"id"}).createIndex("email","email",{unique:true});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction("users","readwrite");tx.objectStore("users").add(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  const state=createInitialState();state.profile.firstName="Ancien";state.weights=[{id:"old",date:"2026-01-01",weight:70,note:"historique"}];
  await saveUserState(state,userId,rawKey);
  const listed=await findLegacyAccounts();assert.equal(listed.length,1);assert.equal(listed[0].passwordVerifier,undefined);
  assert.deepEqual(await unlockLegacy({email,password:"OldMomentum123"}),state);
  assert.deepEqual(await unlockLegacy({email,recoveryCode:"abcd-efgh-jklm-npqr-stuv-wxyz"}),state);
  await assert.rejects(unlockLegacy({email,password:"WrongPassword123"}),/incorrect/);
  const after=await new Promise(resolve=>{const r=db.transaction("users").objectStore("users").get(userId);r.onsuccess=()=>resolve(r.result);});
  assert.deepEqual(after,record);db.close();
});
