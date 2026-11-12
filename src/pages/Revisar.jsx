import React from 'react';
import { Check, CheckCheck, Pencil, Trash2, CreditCard, ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Empty } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { PersonPicker } from '../people.jsx';
import { reviewQueue, applyShares, sharesOf, personName, brl, fmtDate, todayStr, CATEGORIES } from '../lib.js';

const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dayLabel(date) {
  const today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  if (date === today) return 'Hoje';
  if (date === yesterday) return 'Ontem';
  const [yy, mm, dd] = date.split('-').map(Number);
  return `${fmtDate(date)} · ${WEEK[new Date(yy, mm - 1, dd).getDay()]}`;
}

export default function Revisar() {
  const { state, update, setForm, go } = useApp();
  const list = reviewQueue(state);
  const coll = (it) => (it.kind === 'purchase' ? 'purchases' : 'transactions');
  const edit = (it, fn) => update((s) => { const r = s[coll(it)].find((y) => y.id === it.x.id); if (r) fn(r, s); });

  const confirm = (it) => edit(it, (r) => { delete r.review; });
  const confirmAll = () => update((s) => { for (const k of ['purchases', 'transactions']) for (const r of s[k]) delete r.review; });
  const discard = (it) => update((s) => { s[coll(it)] = s[coll(it)].filter((y) => y.id !== it.x.id); });
  const setCategory = (it, category) => edit(it, (r) => { r.category = category; });
  // "Quem paga?" com um toque (compra no cartão ou Pix/débito que saiu)
  const setPayer = (it, id) => edit(it, (r) => {
    applyShares(r, [{ id, share: 1 }]);
    if (it.kind === 'tx') { delete r.otherMode; delete r.reviewed; if (r.payer === 'me') delete r.payer; }
  });
  // dinheiro que entrou: renda minha ou devolução de alguém
  const setFrom = (it, id) => edit(it, (r, s) => {
    if (id === 'me') { delete r.reimbFrom; return; }
    r.reimbFrom = id;
    const sender = r.desc.match(/^Pix — (.+)$/)?.[1];
    const person = (s.people || []).find((p) => p.id === id);
    if (sender && person && !(person.pixNames || []).includes(sender)) person.pixNames = [...(person.pixNames || []), sender];
  });

  const groups = [];
  for (const it of list) {
    const g = groups[groups.length - 1];
    if (g && g.date === it.x.date) g.items.push(it); else groups.push({ date: it.x.date, items: [it] });
  }
  const total = (t) => list.filter((it) => (t === 'in' ? it.x.type === 'in' : it.x.type !== 'in')).reduce((a, it) => a + it.x.amount, 0);

  return (
    <div className="page">
      <PageHead title="Para revisar" icon="balance_scale"
        sub={list.length ? `${list.length} lançamento${list.length > 1 ? 's' : ''} que chegaram dos bancos esperando você · saídas ${brl(total('out'))} · entradas ${brl(total('in'))}` : 'Tudo que chega dos bancos passa por aqui primeiro.'}>
        {list.length > 0 && <button className="btn primary small" onClick={confirmAll}><CheckCheck size={15} /> Confirmar todos</button>}
        <button className="btn small" onClick={() => go('/bancos')}><Landmark size={15} /> Bancos conectados</button>
      </PageHead>

      {list.length === 0 && <section className="card"><Empty>Tudo revisado 🎉<br /><small className="muted">Quando a sincronização trouxer algo novo, aparece aqui.</small></Empty></section>}

      {list.length > 0 && (
        <p className="rv-tip">Confira <b>quem paga</b> e a <b>categoria</b>. Pix que você fez por alguém sai dos seus gastos e entra no que a pessoa te deve; dinheiro que alguém te devolveu não conta como renda.</p>
      )}

      {groups.map((g) => (
        <section key={g.date} className="card rv-day">
          <div className="sec-head"><span>{dayLabel(g.date)}</span><span>{g.items.length} ite{g.items.length > 1 ? 'ns' : 'm'}</span></div>
          {g.items.map((it) => {
            const x = it.x;
            const isIn = it.kind === 'tx' && x.type === 'in';
            const split = !isIn && sharesOf(x).length > 1;
            const Icon = it.kind === 'purchase' ? CreditCard : isIn ? ArrowDownLeft : ArrowUpRight;
            return (
              <div key={it.kind + x.id} className="rv-item">
                <div className="rv-top">
                  <span className={`tile ${isIn ? 'green' : ''}`}><Icon size={17} /></span>
                  <span className="grow">
                    <b>{x.desc}</b>
                    <small>{it.where}{x.installments > 1 ? ` · ${x.installments}x` : ''}{x.recurring ? ' · assinatura' : ''}{x.pluggyPending ? ' · pendente no banco' : ''}</small>
                  </span>
                  <b className={`nowrap rv-amt ${isIn ? 'green' : ''}`}>{isIn ? '+ ' : '− '}{brl(x.amount)}</b>
                </div>
                <div className="rv-field">
                  <small>{isIn ? 'É renda sua ou devolução de alguém?' : split ? 'Dividido entre várias pessoas (ajuste no lápis)' : 'Quem paga?'}</small>
                  {!split && (isIn
                    ? <PersonPicker compact value={x.reimbFrom || 'me'} onChange={(id) => setFrom(it, id)} />
                    : <PersonPicker compact value={x.payer && x.payer !== 'split' ? x.payer : 'me'} onChange={(id) => setPayer(it, id)} />)}
                </div>
                <div className="rv-actions">
                  <select className="rv-cat" value={x.category} onChange={(e) => setCategory(it, e.target.value)} aria-label="Categoria">
                    {[...new Set([x.category, ...CATEGORIES])].map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <button className="icon-btn ghost" title="Excluir (não volta a ser importado)" onClick={() => discard(it)}><Trash2 size={16} /></button>
                  <button className="icon-btn ghost" title="Editar tudo" onClick={() => setForm({ type: it.kind, data: x })}><Pencil size={16} /></button>
                  <button className="btn small primary" onClick={() => confirm(it)}><Check size={15} /> Confirmar</button>
                </div>
                {isIn && x.reimbFrom && <small className="rv-note">Abate do que {personName(state, x.reimbFrom)} te deve e não conta como renda.</small>}
                {!isIn && !split && x.payer && x.payer !== 'me' && <small className="rv-note">Não conta como gasto seu: entra no que {personName(state, x.payer)} te deve.</small>}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
