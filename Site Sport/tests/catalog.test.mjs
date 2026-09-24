import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { EXERCISE_CATALOG, extendExerciseLibrary } from "../src/exerciseCatalog.js";
import { createInitialState } from "../src/data.js";
import { validatePublicConfig } from "../scripts/public-config.mjs";
test("50 stable movements have complete metadata and optimized individual illustrations",async()=>{
  const all=Object.values(EXERCISE_CATALOG);assert.equal(all.length,50);
  for(const exercise of all){
    assert.ok(exercise.shortName && exercise.category && exercise.description && exercise.tips.length);
    assert.notEqual(exercise.equipment,"À préciser",exercise.id);
    assert.ok(existsSync(new URL("../public/"+exercise.illustration,import.meta.url)),exercise.id);
    const file=new URL("../public/"+exercise.illustration,import.meta.url);
    const image=await sharp(fileURLToPath(file)).metadata();assert.equal(image.width,960);assert.equal(image.height,720);assert.equal(image.format,"webp");
  }
});
test("library upgrade adds missing IDs without replacing customized exercises or programs",()=>{
  const state=createInitialState();state.exercises=state.exercises.slice(0,14);state.exercises[0].repsMax=20;
  const next=extendExerciseLibrary(state);assert.equal(next.exercises.length,50);assert.equal(next.exercises[0].repsMax,20);assert.deepEqual(next.programs,state.programs);assert.equal(extendExerciseLibrary(next),next);
});
test("build rejects private Supabase credentials and incomplete configuration without printing them",()=>{
  validatePublicConfig({});
  validatePublicConfig({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"sb_publishable_test"});
  for(const key of ["sb_secret_fake","x."+Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")+".x",""])
    assert.throws(()=>validatePublicConfig({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:key}),/Configuration Supabase invalide/);
});
