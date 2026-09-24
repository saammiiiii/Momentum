import { useState } from 'react';
import { useApp } from '../context';
import { PageHeader, Card, Button, Field, Empty, Modal, LineChart, StatCard, ProgressBar, Icon } from '../components';
import { today, fmt, formatDate, weightSeries, weightChange, toDisplayWeight, fromDisplayWeight, goalProgress } from '../calculations';

const periods = [[7, '7 jours'], [30, '30 jours'], [90, '3 mois'], [180, '6 mois'], [365, '1 an'], [0, 'Tout']];

export default function Weight() {
  const { state, update, notify, navigate } = useApp();
  const [period, setPeriod] = useState(30);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const unit = state.profile.unit;
  const entries = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries.at(-1);
  const first = entries[0];
  const show = value => fmt(toDisplayWeight(value, unit));
  const change = days => { const value = weightChange(entries, days); return value === null ? '—' : `${value > 0 ? '+' : ''}${show(value)}`; };
  const data = weightSeries(entries, period).map(point => ({ ...point, value: toDisplayWeight(point.value, unit), secondary: point.secondary == null ? undefined : toDisplayWeight(point.secondary, unit) }));

  function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date'));
    const weight = fromDisplayWeight(Number(form.get('weight')), unit);
    if (!date || date > today() || !Number.isFinite(weight) || weight < 20 || weight > 500) return notify('Saisis une date passée ou actuelle et un poids entre 20 et 500 kg.', 'error');
    const record = { id: editing.id || crypto.randomUUID(), date, weight, note: String(form.get('note')).trim() };
    update(previous => ({ ...previous, weights: [...previous.weights.filter(item => item.id !== record.id && item.date !== date), record] }));
    setEditing(null);
    notify('Pesée enregistrée.');
  }

  return <div className="page-stack">
    <PageHeader eyebrow="SUIVI CORPOREL" title="Ton poids, avec du recul." description="Une tendance dans le temps vaut mieux qu’un chiffre isolé.">
      <Button onClick={() => setEditing({ date: today(), weight: latest?.weight || state.profile.weight, note: '' })}><Icon name="plus" /> Ajouter une pesée</Button>
    </PageHeader>
    <div className="grid-4">
      <StatCard label="Dernier poids" value={latest ? show(latest.weight) : '—'} unit={unit} icon="scale" change={latest ? formatDate(latest.date) : 'Ajoute ta première pesée'} />
      <StatCard label="Poids initial" value={first ? show(first.weight) : '—'} unit={unit} />
      <StatCard label="Sur 7 jours" value={change(7)} unit={unit} />
      <StatCard label="Sur 30 jours" value={change(30)} unit={unit} />
    </div>
    <Card>
      <div className="row between"><div><h2 className="section-title">Évolution du poids</h2><p className="muted small">Courbe réelle et moyenne mobile sur 7 jours calendaires.</p></div><div className="chips">{periods.map(([days, label]) => <button key={days} type="button" className={`chip ${period === days ? 'active' : ''}`} onClick={() => setPeriod(days)}>{label}</button>)}</div></div>
      {data.length ? <LineChart data={data} height={260} unit={unit} secondaryLabel="Moyenne sur 7 jours" /> : <Empty icon="scale" title="Le début de ta courbe" description="Enregistre une pesée pour commencer. Les données restent sur cet appareil." />}
      <p className="muted small">Les variations comparent la dernière pesée à la dernière disponible au moins 7 ou 30 jours avant. Même balance et conditions similaires facilitent la comparaison.</p>
    </Card>
    <div className="grid-2">
      <Card><div className="row between"><h2 className="section-title">Objectif physique</h2><Button variant="ghost" onClick={() => navigate('goals')}>Modifier <Icon name="arrow-right" /></Button></div>
        <div className="row between"><span className="muted">{latest ? show(latest.weight) : show(state.profile.weight)} {unit}</span><strong>{show(state.profile.targetWeight)} {unit}</strong></div>
        <ProgressBar value={goalProgress(first?.weight ?? state.profile.weight, latest?.weight ?? state.profile.weight, state.profile.targetWeight)} />
        <p className="muted small">{state.profile.goal === 'gain' ? 'Prise de masse' : state.profile.goal === 'lose' ? 'Perte de poids' : 'Maintien'} · Un objectif personnel, sans projection médicale.</p>
      </Card>
      <Card><h2 className="section-title">Depuis le début</h2><p className="stat-value">{first && latest ? `${latest.weight - first.weight > 0 ? '+' : ''}${show(latest.weight - first.weight)}` : '—'} <span className="muted small">{unit}</span></p><p className="muted small">{entries.length} pesée{entries.length > 1 ? 's' : ''} enregistrée{entries.length > 1 ? 's' : ''}{first ? ` depuis le ${formatDate(first.date)}` : ''}.</p></Card>
    </div>
    <Card><h2 className="section-title">Tes pesées</h2>{entries.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Poids</th><th>Note</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{[...entries].reverse().map(entry => <tr key={entry.id}><td>{formatDate(entry.date)}</td><td><strong>{show(entry.weight)} {unit}</strong></td><td className="muted">{entry.note || '—'}</td><td><div className="row"><Button variant="ghost" aria-label={`Modifier la pesée du ${entry.date}`} onClick={() => setEditing(entry)}><Icon name="pencil" /></Button><Button variant="ghost" aria-label={`Supprimer la pesée du ${entry.date}`} onClick={() => setDeleting(entry)}><Icon name="trash-2" /></Button></div></td></tr>)}</tbody></table></div> : <p className="muted">Aucune pesée pour le moment.</p>}</Card>
    {editing && <Modal title={editing.id ? 'Modifier la pesée' : 'Ajouter une pesée'} onClose={() => setEditing(null)}><form onSubmit={save} className="page-stack"><div className="form-grid"><Field label="Date"><input type="date" name="date" defaultValue={editing.date} max={today()} required /></Field><Field label={`Poids (${unit})`}><input type="number" inputMode="decimal" name="weight" min={Math.ceil(toDisplayWeight(20, unit) * 10) / 10} max={Math.floor(toDisplayWeight(500, unit) * 10) / 10} step="0.1" defaultValue={Math.round(toDisplayWeight(editing.weight, unit) * 10) / 10} required autoFocus /></Field></div><Field label="Note (facultative)"><textarea name="note" defaultValue={editing.note} maxLength={500} placeholder="Au réveil, avant le petit-déjeuner…" /></Field><p className="muted small">Une pesée par jour : enregistrer une même date remplace la valeur de ce jour.</p><Button type="submit">Enregistrer la pesée</Button></form></Modal>}
    {deleting && <Modal title="Supprimer cette pesée ?" onClose={() => setDeleting(null)}><p>La mesure du {formatDate(deleting.date)} ({show(deleting.weight)} {unit}) sera supprimée.</p><div className="row"><Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button><Button variant="danger" onClick={() => { update(previous => ({ ...previous, weights: previous.weights.filter(item => item.id !== deleting.id) })); setDeleting(null); notify('Pesée supprimée.'); }}>Supprimer</Button></div></Modal>}
  </div>;
}
