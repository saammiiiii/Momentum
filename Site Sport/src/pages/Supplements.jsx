import { useState } from 'react';
import { useApp } from '../context';
import { PageHeader, Card, Button, Field, Badge, StatCard, Icon } from '../components';
import { today, dateKey, addDays, fmt, formatDate, streak, supplementStats } from '../calculations';

export default function Supplements() {
  const { state, update, notify, navigate, toggleSupplement } = useApp();
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [tab, setTab] = useState('creatine');
  const mark = state.supplements[date] || {};
  const first = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const last = dateKey(new Date(year, monthNumber, 0));
  const offset = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const countDays = new Date(year, monthNumber, 0).getDate();
  const start = first > state.profile.startDate ? first : state.profile.startDate;
  const end = last < today() ? last : today();
  const stats = supplementStats(state.supplements, tab, start, end);
  const history = Object.entries(state.supplements).filter(([day, item]) => day.startsWith(month) && (item.creatine || item.whey)).sort(([a], [b]) => b.localeCompare(a));

  function saveQuantities(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const creatineDose = Number(data.get('creatineDose'));
    const wheyProtein = Number(data.get('wheyProtein'));
    if (!Number.isFinite(creatineDose) || creatineDose <= 0 || creatineDose > 50 || !Number.isFinite(wheyProtein) || wheyProtein < 0 || wheyProtein > 200) return notify('Vérifie les quantités saisies.', 'error');
    update(previous => ({ ...previous, profile: { ...previous.profile, creatineDose, wheyProtein } }));
    notify('Quantités enregistrées pour les prochaines prises.');
  }

  function shiftMonth(delta) {
    setMonth(dateKey(new Date(year, monthNumber - 1 + delta, 1)).slice(0, 7));
  }

  return <div className="page-stack">
    <PageHeader eyebrow="ROUTINE QUOTIDIENNE" title="Un geste, chaque jour." description="Garde une trace de tes prises, à ton rythme."><Button variant="secondary" onClick={() => navigate('settings')}><Icon name="bell" /> Régler les rappels</Button></PageHeader>
    <div className="row between"><Field label="Journée à renseigner"><input type="date" value={date} max={today()} onChange={event => event.target.value && setDate(event.target.value)} /></Field><Button variant="ghost" onClick={() => setDate(today())}>Aujourd’hui</Button></div>
    <div className="grid-2">
      {[{ key: 'creatine', title: 'Créatine', icon: 'pill', active: state.profile.trackCreatine, profileKey: 'trackCreatine', detail: `${fmt(mark.creatineDose ?? state.profile.creatineDose)} g par prise` }, { key: 'whey', title: 'Whey', icon: 'glass', active: state.profile.trackWhey, profileKey: 'trackWhey', detail: `1 shaker · ${fmt(state.meals.find(item => item.date === date && item.source === 'whey')?.protein ?? state.profile.wheyProtein)} g de protéines` }].map(item => <Card key={item.key}><div className="row between"><div className="row"><Icon name={item.icon} size={26} /><h2 className="section-title">{item.title}</h2></div><Badge tone={mark[item.key] ? 'accent' : 'neutral'}>{mark[item.key] ? 'Prise enregistrée' : 'À renseigner'}</Badge></div><p className="stat-value">{streak(state.supplements, item.key)} <span className="small muted">jour{streak(state.supplements, item.key) > 1 ? 's' : ''} de suite</span></p><p className="muted">{item.detail}</p>{!item.active && <p className="muted small">Ce suivi est désactivé dans ton profil. Tu peux le réactiver ici.</p>}<Button variant={mark[item.key] ? 'secondary' : 'primary'} onClick={() => { if (!item.active) update(previous => ({ ...previous, profile: { ...previous.profile, [item.profileKey]: true } })); toggleSupplement(item.key, date); }}>{mark[item.key] ? <><Icon name="check" /> {item.title === 'Whey' ? 'Shaker pris' : 'Créatine prise'} · annuler</> : <>{item.title === 'Whey' ? 'Shaker pris' : 'Créatine prise'} <Icon name="check" /></>}</Button><p className="muted small">{item.key === 'whey' ? 'Le shaker reste facultatif si ton alimentation couvre déjà ton objectif.' : 'Tu choisis ta quantité. Aucune augmentation automatique.'}</p></Card>)}
    </div>
    <div className="grid-3"><StatCard label="Jours suivis ce mois" value={stats.count} unit={`/ ${stats.total}`} icon="calendar-check" /><StatCard label="Régularité ce mois" value={fmt(stats.rate, 0)} unit="%" /><Card><h3 className="section-title">Un suivi informatif</h3><p className="muted small">La régularité compte les jours marqués depuis la date de départ de ton profil, jusqu’à aujourd’hui. Elle ne juge pas ton alimentation.</p></Card></div>
    <Card><div className="row between"><div className="chips"><button className={`chip ${tab === 'creatine' ? 'active' : ''}`} onClick={() => setTab('creatine')}>Créatine</button><button className={`chip ${tab === 'whey' ? 'active' : ''}`} onClick={() => setTab('whey')}>Whey</button></div><div className="row"><Button variant="ghost" aria-label="Mois précédent" onClick={() => shiftMonth(-1)}><Icon name="chevron-left" /></Button><strong>{new Date(`${first}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong><Button variant="ghost" aria-label="Mois suivant" disabled={month >= today().slice(0, 7)} onClick={() => shiftMonth(1)}><Icon name="chevron-right" /></Button></div></div><p className="muted small">Sélectionne un jour pour consulter ou corriger sa prise ci-dessus.</p><div className="calendar-grid supplement-calendar">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <span className="calendar-label" key={`weekday-${index}`}>{day}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: countDays }, (_, index) => { const day = addDays(first, index); const taken = state.supplements[day]?.[tab]; return <button type="button" key={day} disabled={day > today()} aria-label={`${formatDate(day)} : ${taken ? 'prise enregistrée' : 'non renseigné'}`} aria-pressed={day === date} onClick={() => setDate(day)} className={`calendar-day ${taken ? 'completed' : ''} ${day === date ? 'selected' : ''}`}><span>{index + 1}</span>{taken && <Icon name="check" size={16} />}</button>; })}</div></Card>
    <div className="grid-2"><Card><h2 className="section-title">Mes quantités</h2><form onSubmit={saveQuantities} className="page-stack"><div className="form-grid"><Field label="Créatine par prise (g)"><input type="number" inputMode="decimal" name="creatineDose" min="0.1" max="50" step="0.1" defaultValue={state.profile.creatineDose} required /></Field><Field label="Protéines par shaker (g)"><input type="number" inputMode="decimal" name="wheyProtein" min="0" max="200" step="0.1" defaultValue={state.profile.wheyProtein} required /></Field></div><p className="muted small">Reporte tes quantités habituelles et l’étiquette de ta whey. Ces réglages s’appliquent aux prochaines prises ; ton historique est conservé.</p><Button variant="secondary" type="submit">Enregistrer les quantités</Button></form></Card><Card><h2 className="section-title">Historique du mois</h2>{history.length ? history.map(([day, item]) => <div className="list-row" key={day}><button type="button" className="btn btn-ghost" onClick={() => setDate(day)}>{formatDate(day)}</button><div className="row">{item.creatine && <Badge>Créatine {fmt(item.creatineDose ?? state.profile.creatineDose)} g</Badge>}{item.whey && <Badge tone="neutral">Whey</Badge>}</div></div>) : <p className="muted">Aucune prise enregistrée ce mois-ci.</p>}</Card></div>
  </div>;
}
