import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Money, Icon3D, Segmented, Check3, BillIcon, Empty } from '../ui.jsx';
import { monthSummary, payables, extrasForMonth, brl, monthName, parseMk, daysInMonth, receivables, personName, salaryParts, myShare, peopleIn } from '../lib.js';

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function PageHead({ title, sub, icon, children, value }) {
  return (
    <section className="card page-head">
      <div className="ph-text">
        <h2>{title}</h2>
        {value !== undefined && <Money v={value} size="lg" />}
        {sub && <p className="meta">{sub}</p>}
        {children && <div className="ph-actions">{children}</div>}
      </div>
      {icon && <Icon3D name={icon} size={104} className="ph-icon" />}
    </section>
  );
}

export default function Fluxo() {
  const { state, M, openForm, togglePaid } = useApp();
  const [tab, setTab] = useState('todas');
  const s = monthSummary(state, M);
  const parts = salaryParts(state, M);
  const salaryDay = parts[0]?.day || Math.min(state.income.salaryDay || 5, daysInMonth(M));
  const rows = [];
  parts.forEach((p, i) => rows.push({ id: `salary-${i}`, day: p.day, name: parts.length > 1 ? `Salário (${i + 1}ª parte)` : 'Salário', amount: p.amount, type: 'in', kind: 'fixed', icon: 'bank', sub: parts.length > 1 ? `${i + 1} de ${parts.length} créditos do mês` : 'salário' }));
  for (const e of extrasForMonth(state, M)) rows.push({ id: e.id, day: salaryDay, name: e.desc, amount: e.amount, type: 'in', kind: 'extra', icon: 'gift', sub: e.recurring ? 'renda extra mensal' : 'renda extra' });
  for (const t of state.transactions.filter((t) => t.date.startsWith(M)))
    rows.push({ id: t.id, day: Number(t.date.slice(8)), name: t.desc, amount: t.amount, type: t.type, kind: 'tx', tx: t, icon: t.type === 'in' ? 'gift' : 'cart', sub: t.reimbFrom ? `devolução de ${personName(state, t.reimbFrom)}` : t.type === 'out' && myShare(t) < 1 ? (myShare(t) > 0 ? `${t.category} · dividido` : `por ${peopleIn(t).map((id) => personName(state, id)).join(', ')} · te devolve`) : t.category });
  for (const r of receivables(state, M))
    rows.push({ id: `recv:${r.key}:${r.personId}`, day: r.day, name: `${personName(state, r.personId)} devolve — ${r.desc}`, amount: r.amount, type: 'in', kind: 'pay', paid: r.received, icon: 'users', sub: r.kind === 'card' ? `reembolso · fatura${r.inst ? (r.inst === 'mensal' ? ' · assinatura' : ` · parcela ${r.inst}`) : ''}` : 'reembolso no Pix', reimb: true });
  for (const p of payables(state, M).filter((p) => p.iPay))
    rows.push({ id: p.id, day: p.day, name: p.name, amount: p.amount, type: 'out', kind: 'pay', paid: p.paid, icon: p.icon, sub: p.kind === 'card' ? 'fatura do cartão' : p.group === 'casa' ? 'conta da casa' : 'conta pessoal', estimated: p.estimated });
  const filtered = rows.filter((r) => tab === 'todas' || (tab === 'in' ? r.type === 'in' : r.type === 'out')).sort((a, b) => a.day - b.day || (a.type === 'in' ? -1 : 1));
  const groups = [];
  for (const r of filtered) {
    const g = groups[groups.length - 1];
    if (g && g.day === r.day) g.items.push(r); else groups.push({ day: r.day, items: [r] });
  }
  const totIn = rows.filter((r) => r.type === 'in').reduce((a, r) => a + r.amount, 0);
  const totOut = rows.filter((r) => r.type === 'out').reduce((a, r) => a + r.amount, 0);
  const { y, m } = parseMk(M);
  // saldo acumulado calculado do dia 1 em diante; a lista mostra do último dia para o primeiro
  let running = 0;
  for (const g of groups) { for (const r of g.items) running += r.type === 'in' ? r.amount : -r.amount; g.running = running; }
  groups.reverse();
  return (
    <div className="page">
      <PageHead title="Fluxo de caixa" icon="chart_increasing" value={totIn - totOut} sub={`tudo que entra e sai em ${monthName(M).toLowerCase()} · dia a dia lançado: ${brl(s.spent)} de ${brl(state.dailyBudget || 0)} previstos`}>
        <button className="btn primary small" onClick={() => openForm('tx', { type: 'out' })}><Plus size={15} /> Gasto</button>
        <button className="btn small" onClick={() => openForm('tx', { type: 'in' })}><Plus size={15} /> Receita</button>
      </PageHead>
      <div className="stats">
        <div className="card stat"><span className="tile green"><ArrowDownLeft size={18} /></span><div><small>Entradas</small><Money v={totIn} size="md" /></div></div>
        <div className="card stat"><span className="tile red"><ArrowUpRight size={18} /></span><div><small>Saídas</small><Money v={totOut} size="md" /></div></div>
      </div>
      <section className="card">
        <Segmented value={tab} onChange={setTab} className="tabs" options={[{ value: 'todas', label: 'Todas' }, { value: 'in', label: 'Entradas' }, { value: 'out', label: 'Saídas' }]} />
        {groups.length === 0 && <Empty>Nada lançado neste mês.</Empty>}
        {groups.map((g) => {
          const dow = WEEK[new Date(y, m, g.day).getDay()];
          return (
            <div key={g.day} className="day-group">
              <div className="day-label"><b>{String(g.day).padStart(2, '0')}</b> {dow}</div>
              {g.items.map((r) => {
                return (
                  <div key={r.kind + r.id} className={`flow-row ${r.kind === 'tx' || r.kind === 'extra' ? 'clickable' : ''} ${r.paid ? 'paid' : ''}`}
                    onClick={() => (r.kind === 'tx' ? openForm('tx', r.tx) : r.kind === 'extra' ? openForm('extra', state.income.extras.find((e) => e.id === r.id)) : null)}>
                    <span className={`tile ${r.type === 'in' ? 'green' : ''}`}><BillIcon name={r.icon} size={16} /></span>
                    <span className="grow"><b>{r.name}</b><small>{r.sub || (r.type === 'in' ? 'entrada' : '')}{r.kind === 'pay' ? (r.paid ? (r.reimb ? ' · recebido' : ' · paga') : ' · pendente') : ''}</small></span>
                    {r.kind === 'pay' && <Check3 checked={r.paid} onChange={(v) => togglePaid(M, r.id, v)} title={r.reimb ? 'Marcar como recebido' : 'Marcar como paga'} />}
                    <b className={`nowrap amt ${r.type === 'in' ? 'green' : ''}`}>{r.type === 'in' ? '+ ' : '− '}{r.estimated ? '≈ ' : ''}{brl(r.amount)}</b>
                  </div>
                );
              })}
              <div className="running">saldo acumulado <b className={g.running < 0 ? 'red' : ''}>{brl(g.running)}</b></div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
