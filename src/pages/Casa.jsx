import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Segmented, Check3, BillIcon, Empty, Modal, MoneyInput } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { payables, brl, monthName, parseMoney, personOf, sharesOf } from '../lib.js';
import { Avatar, Who } from '../people.jsx';
import { dueText, PayableModal } from '../components.jsx';

function BillList({ items, M }) {
  const { togglePaid, state } = useApp();
  const me = state.profile.name || 'Você';
  const [ov, setOv] = useState(null);
  return (
    <div className="bill-list">
      {items.map((p) => (
        <div key={p.id} className={`bill-row ${p.paid ? 'paid' : ''}`}>
          <Check3 checked={p.paid} onChange={(v) => togglePaid(M, p.id, v)} />
          <span className="grow">
            <b className="ellipsis">{p.name}</b>
            <small className="who-line">
              {sharesOf(p).length > 1
                ? <Who item={p} />
                : p.payer && p.payer !== 'me'
                ? <><Avatar person={personOf(state, p.payer)} size={17} /> {personOf(state, p.payer)?.name}</>
                : <><span className="av xs blue">{me[0].toUpperCase()}</span> {p.kind === 'card' ? 'Cartão' : 'Você'}</>}
              <span className="sep">·</span> dia {String(p.day).padStart(2, '0')} <span className="sep">·</span> {p.paid ? 'paga' : dueText(M, p.day)}
            </small>
          </span>
          <button className="amt-btn" onClick={() => setOv(p)} title={p.kind === 'bill' ? 'Editar valor e quem paga' : 'Ver fatura'}>
            <b className={p.estimated ? 'orange' : ''}><span className="cur">R$</span> {p.estimated && '≈ '}{brl(p.amount).replace('R$ ', '')}</b>
            <small className="share">{sharesOf(p).length === 1 && p.payer && p.payer !== 'me' ? (p.otherMode === 'direto' ? 'paga direto' : 'te devolve') : `sua parte ${p.estimated ? '≈ ' : ''}${brl(p.myAmount ?? p.amount)}`}</small>
          </button>
        </div>
      ))}
      {ov && <PayableModal item={ov} M={M} onClose={() => setOv(null)} />}
    </div>
  );
}

export default function Casa() {
  const { state, M, go } = useApp();
  const [tab, setTab] = useState('todas');
  const all = payables(state, M);
  const f = (l) => l.filter((p) => (tab === 'todas' ? true : tab === 'pend' ? !p.paid : p.paid));
  const casa = all.filter((p) => p.group === 'casa');
  const outras = all.filter((p) => p.group !== 'casa');
  const pend = (l) => l.filter((p) => !p.paid);
  const sum = (l) => l.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="page">
      <PageHead title="Contas da casa" icon="house" sub={<>{casa.length} contas · {brl(sum(casa))} <span className="info-dot" title="Toque no valor de uma conta para ajustar só este mês"><Info size={12} /></span></>}>
        <Segmented value={tab} onChange={setTab} className="tabs" options={[{ value: 'todas', label: 'Todas' }, { value: 'pend', label: 'Pendentes' }, { value: 'pagas', label: 'Pagas' }]} />
        <button className="btn small" onClick={() => go('/contas')}>Editar lista</button>
      </PageHead>
      <div className="two-col">
        <section className="card">
          <div className="sec-head"><span>A pagar · casa</span><span>{pend(casa).length} pendentes · <b>{brl(sum(pend(casa)))}</b></span></div>
          {f(casa).length ? <BillList items={f(casa)} M={M} /> : <Empty>Nada aqui.</Empty>}
        </section>
        <section className="card">
          <div className="sec-head"><span>Pessoais e faturas</span><span>{pend(outras).length} pendentes · <b>{brl(sum(pend(outras)))}</b></span></div>
          {f(outras).length ? <BillList items={f(outras)} M={M} /> : <Empty>Nada aqui.</Empty>}
        </section>
      </div>
    </div>
  );
}
