import { useState } from 'react';
import { useApp } from '../context';
import { PageHeader, Card, Button, Field, Empty, Modal, ProgressBar, Icon, Badge, LineChart } from '../components';
import { today, addDays, fmt, formatDate, dailyProtein, proteinRemaining, estimateProtein } from '../calculations';

export default function Nutrition() {
  const { state, update, notify, navigate, toggleSupplement } = useApp();
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const total = dailyProtein(state, date);
  const remaining = proteinRemaining(state, date);
  const meals = state.meals.filter(meal => meal.date === date);
  const latestWeight = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weight ?? state.profile.weight;
  const estimate = estimateProtein(latestWeight, state.profile.goal, state.profile.frequency);
  const history = Array.from({ length: 7 }, (_, index) => { const day = addDays(date, index - 6); return { label: formatDate(day, { day: 'numeric', month: 'short' }), value: dailyProtein(state, day), secondary: state.profile.proteinTarget }; });

  function saveMeal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const protein = Number(form.get('protein'));
    const name = String(form.get('name')).trim();
    const quantity = String(form.get('quantity')).trim();
    if (!name || !quantity || !Number.isFinite(protein) || protein < 0 || protein > 600) return notify('Vérifie l’aliment, la quantité et les protéines.', 'error');
    const record = { id: editing.id || crypto.randomUUID(), date, name, quantity, protein };
    update(previous => ({ ...previous, meals: [...previous.meals.filter(item => item.id !== record.id), record] }));
    setEditing(null);
    notify('Aliment enregistré.');
  }

  function saveTarget(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = form.get('mode');
    const target = mode === 'estimate' ? estimate : Number(form.get('target'));
    if (!Number.isFinite(target) || target <= 0 || target > 500) return notify('Choisis un objectif entre 1 et 500 g.', 'error');
    update(previous => ({ ...previous, profile: { ...previous.profile, proteinMode: mode, proteinTarget: target } }));
    setTargetOpen(false);
    notify('Objectif protéines mis à jour.');
  }

  return <div className="page-stack">
    <PageHeader eyebrow="NUTRITION" title="Chaque repas compte." description="Le suivi simple de tes protéines, au fil de la journée."><Button onClick={() => setEditing({ name: '', quantity: '', protein: '' })}><Icon name="plus" /> Ajouter un aliment</Button></PageHeader>
    {!state.profile.trackProtein && <Card><div className="row between"><p className="muted">Le suivi protéines est désactivé dans ton profil.</p><Button variant="secondary" onClick={() => update(previous => ({ ...previous, profile: { ...previous.profile, trackProtein: true } }))}>Activer le suivi</Button></div></Card>}
    <div className="row between"><Field label="Journée"><input aria-label="Journée nutrition" type="date" value={date} max={today()} onChange={event => event.target.value && setDate(event.target.value)} /></Field><Button variant="ghost" onClick={() => setDate(today())}>Aujourd’hui</Button></div>
    <div className="grid-2">
      <Card className="protein-card"><div className="row between"><h2 className="section-title">Ton objectif quotidien</h2><Button variant="ghost" onClick={() => setTargetOpen(true)}><Icon name="sliders" /> Ajuster</Button></div><div className="stat-value">{fmt(total)} <span className="muted small">/ {fmt(state.profile.proteinTarget)} g</span></div><ProgressBar value={total} max={state.profile.proteinTarget} /><div className="row between"><span className="muted small">{fmt(remaining)} g restants</span><Badge>{remaining === 0 ? 'Objectif atteint' : `${Math.round(total / Math.max(1, state.profile.proteinTarget) * 100)} %`}</Badge></div><p className="muted small">{remaining === 0 ? 'Ton objectif est atteint. Un shaker reste facultatif.' : 'Additionne les protéines de tes aliments et de ton éventuel shaker.'}</p></Card>
      <Card><div className="row between"><h2 className="section-title">Les 7 derniers jours</h2><span className="muted small">g / jour</span></div><LineChart data={history} height={165} unit="g" secondaryLabel="Objectif" /></Card>
    </div>
    <Card><div className="row between"><div><h2 className="section-title">Au menu du {formatDate(date)}</h2><p className="muted small">Les protéines correspondent à la portion entière saisie.</p></div><Badge>{meals.length} aliment{meals.length > 1 ? 's' : ''}</Badge></div>
      {meals.length ? meals.map(meal => <div className="list-row" key={meal.id}><div><strong>{meal.name}</strong><p className="muted small">{meal.quantity}{meal.source === 'whey' ? ' · Suivi whey' : ''}</p></div><div className="row"><strong className="accent">{fmt(meal.protein)} g</strong>{meal.source !== 'whey' && <Button variant="ghost" aria-label={`Modifier ${meal.name}`} onClick={() => setEditing(meal)}><Icon name="pencil" /></Button>}<Button variant="ghost" aria-label={`Supprimer ${meal.name}`} onClick={() => { if (meal.source === 'whey') toggleSupplement('whey', date); else update(previous => ({ ...previous, meals: previous.meals.filter(item => item.id !== meal.id) })); notify('Aliment retiré.'); }}><Icon name="trash-2" /></Button></div></div>) : <Empty icon="utensils" title="Une journée à remplir" description="Ajoute ton premier aliment. Les quantités viennent de tes portions et de leurs étiquettes." action={<Button variant="secondary" onClick={() => setEditing({ name: '', quantity: '', protein: '' })}>Ajouter un aliment</Button>} />}
    </Card>
    <div className="grid-2"><Card><div className="row"><Icon name="sparkles" /><h2 className="section-title">En panne d’idées ?</h2></div><p className="muted">Des repas simples, rapides et accessibles pour varier tes sources de protéines.</p><Button variant="secondary" onClick={() => navigate('meals')}>Voir les repas protéinés <Icon name="arrow-right" /></Button></Card><Card><div className="row"><Icon name="glass" /><h2 className="section-title">Ton shaker</h2></div><p className="muted">Le bouton de suivi ajoute automatiquement un seul shaker au journal, lorsque le suivi protéines est activé.</p><Button variant={state.supplements[date]?.whey ? 'secondary' : 'primary'} onClick={() => toggleSupplement('whey', date)}>{state.supplements[date]?.whey ? <><Icon name="check" /> Shaker pris · annuler</> : 'Enregistrer mon shaker'}</Button></Card></div>
    <p className="muted small">L’estimation est un repère général pour adultes, pas une prescription médicale. Elle utilise ton poids, ton objectif et ta fréquence d’entraînement. Taille, âge et sexe sont conservés dans ton profil sans coefficient artificiel. <a href="https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/" target="_blank" rel="noreferrer">Référence : NIH, nutrition sportive</a>.</p>
    {editing && <Modal title={editing.id ? 'Modifier un aliment' : 'Ajouter un aliment'} onClose={() => setEditing(null)}><form onSubmit={saveMeal} className="page-stack"><Field label="Aliment / repas"><input name="name" maxLength={100} defaultValue={editing.name} placeholder="Poulet, skyr, omelette…" required autoFocus /></Field><div className="form-grid"><Field label="Quantité de la portion"><input name="quantity" defaultValue={editing.quantity} maxLength={100} placeholder="150 g, 2 œufs, 1 assiette…" required /></Field><Field label="Protéines de cette portion (g)"><input type="number" inputMode="decimal" name="protein" min="0" max="600" step="0.1" defaultValue={editing.protein} required /></Field></div><p className="muted small">Journée : {formatDate(date)}. Reporte les valeurs de l’étiquette ou une estimation de ta recette.</p><Button type="submit">Enregistrer l’aliment</Button></form></Modal>}
    {targetOpen && <Modal title="Ton objectif protéines" onClose={() => setTargetOpen(false)}><form onSubmit={saveTarget} className="page-stack"><div className="inline-stat"><span className="muted">Estimation actuelle</span><strong>{fmt(estimate)} g / jour</strong></div><Field label="Méthode"><select name="mode" defaultValue={state.profile.proteinMode}><option value="estimate">Utiliser l’estimation générale</option><option value="manual">Définir mon propre objectif</option></select></Field><Field label="Objectif manuel (g / jour)"><input name="target" type="number" min="1" max="500" step="1" defaultValue={Math.round(state.profile.proteinTarget)} required /></Field><p className="muted small">L’estimation n’est pas un conseil médical personnalisé. Tu gardes le contrôle de ton objectif.</p><Button type="submit">Enregistrer l’objectif</Button></form></Modal>}
  </div>;
}
