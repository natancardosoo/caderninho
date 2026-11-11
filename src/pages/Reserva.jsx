import React, { useState } from 'react';
import { Plus, Minus, Target, Repeat } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Money, Empty, Modal, MoneyInput } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { reserveEntries, reserveTotal, brl, pct, fmtDate, addMonths, currentMk, monthShort, parseMk, parseMoney } from '../lib.js';

export default function Reserva() {
  const { state, openForm, update } = useApp();
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState(state.reserve.goal);
  const entries = reserveEntries(state);
  const total = reserveTotal(state);
  const g = state.reserve.goal || 0;
  const cur = currentMk();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(cur, i - 11));
  const balances = months.map((m) => entries.filter((e) => e.date.slice(0, 7) <= m).reduce((s, e) => s + e.amount, 0));
  const flows = months.map((m) => entries.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0));
  const max = Math.max(...balances, g, 1);
  const avg = flows.slice(-6).reduce((a, b) => a + b, 0) / 6;
  const eta = g > total && avg > 0 ? Math.ceil((g - total) / avg) : null;
  return (
    <div className="page">
      <PageHead title="Minha reserva" icon="money_bag" value={total}
        sub={g ? `${pct((total / g) * 100)} da meta de ${brl(g)}${eta ? ` · no ritmo atual, chega lá em ~${eta} ${eta > 1 ? 'meses' : 'mês'}` : ''}` : 'sem meta definida'}>
        <button className="btn primary small" onClick={() => openForm('reserve', { kind: 'in' })}><Plus size={15} /> Guardar</button>
        <button className="btn small" onClick={() => openForm('reserve', { kind: 'out' })}><Minus size={15} /> Resgatar</button>
        <button className="btn small" onClick={() => { setGoal(state.reserve.goal); setGoalOpen(true); }}><Target size={15} /> Meta</button>
      </PageHead>
      {g > 0 && <section className="card"><div className="res-bar big"><i style={{ width: `${Math.min(total / g, 1) * 100}%` }} /></div><div className="rb-scale"><span>{brl(0)}</span><span>{brl(g)}</span></div></section>}
      <div className="two-col">
        <section className="card">
          <h4 className="caps">Evolução em 12 meses</h4>
          <div className="bars">
            {months.map((m, i) => (
              <div key={m} className="bar-col" title={`${brl(balances[i])}`}>
                <div className="bar-wrap">
                  {g > 0 && i === 0 && <i className="goal-line" style={{ bottom: `${(g / max) * 100}%` }}><span>meta</span></i>}
                  <i className={`bar ${m === cur ? 'on' : ''}`} style={{ height: `${Math.max((balances[i] / max) * 100, 1)}%` }} />
                </div>
                <small>{monthShort(m, parseMk(cur).y)}</small>
              </div>
            ))}
          </div>
          <p className="meta">média dos últimos 6 meses: <b>{brl(avg)}</b>/mês</p>
        </section>
        <section className="card">
          <h4 className="caps">Movimentações</h4>
          {entries.length === 0 && <Empty>Nenhum aporte ainda.</Empty>}
          <div className="list">
            {entries.map((e) => (
              <div key={e.id} className={`list-row ${e.auto ? '' : 'clickable'}`} onClick={() => !e.auto && openForm('reserve', state.reserve.entries.find((x) => x.id === e.id))}>
                <span className={`tile ${e.amount >= 0 ? 'green' : 'red'}`}>{e.auto ? <Repeat size={15} /> : e.amount >= 0 ? <Plus size={15} /> : <Minus size={15} />}</span>
                <span className="grow"><b>{e.desc}</b><small>{fmtDate(e.date)}/{e.date.slice(2, 4)}{e.auto ? ' · conta fixa marcada como paga' : ''}</small></span>
                <b className={`nowrap ${e.amount >= 0 ? 'green' : 'red'}`}>{e.amount >= 0 ? '+ ' : '− '}{brl(Math.abs(e.amount))}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      {goalOpen && (
        <Modal title="Meta da reserva" onClose={() => setGoalOpen(false)}
          footer={<><span style={{ flex: 1 }} /><button className="btn primary" onClick={() => { update((s) => { s.reserve.goal = parseMoney(goal); }); setGoalOpen(false); }}>Salvar</button></>}>
          <div className="form">
            <p className="note">Uma regra comum é ter de 6 a 12 meses do seu custo de vida guardados.</p>
            <MoneyInput value={state.reserve.goal} onChange={setGoal} autoFocus />
          </div>
        </Modal>
      )}
    </div>
  );
}
