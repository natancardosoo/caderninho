import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useApp } from '../store.jsx';
import { BillIcon, Empty } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { billsForMonth, brl, monthName } from '../lib.js';

export default function Contas() {
  const { state, M, openForm } = useApp();
  const bills = billsForMonth(state, M);
  const groups = [
    { key: 'casa', title: 'Contas da casa' },
    { key: 'pessoal', title: 'Contas pessoais' },
  ];
  const total = bills.reduce((s, b) => s + b.amount, 0);
  return (
    <div className="page">
      <PageHead title="Contas fixas" icon="calendar" value={total} sub={`${bills.length} contas ativas em ${monthName(M).toLowerCase()} · faturas de cartão entram sozinhas`}>
        <button className="btn primary small" onClick={() => openForm('bill', { group: 'casa' })}><Plus size={15} /> Conta da casa</button>
        <button className="btn small" onClick={() => openForm('bill', { group: 'pessoal' })}><Plus size={15} /> Conta pessoal</button>
      </PageHead>
      <div className="two-col">
        {groups.map((g) => {
          const list = bills.filter((b) => (g.key === 'casa' ? b.group === 'casa' : b.group !== 'casa')).sort((a, b) => a.dueDay - b.dueDay);
          return (
            <section key={g.key} className="card">
              <div className="sec-head"><span>{g.title}</span><span><b>{brl(list.reduce((s, b) => s + b.amount, 0))}</b></span></div>
              {list.length === 0 && <Empty>Nenhuma conta.</Empty>}
              <div className="list">
                {list.map((b) => (
                  <button key={b.id} className="list-row clickable" onClick={() => openForm('bill', state.bills.find((x) => x.id === b.id))}>
                    <span className="tile"><BillIcon name={b.icon} size={17} /></span>
                    <span className="grow">
                      <b>{b.name}</b>
                      <small>todo dia {String(b.dueDay).padStart(2, '0')}{b.estimated ? ' · valor estimado' : ''}{b.toReserve ? ' · vai pra reserva' : ''}{b.endMonth && b.endMonth === b.startMonth ? ' · avulsa' : ''}</small>
                    </span>
                    <b className="nowrap">{b.estimated && '≈ '}{brl(b.amount)}</b>
                    <ChevronRight size={16} className="muted" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
