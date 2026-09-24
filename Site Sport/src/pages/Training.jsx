import React, { useEffect, useState } from 'react';
import { sendNotification, useApp } from '../context';
import { Badge, Button, Card, Field, Icon, Modal, PageHeader, ProgressBar } from '../components';
import { exerciseHistory, exerciseRecords, exerciseVolume, fmt, fromDisplayWeight, plannedProgram, round, sessionVolume, toDisplayWeight, today } from '../calculations';

const clock = seconds => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;

export default function Training() {
  const { state, update, notify, navigate } = useApp();
  const [programId, setProgramId] = useState(plannedProgram(state)?.id || state.programs[0]?.id || '');
  const [now, setNow] = useState(Date.now());
  const [discard, setDiscard] = useState(false);
  const [adding, setAdding] = useState('');
  const draft = state.draft;
  const unit = state.profile.unit;
  const weight = value => fmt(toDisplayWeight(value, unit));
  const alterDraft = transform => update(previous => previous.draft ? { ...previous, draft: transform(previous.draft) } : previous);

  useEffect(() => {
    if (!draft) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [!!draft]);

  useEffect(() => {
    if (draft?.timerEnd && now >= draft.timerEnd) {
      alterDraft(current => ({ ...current, timerEnd: null }));
      notify('Repos terminé. Prêt pour la prochaine série ?');
      if ('vibrate' in navigator) navigator.vibrate([160, 80, 160]);
      sendNotification('Repos terminé', 'La prochaine série vous attend.');
    }
  }, [draft?.timerEnd, now]);

  function start() {
    const program = state.programs.find(item => item.id === programId);
    if (!program?.exercises.length) return notify('Ajoutez un exercice à ce programme pour commencer.', 'error');
    const startedAt = new Date().toISOString();
    const exercises = program.exercises.map(entry => {
      const latest = [...state.sessions].sort((a, b) => (b.startedAt || b.date).localeCompare(a.startedAt || a.date)).find(session => session.exercises.some(exercise => exercise.exerciseId === entry.exerciseId));
      const previous = latest?.exercises.find(exercise => exercise.exerciseId === entry.exerciseId)?.sets.filter(set => set.done !== false) || [];
      return { exerciseId: entry.exerciseId, rest: entry.rest, sets: Array.from({ length: entry.sets }, (_, index) => ({ weight: previous[index]?.weight ?? previous[0]?.weight ?? 0, reps: previous[index]?.reps ?? entry.repsMin, done: false })) };
    });
    update(previous => ({ ...previous, draft: { id: crypto.randomUUID(), programId: program.id, name: program.name, date: today(), startedAt, endedAt: '', duration: 0, note: '', exercises, currentIndex: 0, focused: false, timerEnd: null } }));
    setNow(Date.now());
  }

  function editSet(exerciseIndex, setIndex, patch) {
    if (Object.hasOwn(patch, 'weight')) patch.weight = Number.isFinite(patch.weight) ? Math.max(0, Math.min(2000, patch.weight)) : 0;
    if (Object.hasOwn(patch, 'reps')) patch.reps = Number.isFinite(patch.reps) ? Math.max(0, Math.min(1000, Math.trunc(patch.reps))) : 0;
    alterDraft(current => ({ ...current, exercises: current.exercises.map((entry, index) => index === exerciseIndex ? { ...entry, sets: entry.sets.map((set, position) => position === setIndex ? { ...set, ...patch } : set) } : entry) }));
  }

  function validateSet(exerciseIndex, setIndex) {
    const set = draft.exercises[exerciseIndex].sets[setIndex];
    if (!Number.isFinite(set.weight) || set.weight < 0 || !Number.isInteger(set.reps) || set.reps < 1) return notify('Renseignez une charge positive ou nulle et au moins une répétition entière.', 'error');
    const rest = draft.exercises[exerciseIndex].rest || state.profile.restSeconds;
    alterDraft(current => ({ ...current, timerEnd: !set.done && state.profile.autoTimer ? Date.now() + rest * 1000 : current.timerEnd, exercises: current.exercises.map((entry, index) => index === exerciseIndex ? { ...entry, sets: entry.sets.map((item, position) => position === setIndex ? { ...item, done: !set.done } : item) } : entry) }));
  }

  function save() {
    const exercises = draft.exercises.map(entry => ({ ...entry, sets: entry.sets.filter(set => set.done) })).filter(entry => entry.sets.length);
    if (!exercises.length) return notify('Validez au moins une série avant d’enregistrer votre séance.', 'error');
    if (exercises.some(entry => entry.sets.some(set => !Number.isFinite(set.weight) || set.weight < 0 || !Number.isInteger(set.reps) || set.reps < 1))) return notify('Vérifiez les charges et les répétitions des séries validées.', 'error');
    const completed = { ...draft, exercises, endedAt: new Date().toISOString(), duration: Math.max(0, Math.round((Date.now() - new Date(draft.startedAt).getTime()) / 1000)) };
    delete completed.timerEnd;
    delete completed.focused;
    delete completed.currentIndex;
    const records = exercises.filter(entry => {
      const previous = exerciseRecords(state, entry.exerciseId);
      const history = exerciseHistory(state, entry.exerciseId);
      const bestAtMaxWeight = Math.max(0, ...history.filter(item => item.weight === previous.weight).map(item => item.reps));
      return history.length && (entry.sets.some(set => set.weight > previous.weight || (set.weight === previous.weight && set.reps > bestAtMaxWeight) || set.reps > previous.reps) || exerciseVolume(entry) > previous.volume);
    });
    update(previous => previous.draft?.id === completed.id && !previous.sessions.some(session => session.id === completed.id) ? ({ ...previous, draft: null, sessions: [...previous.sessions, completed] }) : previous);
    const wheyReminder = state.reminders.whey.enabled && state.reminders.whey.afterTraining && state.profile.trackWhey && !state.supplements[today()]?.whey;
    const message = records.length ? `Séance enregistrée. Nouveau record sur ${records.length} exercice${records.length > 1 ? 's' : ''} !` : 'Séance enregistrée. Chaque série compte !';
    notify(`${message}${wheyReminder ? ' Votre shaker est-il pris aujourd’hui ?' : ''}`);
    if (wheyReminder && state.reminders.whey.type === 'system') sendNotification('Après votre séance', 'Votre shaker est-il pris aujourd’hui ?');
    navigate('history');
  }

  if (!draft) {
    const selected = state.programs.find(item => item.id === programId);
    const planned = plannedProgram(state);
    return <div className="page-stack">
      <PageHeader eyebrow="À VOTRE RYTHME" title="Entraînement" description="Votre prochaine progression commence par une série." />
      <Card className="start-session-card">
        <div className="row between"><Badge>{planned ? `Aujourd’hui · ${planned.name}` : 'Aujourd’hui · Récupération'}</Badge><Icon name="dumbbell" size={28} /></div>
        <h2>Prêt à commencer ?</h2><p className="muted">Retrouvez vos dernières charges, validez vos séries et concentrez-vous sur le mouvement.</p>
        <Field label="Choisir une séance"><select value={programId} onChange={event => setProgramId(event.target.value)}>{state.programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}</select></Field>
        {selected && <div className="program-preview">{selected.exercises.map((entry, index) => <div className="list-row" key={`${entry.exerciseId}-${index}`}><span>{state.exercises.find(exercise => exercise.id === entry.exerciseId)?.name || 'Exercice'}</span><span className="muted small">{entry.sets} × {entry.repsMin}–{entry.repsMax}</span></div>)}</div>}
        <Button onClick={start} disabled={!selected?.exercises.length}><Icon name="play" /> Commencer la séance</Button>
      </Card>
      <Card><div className="row between"><div><h3>Un programme qui vous ressemble</h3><p className="muted small">Modifiez vos exercices et les jours prévus.</p></div><Button variant="secondary" onClick={() => navigate('program')}>Mon programme <Icon name="arrow-right" /></Button></div></Card>
    </div>;
  }

  const totalSets = draft.exercises.reduce((sum, entry) => sum + entry.sets.length, 0);
  const doneSets = draft.exercises.reduce((sum, entry) => sum + entry.sets.filter(set => set.done).length, 0);
  const currentIndex = Math.min(draft.currentIndex || 0, Math.max(0, draft.exercises.length - 1));
  const remaining = draft.timerEnd ? Math.max(0, Math.ceil((draft.timerEnd - now) / 1000)) : 0;
  const elapsed = Math.floor((now - new Date(draft.startedAt).getTime()) / 1000);

  function renderExercise(entry, index) {
    const exercise = state.exercises.find(item => item.id === entry.exerciseId);
    const history = exerciseHistory(state, entry.exerciseId);
    const previous = history.at(-1);
    const nextSet = entry.sets.findIndex(set => !set.done);
    return <Card className="workout-card" key={`${entry.exerciseId}-${index}`}>
      <div className="row between"><Badge>{exercise?.muscle || 'Exercice'} · {index + 1}/{draft.exercises.length}</Badge><span className="muted small">{entry.sets.filter(set => set.done).length}/{entry.sets.length} séries</span></div>
      <h2>{exercise?.name || 'Exercice personnalisé'}</h2>
      <p className="small muted">{previous ? <>Dernière séance : <strong className="accent">{weight(previous.weight)} {unit} × {previous.reps}</strong></> : 'Première séance · construisez votre point de départ.'}</p>
      <div className="set-grid set-grid-heading"><span>Série</span><span>Charge · {unit}</span><span>Répétitions</span><span>Valider</span></div>
      {entry.sets.map((set, setIndex) => <div className={`set-grid set-row ${set.done ? 'completed' : ''}`} key={setIndex}>
        <span className="set-number">{setIndex + 1}</span>
        <div className="stepper"><button type="button" aria-label={`Diminuer la charge de la série ${setIndex + 1}`} onClick={() => editSet(index, setIndex, { weight: fromDisplayWeight(Math.max(0, round(toDisplayWeight(set.weight, unit) - 2.5, 2)), unit), done: false })}>−</button><input aria-label={`Charge série ${setIndex + 1} en ${unit}`} type="number" min="0" step="0.5" value={round(toDisplayWeight(set.weight, unit), 2)} onChange={event => editSet(index, setIndex, { weight: fromDisplayWeight(Math.max(0, Number(event.target.value)), unit), done: false })} /><button type="button" aria-label={`Augmenter la charge de la série ${setIndex + 1}`} onClick={() => editSet(index, setIndex, { weight: fromDisplayWeight(round(toDisplayWeight(set.weight, unit) + 2.5, 2), unit), done: false })}>+</button></div>
        <div className="stepper"><button type="button" aria-label={`Diminuer les répétitions de la série ${setIndex + 1}`} onClick={() => editSet(index, setIndex, { reps: Math.max(1, set.reps - 1), done: false })}>−</button><input aria-label={`Répétitions série ${setIndex + 1}`} type="number" min="1" step="1" value={set.reps} onChange={event => editSet(index, setIndex, { reps: Math.max(0, Math.trunc(Number(event.target.value))), done: false })} /><button type="button" aria-label={`Augmenter les répétitions de la série ${setIndex + 1}`} onClick={() => editSet(index, setIndex, { reps: set.reps + 1, done: false })}>+</button></div>
        <div className="row set-actions"><Button variant={set.done ? 'primary' : 'secondary'} aria-label={`${set.done ? 'Annuler' : 'Valider'} la série ${setIndex + 1}`} onClick={() => validateSet(index, setIndex)}><Icon name="check" size={17} /></Button><button className="icon-button muted" type="button" aria-label={`Supprimer la série ${setIndex + 1}`} onClick={() => alterDraft(current => ({ ...current, exercises: current.exercises.map((item, position) => position === index ? { ...item, sets: item.sets.filter((_, number) => number !== setIndex) } : item) }))}><Icon name="x" size={16} /></button></div>
      </div>)}
      <div className="row between"><Button variant="ghost" disabled={entry.sets.length >= 100} onClick={() => alterDraft(current => ({ ...current, exercises: current.exercises.map((item, position) => position === index && item.sets.length < 100 ? { ...item, sets: [...item.sets, { weight: item.sets.at(-1)?.weight || 0, reps: item.sets.at(-1)?.reps || exercise?.repsMin || 10, done: false }] } : item) }))}><Icon name="plus" /> Ajouter une série</Button><span className="small muted">Repos : {entry.rest || state.profile.restSeconds} s</span></div>
      {draft.focused && <Button className="validate-set-button" disabled={nextSet < 0} onClick={() => validateSet(index, nextSet)}>{nextSet < 0 ? 'Toutes les séries sont validées' : `VALIDER LA SÉRIE ${nextSet + 1}`} <Icon name="check" /></Button>}
    </Card>;
  }

  return <div className={`page-stack ${draft.focused ? 'gym-mode' : ''}`}>
    <PageHeader eyebrow="SÉANCE EN COURS" title={draft.name} description={`${doneSets}/${totalSets} séries validées · ${clock(elapsed)}`}><Button variant="secondary" onClick={() => alterDraft(current => ({ ...current, focused: !current.focused }))}><Icon name={draft.focused ? 'list' : 'maximize'} /> {draft.focused ? 'Vue complète' : 'Mode salle'}</Button></PageHeader>
    <ProgressBar value={doneSets} max={totalSets || 1} />
    <Card className="timer-card"><div className="row between"><div><span className="small muted">TEMPS DE REPOS</span><div className="timer-digits">{clock(remaining)}</div></div><div className="row"><Field label="Durée du repos"><select value={state.profile.restSeconds} onChange={event => update(previous => ({ ...previous, profile: { ...previous.profile, restSeconds: Number(event.target.value) } }))}>{[60, 90, 120, 180, ...(![60, 90, 120, 180].includes(state.profile.restSeconds) ? [state.profile.restSeconds] : [])].map(value => <option key={value} value={value}>{value} s</option>)}</select></Field><Button variant="secondary" onClick={() => alterDraft(current => ({ ...current, timerEnd: current.timerEnd ? null : Date.now() + state.profile.restSeconds * 1000 }))}><Icon name={draft.timerEnd ? 'x' : 'timer'} /> {draft.timerEnd ? 'Arrêter' : 'Lancer'}</Button></div></div><p className="small muted">Le repos automatique utilise la durée définie pour chaque exercice. Personnalisation dans Paramètres.</p></Card>
    {draft.focused ? <>{renderExercise(draft.exercises[currentIndex], currentIndex)}<div className="row between focus-navigation"><Button variant="secondary" disabled={currentIndex === 0} onClick={() => alterDraft(current => ({ ...current, currentIndex: currentIndex - 1 }))}><Icon name="chevron-left" /> Précédent</Button><Button variant="secondary" disabled={currentIndex >= draft.exercises.length - 1} onClick={() => alterDraft(current => ({ ...current, currentIndex: currentIndex + 1 }))}>Suivant <Icon name="chevron-right" /></Button></div>{draft.exercises[currentIndex + 1] && <p className="muted small">Ensuite : {state.exercises.find(item => item.id === draft.exercises[currentIndex + 1].exerciseId)?.name}</p>}</> : draft.exercises.map(renderExercise)}
    {!draft.focused && <Card><Field label="Ajouter un exercice à cette séance"><div className="row"><select value={adding} onChange={event => setAdding(event.target.value)}><option value="">Choisir un exercice</option>{state.exercises.filter(exercise => !draft.exercises.some(entry => entry.exerciseId === exercise.id)).map(exercise => <option value={exercise.id} key={exercise.id}>{exercise.name}</option>)}</select><Button disabled={!adding} variant="secondary" onClick={() => { const exercise = state.exercises.find(item => item.id === adding); alterDraft(current => ({ ...current, exercises: [...current.exercises, { exerciseId: exercise.id, rest: exercise.rest, sets: Array.from({ length: exercise.sets }, () => ({ weight: 0, reps: exercise.repsMin, done: false })) }] })); setAdding(''); }}><Icon name="plus" /></Button></div></Field></Card>}
    <Card><Field label="Comment vous sentez-vous ?"><textarea rows="2" maxLength="2000" placeholder="Sensations, fatigue, objectif pour la prochaine séance…" value={draft.note} onChange={event => alterDraft(current => ({ ...current, note: event.target.value }))} /></Field><div className="row between"><span className="muted small">Volume validé : {weight(sessionVolume(draft))} {unit} · seules les séries validées seront enregistrées.</span><Button onClick={save}><Icon name="check" /> Terminer et enregistrer</Button></div></Card>
    <Button variant="ghost" onClick={() => setDiscard(true)}>Abandonner le brouillon</Button>
    {discard && <Modal title="Abandonner cette séance ?" onClose={() => setDiscard(false)}><p>Les séries de ce brouillon seront supprimées. Votre historique reste conservé.</p><div className="row"><Button variant="secondary" onClick={() => setDiscard(false)}>Continuer la séance</Button><Button variant="danger" onClick={() => { update(previous => ({ ...previous, draft: null })); setDiscard(false); }}>Abandonner</Button></div></Modal>}
  </div>;
}
