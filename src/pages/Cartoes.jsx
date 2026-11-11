import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Money, Empty } from '../ui.jsx';
import { BankLogo, BankCard, useInvoiceModal, InvoiceSplit } from '../components.jsx';
import { PageHead } from './Fluxo.jsx';
import { BANKS, invoiceTotal, invoiceItems, invoiceStatus, invoiceClosingDate, cardUsed, daysUntil, brl, monthName, MONTHS_SHORT, parseMk, addMonths } from '../lib.js';

export default function Cartoes() {
  const { state, M, openForm } = useApp();
  const [invNode, openInv] = useInvoiceModal();
  const total = state.cards.reduce((s, c) => s + invoiceTotal(state, c, M), 0);
  return (
    <div className="page">
      <PageHead title="Cartões de crédito" icon="credit_card" value={total} sub={`total das faturas que vencem em ${monthName(M).toLowerCase()}`}>
        <button className="btn primary small" onClick={() => openForm('purchase')}><Plus size={15} /> Compra</button>
        <button className="btn small" onClick={() => openForm('card')}><Plus size={15} /> Cartão</button>
      </PageHead>
      {state.cards.length > 0 && <InvoiceSplit M={M} />}
      {state.cards.length === 0 && <section className="card"><Empty>Cadastre seu primeiro cartão para acompanhar faturas e parcelas.</Empty></section>}
      <div className="cards-grid">
        {state.cards.map((c) => {
          const b = BANKS[c.bank] || BANKS.outro;
          const st = invoiceStatus(state, c, M);
          const items = invoiceItems(state, c, M);
          const inv = invoiceTotal(state, c, M);
          const used = cardUsed(state, c);
          const free = c.limit - used;
          const close = invoiceClosingDate(c, M);
          const dClose = daysUntil(close);
          const { m } = parseMk(M);
          const thisInv = Math.min(inv, used);
          return (
            <section key={c.id} className="card card-panel clickable" style={{ '--brand': b.bg }} onClick={() => openInv(c.id, M)}>
              <div className="cp-stripe" style={{ background: b.bg }} />
              <div className="cp-top">
                <span className="cp-logo" style={{ background: b.bg, color: b.fg }}><BankLogo bank={c.bank} small /></span>
                <span className={`pill s-${st.toLowerCase()}`}>{st}</span>
                <ChevronRight size={18} className="muted" />
              </div>
              <h3>{c.name}</h3>
              <p className="meta">{dClose > 0 ? `fecha em ${dClose} dia${dClose > 1 ? 's' : ''}` : 'fechada'} · vence {String(c.dueDay).padStart(2, '0')} {MONTHS_SHORT[m].toLowerCase()}</p>
              <small className="label">Fatura de {monthName(M).toLowerCase()}</small>
              <Money v={inv} size="md" />
              <p className="meta">{items.length} compra{items.length !== 1 ? 's' : ''}</p>
              <div className="avail">
                <div className="avail-top"><span>Disponível</span><b className={free < 0 ? 'red' : 'green'}>{brl(free)}</b></div>
                <div className="avail-bar">
                  <i className="a1" style={{ width: `${Math.min(thisInv / (c.limit || 1), 1) * 100}%` }} />
                  <i className="a2" style={{ width: `${Math.min((used - thisInv) / (c.limit || 1), 1) * 100}%` }} />
                  <i className="a3" />
                </div>
                <small>de {brl(c.limit)}</small>
              </div>
              <div className="cp-next">
                {[1, 2, 3].map((k) => {
                  const mm = addMonths(M, k);
                  return <div key={k}><small>{MONTHS_SHORT[parseMk(mm).m]}</small><b>{brl(invoiceTotal(state, c, mm))}</b></div>;
                })}
              </div>
            </section>
          );
        })}
        <button className="card add-card" onClick={() => openForm('card')}><Plus size={22} /> Novo cartão</button>
      </div>
      {invNode}
    </div>
  );
}
