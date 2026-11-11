import React, { useState } from 'react';
import { Plus, CheckCircle2, Pencil, ChevronDown, Send, Check } from 'lucide-react';
import { useApp } from './store.jsx';
import { Who, SplitEditor, Avatar } from './people.jsx';
import { Modal, Money, ChipSvg, ContactlessSvg, Empty, Field, MoneyInput, Segmented, Check3 } from './ui.jsx';
import {
  BANKS, invoiceItems, invoiceTotal, invoiceStatus, cardUsed, brl, monthName, parseMk, dateOf, fmtDate, daysUntil, invoiceClosingDate, parseMoney, currentMk, num, sharesOf, applyShares, invoiceSplit,
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

// ---------- quem paga a fatura ----------
const ddmm = (M, day) => `${String(day).padStart(2, '0')}/${String(parseMk(M).m + 1).padStart(2, '0')}`;

function splitText(g, M) {
  const { y } = parseMk(M);
  const fmt = (i) => `• ${i.desc}${i.inst && i.inst !== 'mensal' ? ` (${i.inst})` : ''}${i.shared ? ` (sua parte de ${brl(i.full)})` : ''}: ${brl(i.amount)}`;
  const now = g.items.filter((i) => !i.later && !i.received);
  const later = g.items.filter((i) => i.later);
  const parts = [`Oi, ${g.person.name}! Sua parte na fatura de ${monthName(M).toLowerCase()}/${y}:`];
  if (now.length) parts.push(`\nPara agora (vence ${ddmm(M, now[0].dueDay)}):\n${now.map(fmt).join('\n')}\nTotal: ${brl(g.monthlyOpen)}`);
  if (later.length) parts.push(`\nEntra no saldo sem prazo${Object.keys(g.groups).length === 1 ? ` (${Object.keys(g.groups)[0]})` : ''}:\n${later.map(fmt).join('\n')}\nTotal: ${brl(g.later)}`);
  return parts.join('\n');
}

// o que a pessoa "deve" nesta fatura, do jeito mais direto possível
const headline = (g) => (g.monthlyOpen > 0 ? ['te devolve', g.monthlyOpen] : g.later > 0 && g.monthly === 0 ? ['soma no saldo', g.later] : ['já te devolveu', g.monthly]);

// barra + uma linha por pessoa: "Mãe · R$ 637,42 na fatura de novembro"
export function InvoiceSplit({ M, cardId, compact, onOpen }) {
  const { state } = useApp();
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(null);
  const sp = invoiceSplit(state, M, cardId);
  if (!sp.people.length) return compact ? null : (
    <section className="card inv-split"><div className="sec-head"><span>Quem paga a fatura de {monthName(M).toLowerCase()}</span></div><Empty>Ninguém divide esta fatura com você.</Empty></section>
  );
  const segs = [{ id: 'me', name: 'Você', color: 'var(--blue)', v: sp.me }, ...sp.people.map((g) => ({ id: g.person.id, name: g.person.name, color: g.person.color, v: g.total }))].filter((x) => x.v > 0);
  const bar = (
    <div className="is-bar" title={segs.map((x) => `${x.name}: ${brl(x.v)}`).join(' · ')}>
      {segs.map((x) => <i key={x.id} style={{ flexGrow: x.v, background: x.color }} />)}
    </div>
  );
  if (compact)
    return (
      <div className="inv-split compact" onClick={onOpen} role={onOpen ? 'button' : undefined}>
        {bar}
        {sp.people.map((g) => {
          const [verb, v] = headline(g);
          return (
            <div key={g.person.id} className="is-line">
              <Avatar person={g.person} size={18} />
              <span className="grow"><b>{g.person.name}</b> {verb}</span>
              <b className="nowrap">{brl(v)}</b>
            </div>
          );
        })}
      </div>
    );
  const share = async (g) => {
    const text = splitText(g, M);
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
    } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
    setCopied(g.person.id); setTimeout(() => setCopied(null), 1800);
  };
  return (
    <section className="card inv-split">
      <div className="sec-head"><span>Quem paga a fatura de {monthName(M).toLowerCase()}</span><span>total <b>{brl(sp.total)}</b></span></div>
      {bar}
      <div className="is-legend">{segs.map((x) => <span key={x.id}><i style={{ background: x.color }} />{x.name} {brl(x.v)}</span>)}</div>
      <div className="is-people">
        {sp.people.map((g) => {
          const isOpen = open === g.person.id;
          const due = g.items.find((i) => !i.later)?.dueDay ?? sp.dueDay;
          return (
            <div key={g.person.id} className="is-person" style={{ '--pc': g.person.color }}>
              <button className="is-head" onClick={() => setOpen(isOpen ? null : g.person.id)}>
                <Avatar person={g.person} size={34} />
                <span className="grow">
                  <b>{g.person.name}</b>
                  <small>{g.items.length} compra{g.items.length > 1 ? 's' : ''} nesta fatura</small>
                </span>
                <span className="is-amt"><b>{brl(g.total)}</b><ChevronDown size={16} className="muted" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} /></span>
              </button>
              <div className="is-tags">
                {g.monthly > 0 && (g.monthlyOpen > 0
                  ? <span className="is-tag due">Te devolve até {ddmm(M, due)}: <b>{brl(g.monthlyOpen)}</b></span>
                  : <span className="is-tag ok"><Check size={12} strokeWidth={3} /> Já te devolveu {brl(g.monthly)}</span>)}
                {Object.entries(g.groups).map(([k, v]) => <span key={k} className="is-tag later">Soma no saldo sem prazo{k !== 'sem grupo' ? ` · ${k}` : ''}: <b>{brl(v)}</b></span>)}
              </div>
              {isOpen && (
                <div className="list is-items">
                  {g.items.map((i) => (
                    <div key={i.id} className={`list-row ${i.received ? 'paid' : ''}`}>
                      <span className="grow"><b>{i.desc}</b><small>{fmtDate(i.date)}{i.inst ? ` · ${i.inst === 'mensal' ? 'assinatura' : i.inst}` : ''}{i.shared ? ` · parte de ${brl(i.full)}` : ''} · {i.later ? 'sem prazo' : i.received ? 'recebido' : 'devolve no mês'}{state.cards.length > 1 ? ` · ${i.cardName}` : ''}</small></span>
                      <b className="nowrap">{brl(i.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
              <div className="btn-row">
                <button className="btn small" onClick={() => share(g)}>{copied === g.person.id ? <><Check size={15} /> Copiado</> : <><Send size={15} /> Mandar resumo</>}</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
