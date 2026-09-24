import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createInitialState } from "../src/data.js";

test("PostgreSQL migration, complete roundtrip, revision conflict and RLS isolation", async () => {
  const db=new PGlite();
  const a="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile(new URL("../supabase/migrations/202609240001_momentum.sql",import.meta.url),"utf8"));
    await db.query("insert into auth.users values ($1,now(),'{\"username\":\"Alpha\"}'),($2,now(),'{\"username\":\"Beta\"}')",[a,b]);
    const login=async(id)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("set role authenticated");};
    const state=createInitialState(); state.onboardingComplete=true;
    state.sessions=[{id:"old-session",programId:"push",name:"PUSH",date:"2026-09-24",startedAt:"2026-09-24T12:00:00Z",endedAt:"2026-09-24T13:00:00Z",duration:3600,note:"historique",exercises:[{exerciseId:"incline-press",rest:90,sets:[{weight:30,reps:10,done:true}]}]}];
    state.weights=[{id:"old-weight",date:"2026-09-24",weight:72,note:"test"}];
    state.hydration=[{id:"water",date:"2026-09-24",amount:750,createdAt:"2026-09-24T13:00:00Z"}];
    state.sleep=[{id:"sleep",date:"2026-09-24",hours:8,quality:"good",note:""}];
    state.meals=[{id:"meal",date:"2026-09-24",name:"Repas",quantity:"1",protein:30}];
    state.supplements={"2026-09-24":{creatine:true,whey:false,creatineDose:3}};
    state.goals=[{id:"goal",title:"Objectif",target:10,current:1,unit:"séances",done:false}];
    state.rankHistory=[{rank:"Beginner",date:"2026-09-24"}];
    await login(a);
    const saved=(await db.query("select public.momentum_save(0,$1::jsonb) as data",[JSON.stringify(state)])).rows[0].data;
    const actual=(await db.query("select public.momentum_read() as data")).rows[0].data;
    assert.deepEqual(actual.state,state); assert.equal(actual.revision,saved.revision);
    await assert.rejects(db.query("select public.momentum_save(0,$1::jsonb)",[JSON.stringify(state)]),/MOMENTUM_CONFLICT/);
    assert.equal((await db.query("select count(*)::int as n from public.workout_sets")).rows[0].n,1);
    await login(b);
    const tables=["profiles","user_settings","body_metrics","workouts","workout_exercises","workout_sets","nutrition_entries","hydration_entries","sleep_entries","supplement_entries","user_goals","user_programs","user_exercise_preferences"];
    for(const table of tables){
      assert.equal((await db.query(`select count(*)::int as n from public.${table} where user_id=$1`,[a])).rows[0].n,0,table);
      assert.equal((await db.query(`delete from public.${table} where user_id=$1 returning user_id`,[a])).rows.length,0,table);
      assert.equal((await db.query(`update public.${table} set updated_at=now() where user_id=$1 returning user_id`,[a])).rows.length,0,table);
    }
    await assert.rejects(db.query("insert into public.body_metrics(user_id,id,data) values($1,'attack','{}')",[a]),/row-level security/);
    await assert.rejects(db.query("update public.profiles set user_id=$1 where user_id=$2",[a,b]),/row-level security/);
    await assert.rejects(db.query("insert into public.workout_exercises(user_id,workout_id,position,data) values($1,'old-session',0,'{}')",[b]),/foreign key/);
    await db.query("select public.momentum_save(0,$1::jsonb)",[JSON.stringify(createInitialState())]);
    await login(a);
    assert.deepEqual((await db.query("select public.momentum_read() as data")).rows[0].data.state,state);
    await db.query("update public.body_metrics set data=data || '{\"note\":\"direct\"}' where user_id=$1",[a]);
    await assert.rejects(db.query("select public.momentum_save($1,$2::jsonb)",[saved.revision,JSON.stringify(state)]),/MOMENTUM_CONFLICT/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.profiles"),/permission denied/);
    await assert.rejects(db.query("select public.momentum_read()"),/permission denied/);
    await db.exec("reset role");
    const rls=await db.query("select count(*)::int as n from pg_tables where schemaname='public' and rowsecurity");assert.equal(rls.rows[0].n,13);
  } finally { await db.close(); }
});
