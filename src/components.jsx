import React, { useState } from 'react';
import { Plus, CheckCircle2, Pencil } from 'lucide-react';
import { useApp } from './store.jsx';
import { Who, SplitEditor } from './people.jsx';
import { Modal, Money, ChipSvg, ContactlessSvg, Empty, Field, MoneyInput, Segmented, Check3 } from './ui.jsx';
import {
  BANKS, invoiceItems, invoiceTotal, invoiceStatus, cardUsed, brl, monthName, parseMk, dateOf, fmtDate, daysUntil, invoiceClosingDate, parseMoney, currentMk, num, sharesOf, applyShares,
} from './lib.js';

export function BankLogo({ bank, small }) {
  const b = BANKS[bank] || BANKS.outro;
  if (bank === 'itau') return <span className={`logo-itau ${small ? 'sm' : ''}`}>itaú</span>;
  if (bank === 'santander')
    return (
      <span className="logo-text" style={{ color: b.fg }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.6 2c.4 1.6.2 2.8-.6 4.2-.8 1.3-1 2.4-.4 3.7.2-.9.7-1.6 1.4-2.3.8-.8 1.2-1.7 1.2-2.6 1.4 1.4 1.9 3 1.4 4.8-.3 1.1-1 2-1.3 3.2-.1.5-.1 1 0 1.5C20 15 22 16.6 22 18.5 22 21 17.5 22 12 22S2 21 2 18.5c0-1.6 1.5-3 4-3.8 0 .7.3 1.4.9 2 .5-1.6 1.6-2.6 3-3.6 1.3-.9 2.3-2 2.6-3.6.4-2-.3-3.5-1.4-5.1.4-.9 1-1.7 1.5-2.4z" /></svg>
        Santander
      </span>
    );
  return <span className="logo-text" style={{ color: b.fg }}>{b.label}</span>;
}

export function BankCard({ card, M, onClick }) {
  const { state } = useApp();
  const b = BANKS[card.bank] || BANKS.outro;
  const status = invoiceStatus(state, card, M);
  const free = card.limit - cardUsed(state, card);
  const { m } = parseMk(M);
  return (
    <div className={`bank-card bank-${card.bank}`} style={{ background: b.bg, color: b.fg }} onClick={onClick}>
      <div className="bc-top">
        <BankLogo bank={card.bank} />
        <span className={`bc-status s-${status.toLowerCase()}`}>{status}</span>
      </div>
      <div className="bc-mid">
        <ChipSvg />
        <span className="bc-product">{card.product || ''}</span>
        <ContactlessSvg color={b.fg} />
      </div>
      <div className="bc-bottom">
        <div><small>VENCE</small><b>{String(card.dueDay).padStart(2, '0')}/{String(m + 1).padStart(2, '0')}</b></div>
        <div className="right"><small>LIMITE LIVRE</small><b>{brl(free)}</b></div>
      </div>
    </div>
  );
}

export function InvoiceModal({ cardId, M, onClose }) {
  const { state, openForm, togglePaid, setForm } = useApp();
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const items = invoiceItems(state, card, M);
  const total = invoiceTotal(state, card, M);
  const status = invoiceStatus(state, card, M);
  const paid = status === 'Paga';
  const close = invoiceClosingDate(card, M);
  return (
    <Modal wide title={`Fatura ${card.name}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={() => { onClose(); openForm('card', card); }}><Pencil size={15} /> Editar cartão</button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => { onClose(); openForm('purchase', { cardId }); }}><Plus size={15} /> Compra</button>
        <button className={`btn ${paid ? '' : 'primary'}`} onClick={() => togglePaid(M, `card:${cardId}`, !paid)}>
          <CheckCircle2 size={15} /> {paid ? 'Desmarcar paga' : 'Marcar paga'}
        </button>
      </>}>
      <div className="inv-head">
        <div>
          <small className="muted">Fatura de {monthName(M).toLowerCase()} {parseMk(M).y}</small>
          <Money v={total} size="xl" />
          <small className="muted">fecha {fmtDate(close.toISOString().slice(0, 10))} · vence {String(card.dueDay).padStart(2, '0')}/{String(parseMk(M).m + 1).padStart(2, '0')} · <span className={`pill s-${status.toLowerCase()}`}>{status}</span></small>
        </div>
      </div>
      {items.length === 0 ? <Empty>Nenhuma compra nesta fatura.</Empty> : (
        <div className="list">
          {items.map((i) => (
            <button key={i.id} className="list-row clickable" onClick={() => { const p = state.purchases.find((x) => x.id === i.id); setForm({ type: 'purchase', data: p }); }}>
              <span className="grow">
                <b>{i.desc} <Who item={i} /></b>
                <small>{fmtDate(i.date)} · {i.category}{i.inst ? ` · ${i.inst === 'mensal' ? 'assinatura' : `parcela ${i.inst}`}` : ''}</small>
              </span>
              <b className="nowrap">{brl(i.part)}</b>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function useInvoiceModal() {
  const [inv, setInv] = useState(null);
  const node = inv ? <InvoiceModal cardId={inv.cardId} M={inv.M} onClose={() => setInv(null)} /> : null;
  return [node, (cardId, M) => setInv({ cardId, M })];
}

export const dueText = (M, day) => {
  const d = daysUntil(dateOf(M, day));
  if (d < 0) return `venceu há ${-d} dia${d < -1 ? 's' : ''}`;
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
};

export function FinancingModal({ onClose }) {
  const { state, update } = useApp();
  const f = state.financing;
  const bill = state.bills.find((b) => b.id === f.billId);
  const [v, setV] = useState({
    balance: f.balance, remaining: f.remaining, installment: bill?.amount || 0, amort: f.amort, interest: f.interest,
    fees: f.fees, rate: f.rate, dueDay: f.dueDay,
  });
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x?.target ? x.target.value : x }));
  const save = () => {
    update((s) => {
      const F = s.financing;
      F.balance = parseMoney(v.balance); F.amort = parseMoney(v.amort); F.interest = parseMoney(v.interest);
      F.fees = parseMoney(v.fees); F.rate = parseMoney(v.rate); F.dueDay = Number(v.dueDay) || F.dueDay;
      if (Number(v.remaining) !== f.remaining) { F.remaining = Number(v.remaining) || F.remaining; F.refMonth = currentMk(); }
      const b = s.bills.find((x) => x.id === F.billId);
      if (b) { b.amount = parseMoney(v.installment); b.dueDay = F.dueDay; }
      F.updatedAt = new Date().toISOString().slice(0, 10);
    });
    onClose();
  };
  return (
    <Modal title="Atualizar financiamento" onClose={onClose}
      footer={<><span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <div className="form">
        <p className="note">Pegue os números no app Habitação CAIXA → Demonstrativo de evolução.</p>
        <div className="row2">
          <Field label="Saldo devedor"><MoneyInput value={f.balance} onChange={set('balance')} /></Field>
          <Field label="Parcela do mês"><MoneyInput value={bill?.amount} onChange={set('installment')} /></Field>
        </div>
        <div className="row2">
          <Field label="Parcelas restantes" hint="contando a deste mês"><input type="number" value={v.remaining} onChange={set('remaining')} /></Field>
          <Field label="Vence dia"><input type="number" min="1" max="31" value={v.dueDay} onChange={set('dueDay')} /></Field>
        </div>
        <div className="row2">
          <Field label="Amortização"><MoneyInput value={f.amort} onChange={set('amort')} /></Field>
          <Field label="Juros"><MoneyInput value={f.interest} onChange={set('interest')} /></Field>
        </div>
        <div className="row2">
          <Field label="Seguro + taxa adm."><MoneyInput value={f.fees} onChange={set('fees')} /></Field>
          <Field label="Taxa de juros (% a.a.)"><input inputMode="decimal" defaultValue={num(f.rate)} onChange={set('rate')} /></Field>
        </div>
      </div>
    </Modal>
  );
}

// toque numa conta (Contas a pagar / Minha casa): editar valor, quem paga e status
export function PayableModal({ item, M, onClose }) {
  if (item.kind === 'card') return <InvoiceModal cardId={item.cardId} M={M} onClose={onClose} />;
  return <BillPayModal item={item} M={M} onClose={onClose} />;
}

function BillPayModal({ item, M, onClose }) {
  const { state, update, setForm } = useApp();
  const bill = state.bills.find((b) => b.id === item.id);
  const [amount, setAmount] = useState(item.amount);
  const [scope, setScope] = useState(state.overrides?.[M]?.[item.id] !== undefined || bill.estimated ? 'mes' : 'sempre');
  const [shares, setShares] = useState(() => sharesOf(bill));
  const [mode, setMode] = useState(bill.otherMode || 'reembolso');
  const [paid, setPaid] = useState(!!item.paid);
  const v = parseMoney(amount);
  const soloOther = shares.length === 1 && shares[0].id !== 'me';
  const save = () => {
    update((s) => {
      const b = s.bills.find((x) => x.id === item.id);
      s.overrides = s.overrides || {};
      if (scope === 'mes') {
        s.overrides[M] = s.overrides[M] || {};
        if (Math.abs(v - b.amount) > 0.001) s.overrides[M][b.id] = v; else delete s.overrides[M][b.id];
      } else {
        b.amount = v;
        if (s.overrides[M]) delete s.overrides[M][b.id];
      }
      b.otherMode = mode;
      applyShares(b, shares);
      s.payments[M] = s.payments[M] || {};
      if (paid) s.payments[M][b.id] = true; else delete s.payments[M][b.id];
    });
    onClose();
  };
  return (
    <Modal title={item.name} onClose={onClose}
      footer={<>
        <button className="btn ghost small" onClick={() => { onClose(); setForm({ type: 'bill', data: bill }); }}><Pencil size={14} /> Editar conta</button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={save}>Salvar</button>
      </>}>
      <div className="form">
        <small className="muted">vence dia {String(item.day).padStart(2, '0')} · {item.group === 'casa' ? 'conta da casa' : 'conta pessoal'}{bill.estimated ? ' · valor costuma variar' : ''}</small>
        <Field label="Valor"><MoneyInput value={item.amount} onChange={setAmount} autoFocus /></Field>
        <Segmented value={scope} onChange={setScope} options={[{ value: 'mes', label: `Só em ${monthName(M).toLowerCase()}` }, { value: 'sempre', label: 'Este e os próximos meses' }]} />
        <Field group label="Quem paga?" hint="Vazio = você. Marque mais de uma pessoa para dividir.">
          <SplitEditor total={v} value={shares} onChange={setShares} />
        </Field>
        {soloOther && (
          <Segmented value={mode} onChange={setMode} options={[{ value: 'reembolso', label: 'Eu pago, a pessoa me devolve' }, { value: 'direto', label: 'A pessoa paga direto' }]} />
        )}
        <label className="toggle-line"><Check3 checked={paid} onChange={setPaid} /> Já foi paga em {monthName(M).toLowerCase()}</label>
      </div>
    </Modal>
  );
}
