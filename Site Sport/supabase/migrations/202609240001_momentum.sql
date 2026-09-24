-- Apply once using the Supabase SQL editor or CLI. No credentials in this file.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default '' check (length(username) <= 40),
  avatar text not null default '' check (length(avatar) <= 900000),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  data jsonb check (data is null or jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Local IDs are intentionally text: v1 exports did not require UUIDs.
do $$
declare t text;
begin
  foreach t in array array['body_metrics','workouts','nutrition_entries',
    'hydration_entries','sleep_entries','supplement_entries','user_goals',
    'user_programs','user_exercise_preferences'] loop
    execute format('create table public.%I (
      user_id uuid not null references auth.users(id) on delete cascade,
      id text not null check (length(id) between 1 and 200),
      position integer not null default 0 check (position >= 0),
      data jsonb not null check (jsonb_typeof(data) = ''object''),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, id))', t);
  end loop;
end $$;

create table public.workout_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  position integer not null check (position >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_id, position),
  foreign key (user_id, workout_id) references public.workouts(user_id,id) on delete cascade
);
create table public.workout_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  exercise_position integer not null,
  position integer not null check (position >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_id, exercise_position, position),
  foreign key (user_id, workout_id, exercise_position)
    references public.workout_exercises(user_id,workout_id,position) on delete cascade
);

create function public.momentum_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_table_name = 'user_settings' then new.revision := old.revision + 1; end if;
  return new;
end $$;

-- Even direct REST edits invalidate another device's base revision.
create function public.momentum_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.user_settings set updated_at = now()
    where user_id = coalesce(new.user_id, old.user_id);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','user_settings','body_metrics','workouts',
    'workout_exercises','workout_sets','nutrition_entries','hydration_entries',
    'sleep_entries','supplement_entries','user_goals','user_programs','user_exercise_preferences'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.momentum_touch()', t);
    if t <> 'user_settings' then
      execute format('create trigger revision after insert or update or delete on public.%I for each row execute function public.momentum_revision()', t);
    end if;
  end loop;
end $$;

-- Only this auth trigger needs elevated rights; it accepts no caller-supplied ID.
create function public.momentum_confirmed_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.profiles(user_id, username)
      values(new.id, left(coalesce(new.raw_user_meta_data->>'username',''),40))
      on conflict (user_id) do nothing;
    insert into public.user_settings(user_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger momentum_profile after insert or update of email_confirmed_at
  on auth.users for each row execute function public.momentum_confirmed_profile();
insert into public.profiles(user_id,username)
  select id,left(coalesce(raw_user_meta_data->>'username',''),40)
  from auth.users where email_confirmed_at is not null on conflict do nothing;
insert into public.user_settings(user_id)
  select user_id from public.profiles on conflict do nothing;

create function public.momentum_read() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); settings public.user_settings; result jsonb;
  pair text[]; rows jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into settings from public.user_settings where user_id = uid for share;
  if settings.data is null then
    return jsonb_build_object('revision',coalesce(settings.revision,0),'state',null);
  end if;
  result := settings.data || jsonb_build_object('profile',
    (select data from public.profiles where user_id = uid));
  foreach pair slice 1 in array array[
    ['weights','body_metrics'],['meals','nutrition_entries'],
    ['hydration','hydration_entries'],['sleep','sleep_entries'],
    ['goals','user_goals'],['programs','user_programs'],['exercises','user_exercise_preferences']
  ] loop
    execute format('select coalesce(jsonb_agg(data order by position),''[]''::jsonb) from public.%I where user_id=$1',pair[2]) into rows using uid;
    result := result || jsonb_build_object(pair[1],rows);
  end loop;
  result := result || jsonb_build_object('supplements',
    (select coalesce(jsonb_object_agg(id,data),'{}'::jsonb) from public.supplement_entries where user_id=uid));
  result := result || jsonb_build_object('sessions',(
    select coalesce(jsonb_agg(w.data || jsonb_build_object('exercises',(
      select coalesce(jsonb_agg(e.data || jsonb_build_object('sets',(
        select coalesce(jsonb_agg(s.data order by s.position),'[]'::jsonb)
        from public.workout_sets s where s.user_id=uid and s.workout_id=w.id and s.exercise_position=e.position
      )) order by e.position),'[]'::jsonb)
      from public.workout_exercises e where e.user_id=uid and e.workout_id=w.id
    )) order by w.position),'[]'::jsonb) from public.workouts w where w.user_id=uid
  ));
  return jsonb_build_object('revision',settings.revision,'state',result);
