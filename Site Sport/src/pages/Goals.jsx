import { useState } from 'react';
import { useApp } from '../context';
import { PageHeader, Card, Button, Field, Modal, ProgressBar, Icon, Empty, Badge } from '../components';
import { today, fmt, formatDate, toDisplayWeight, fromDisplayWeight, goalProgress } from '../calculations';

export default function Goals() {
  const { state, update, notify } = useApp();
  const [editing, setEditing] = useState(null);
  const [physicalOpen, setPhysicalOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const entries = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const current = entries.at(-1)?.weight ?? state.profile.weight;
  const start = entries[0]?.weight ?? state.profile.weight;
  const show = value => fmt(toDisplayWeight(value, state.profile.unit));
  const progress = goalProgress(start, current, state.profile.targetWeight);

  function saveGoal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = Number(form.get('target'));
    const currentValue = Number(form.get('current'));
    const title = String(form.get('title')).trim();
    if (!title || !Number.isFinite(target) || target <= 0 || !Number.isFinite(currentValue) || currentValue < 0) return notify('Vérifie le titre et les valeurs de ton objectif.', 'error');
    const goal = { id: editing.id || crypto.randomUUID(), title, target, current: currentValue, unit: String(form.get('unit')).trim(), done: currentValue >= target };
    update(previous => ({ ...previous, goals: [...previous.goals.filter(item => item.id !== goal.id), goal] }));
    setEditing(null);
    notify('Objectif enregistré.');
  }

  function savePhysical(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetWeight = fromDisplayWeight(Number(form.get('targetWeight')), state.profile.unit);
    const startDate = String(form.get('startDate'));
    const targetDate = String(form.get('targetDate'));
    if (!Number.isFinite(targetWeight) || targetWeight < 20 || targetWeight > 500 || !startDate || (targetDate && targetDate < startDate)) return notify('Vérifie le poids cible et l’ordre des dates.', 'error');
    update(previous => ({ ...previous, profile: { ...previous.profile, targetWeight, goal: String(form.get('goal')), startDate, targetDate } }));
    setPhysicalOpen(false);
    notify('Objectif physique mis à jour.');
  }

  return <div className="page-stack">
    <PageHeader eyebrow="CAP SUR LA SUITE" title="Tes objectifs." description="Des repères concrets pour avancer à ton rythme."><Button onClick={() => setEditing({ title: '', target: '', current: 0, unit: 'kg' })}><Icon name="plus" /> Nouvel objectif</Button></PageHeader>
    <Card className="goal-hero"><div className="row between"><div><Badge>Objectif physique</Badge><h2>{state.profile.goal === 'gain' ? 'Construire, progressivement.' : state.profile.goal === 'lose' ? 'Avancer vers mon poids cible.' : 'Trouver mon équilibre.'}</h2></div><Button variant="secondary" onClick={() => setPhysicalOpen(true)}><Icon name="pencil" /> Modifier</Button></div><div className="grid-3"><div><p className="muted small">Poids de départ</p><strong className="stat-value">{show(start)} <span className="small muted">{state.profile.unit}</span></strong></div><div><p className="muted small">Poids actuel</p><strong className="stat-value">{show(current)} <span className="small muted">{state.profile.unit}</span></strong></div><div><p className="muted small">Poids cible</p><strong className="stat-value accent">{show(state.profile.targetWeight)} <span className="small muted">{state.profile.unit}</span></strong></div></div><ProgressBar value={progress} /><div className="row between"><p className="muted small">Départ : {formatDate(state.profile.startDate)}{state.profile.targetDate ? ` · Date cible : ${formatDate(state.profile.targetDate)}` : ''}</p><strong className="accent">{fmt(progress, 0)} %</strong></div><p className="muted small">{state.profile.goal === 'maintain' ? 'En maintien, la stabilité se lit surtout sur la moyenne du poids au fil des semaines.' : 'La progression compare ta première pesée enregistrée à ta dernière pesée et à ton poids cible.'} Cet objectif est personnel et ne constitue pas une recommandation médicale.</p></Card>
    <div className="row between"><h2 className="section-title">Mes défis personnels</h2><span className="muted small">{state.goals.filter(goal => goal.done).length} / {state.goals.length} atteints</span></div>
    {state.goals.length ? <div className="grid-2">{state.goals.map(goal => <Card key={goal.id}><div className="row between"><h3 className="section-title">{goal.title}</h3>{goal.done && <Badge><Icon name="check" size={14} /> Atteint</Badge>}</div><div className="row between"><strong>{fmt(goal.current)} <span className="muted">/ {fmt(goal.target)} {goal.unit}</span></strong><span className="muted small">Saisie manuelle</span></div><ProgressBar value={goalProgress(0, goal.current, goal.target)} /><div className="row between"><Button variant="secondary" onClick={() => setEditing(goal)}>Mettre à jour</Button><Button variant="ghost" aria-label={`Supprimer l’objectif ${goal.title}`} onClick={() => setDeleting(goal)}><Icon name="trash-2" /></Button></div></Card>)}</div> : <Card><Empty icon="target" title="Choisis ton prochain défi" description="Une charge au développé incliné, un nombre de séances, une habitude : définis un objectif mesurable." action={<Button variant="secondary" onClick={() => setEditing({ title: '', target: '', current: 0, unit: 'kg' })}>Créer mon premier objectif</Button>} /></Card>}
    {editing && <Modal title={editing.id ? 'Mettre à jour mon objectif' : 'Créer un objectif'} onClose={() => setEditing(null)}><form onSubmit={saveGoal} className="page-stack"><Field label="Mon objectif"><input name="title" defaultValue={editing.title} placeholder="Développé incliné à 40 kg" maxLength={120} required autoFocus /></Field><div className="form-grid"><Field label="Valeur actuelle"><input type="number" inputMode="decimal" name="current" defaultValue={editing.current} min="0" max="1000000" step="0.1" required /></Field><Field label="Valeur cible"><input type="number" inputMode="decimal" name="target" defaultValue={editing.target} min="0.1" max="1000000" step="0.1" required /></Field></div><Field label="Unité"><input name="unit" defaultValue={editing.unit} maxLength={20} placeholder="kg, séances, répétitions…" /></Field><p className="muted small">Ce défi mesure une valeur qui augmente vers sa cible. Mets-la à jour manuellement ; l’objectif de poids ci-dessus gère aussi la baisse.</p><Button type="submit">Enregistrer l’objectif</Button></form></Modal>}
    {physicalOpen && <Modal title="Mon objectif physique" onClose={() => setPhysicalOpen(false)}><form onSubmit={savePhysical} className="page-stack"><Field label="Objectif sportif"><select name="goal" defaultValue={state.profile.goal}><option value="gain">Prise de masse</option><option value="maintain">Maintien</option><option value="lose">Perte de poids</option></select></Field><Field label={`Poids cible (${state.profile.unit})`}><input name="targetWeight" type="number" min={Math.ceil(toDisplayWeight(20, state.profile.unit) * 10) / 10} max={Math.floor(toDisplayWeight(500, state.profile.unit) * 10) / 10} step="0.1" defaultValue={Math.round(toDisplayWeight(state.profile.targetWeight, state.profile.unit) * 10) / 10} required /></Field><div className="form-grid"><Field label="Date de départ"><input type="date" name="startDate" defaultValue={state.profile.startDate} max={today()} required /></Field><Field label="Date cible (facultative)"><input type="date" name="targetDate" defaultValue={state.profile.targetDate} /></Field></div><Button type="submit">Enregistrer</Button></form></Modal>}
    {deleting && <Modal title="Supprimer cet objectif ?" onClose={() => setDeleting(null)}><p>{deleting.title}</p><div className="row"><Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button><Button variant="danger" onClick={() => { update(previous => ({ ...previous, goals: previous.goals.filter(goal => goal.id !== deleting.id) })); setDeleting(null); notify('Objectif supprimé.'); }}>Supprimer</Button></div></Modal>}
  </div>;
}