end $$;

create function public.momentum_save(expected_revision bigint, document jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); current_revision bigint; pair text[];
  workout record; exercise record;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(document) is distinct from 'object'
    or octet_length(document::text) > 16000000
    or document->>'schemaVersion' is distinct from '2'
    or jsonb_typeof(document->'profile') is distinct from 'object'
    or jsonb_typeof(document->'supplements') is distinct from 'object'
    or not (document ?& array['onboardingComplete','schedule','scheduleTime','exceptions','reminders','draft','rankHistory'])
    or (document - array['schemaVersion','onboardingComplete','profile','exercises','programs','schedule','scheduleTime','exceptions','sessions','weights','meals','supplements','hydration','sleep','rankHistory','goals','reminders','draft']) <> '{}'::jsonb
  then raise exception 'Invalid document' using errcode = '22023'; end if;
  foreach pair slice 1 in array array[
    ['weights','body_metrics'],['meals','nutrition_entries'],['hydration','hydration_entries'],
    ['sleep','sleep_entries'],['goals','user_goals'],['programs','user_programs'],
    ['exercises','user_exercise_preferences'],['sessions','workouts']
  ] loop
    if jsonb_typeof(document->pair[1]) is distinct from 'array' then
      raise exception 'Invalid collection' using errcode = '22023';
    end if;
  end loop;
  insert into public.user_settings(user_id) values(uid) on conflict do nothing;
  select revision into current_revision from public.user_settings where user_id=uid for update;
  if current_revision <> expected_revision then
    raise exception 'MOMENTUM_CONFLICT' using errcode = 'P0001';
  end if;
  insert into public.profiles(user_id,data) values(uid,document->'profile')
    on conflict (user_id) do update set data=excluded.data;
  update public.user_settings set data=document - array['profile','weights','meals','hydration',
    'sleep','goals','programs','exercises','sessions','supplements'] where user_id=uid;
  foreach pair slice 1 in array array[
    ['weights','body_metrics'],['meals','nutrition_entries'],['hydration','hydration_entries'],
    ['sleep','sleep_entries'],['goals','user_goals'],['programs','user_programs'],['exercises','user_exercise_preferences']
  ] loop
    execute format('delete from public.%I where user_id=$1',pair[2]) using uid;
    execute format('insert into public.%I(user_id,id,position,data)
      select $1, value->>''id'', ordinality-1,value from jsonb_array_elements($2) with ordinality',pair[2])
      using uid,document->pair[1];
  end loop;
  delete from public.supplement_entries where user_id=uid;
  insert into public.supplement_entries(user_id,id,data)
    select uid,key,value from jsonb_each(document->'supplements');
  delete from public.workouts where user_id=uid;
  for workout in select value,ordinality-1 as pos from jsonb_array_elements(document->'sessions') with ordinality loop
    insert into public.workouts(user_id,id,position,data)
      values(uid,workout.value->>'id',workout.pos,workout.value-'exercises');
    for exercise in select value,ordinality-1 as pos from jsonb_array_elements(workout.value->'exercises') with ordinality loop
      insert into public.workout_exercises(user_id,workout_id,position,data)
        values(uid,workout.value->>'id',exercise.pos,exercise.value-'sets');
      insert into public.workout_sets(user_id,workout_id,exercise_position,position,data)
        select uid,workout.value->>'id',exercise.pos,ordinality-1,value
        from jsonb_array_elements(exercise.value->'sets') with ordinality;
    end loop;
  end loop;
  return jsonb_build_object('revision',(select revision from public.user_settings where user_id=uid));
end $$;

revoke all on function public.momentum_confirmed_profile() from public,anon,authenticated;
revoke all on function public.momentum_touch() from public,anon,authenticated;
revoke all on function public.momentum_revision() from public,anon,authenticated;
revoke all on function public.momentum_read() from public,anon;
revoke all on function public.momentum_save(bigint,jsonb) from public,anon;
grant execute on function public.momentum_read() to authenticated;
grant execute on function public.momentum_save(bigint,jsonb) to authenticated;
commit;
