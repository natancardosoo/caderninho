import React, { useMemo, useState } from 'react';
import { Send, CheckCheck, Trash2, Check } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Segmented, Check3, Empty, BillIcon } from '../ui.jsx';
import { PersonPicker, Avatar, useAddPerson, SplitEditor, SettleField } from '../people.jsx';
import { ChevronDown, Plus, HandCoins } from 'lucide-react';
import { Modal } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import {
  receivablesByPerson, invoiceItems, billsForMonth, brl, monthName, monthShort, parseMk, fmtDate, PEOPLE_COLORS, sharesOf, applyShares, peopleIn, debtsByPerson, round2,
} from '../lib.js';

// ---------- aba Classificar: passar item por item ----------
function Classificar() {
  const { state, update, M } = useApp();
  const [filter, setFilter] = useState('pend');
  const [touched, setTouched] = useState(() => new Set());
  const items = useMemo(() => {
    const out = [];
    for (const c of state.cards)
      for (const i of invoiceItems(state, c, M))
        out.push({ kind: 'purchase', id: i.id, desc: i.desc, amount: i.part, payer: i.payer || 'me', split: i.split, settle: i.settle, debtGroup: i.debtGroup, recurring: !!i.recurring, reviewed: !!i.reviewed,
          meta: [i.inst && i.inst !== 'mensal' ? null : fmtDate(i.date), i.inst === 'mensal' ? 'assinatura' : i.inst ? `parcela ${i.inst}` : 'à vista', i.category, state.cards.length > 1 ? c.name : null].filter(Boolean).join(' · ') });
    for (const b of billsForMonth(state, M))
      out.push({ kind: 'bill', id: b.id, desc: b.name, amount: b.amount, payer: b.payer || 'me', split: b.split, mode: b.otherMode, reviewed: !!b.reviewed, icon: b.icon,
        meta: `conta fixa · dia ${String(b.dueDay).padStart(2, '0')}` });
    return out.sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind === 'purchase' ? -1 : 1));
  }, [state, M]);
  const done = items.filter((i) => i.reviewed).length;
  const shown = filter === 'pend' ? items.filter((i) => !i.reviewed || touched.has(i.id)) : items;

  const [splitting, setSplitting] = useState(null);
  const [draft, setDraft] = useState(null);
  const find = (s, it) => (it.kind === 'purchase' ? s.purchases : s.bills).find((x) => x.id === it.id);
  const setShares = (it, shares) => {
    setTouched((t) => new Set(t).add(it.id));
    update((s) => applyShares(find(s, it), shares));
  };
  const [settleDraft, setSettleDraft] = useState({});
  const toggleLater = (it) => update((s) => { const p = find(s, it); if (p.settle === 'later') { delete p.settle; } else { p.settle = 'later'; } });
  const toggleMode = (it) => update((s) => { const b = find(s, it); b.otherMode = b.otherMode === 'direto' ? 'reembolso' : 'direto'; });
  const nameOf = (id) => (id === 'me' ? 'você' : (state.people || []).find((p) => p.id === id)?.name || '?');

  return (
    <section className="card">
      <div className="classify-head">
        <div className="grow">
          <b>{done} de {items.length} revisados</b>
          <small>Compras da fatura que vence em {monthName(M).toLowerCase()} e contas do mês. Parcelas e assinaturas valem para todos os meses.</small>
          <div className="res-bar"><i style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
        </div>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'pend', label: 'A revisar' }, { value: 'all', label: 'Todos' }]} />
      </div>
      {shown.length === 0 && <Empty>Tudo revisado neste mês 🎉</Empty>}
      <div className="classify-list">
        {shown.map((it) => (
          <div key={it.kind + it.id} className={`classify-row ${it.reviewed ? 'ok' : ''}`}>
            <div className="cr-top">
              <span className="tile">{it.kind === 'bill' ? <BillIcon name={it.icon} size={16} /> : <BillIcon name="credit-card" size={16} />}</span>
              <span className="grow"><b>{it.desc}</b><small>{it.meta}</small></span>
              <b className="nowrap">{brl(it.amount)}</b>
            </div>
            <div className="cr-bottom">
              <PersonPicker compact value={sharesOf(it).length > 1 ? null : it.payer} onChange={(id) => setShares(it, [{ id, share: 1 }])} />
              <button className={`pchip ${sharesOf(it).length > 1 ? 'on' : ''}`} style={{ '--pc': 'var(--orange)' }} onClick={() => { setDraft(sharesOf(it)); setSettleDraft({ settle: it.settle, group: it.debtGroup || '' }); setSplitting(it); }}>
                {sharesOf(it).length > 1 ? `÷ ${sharesOf(it).map((s) => nameOf(s.id)).join(', ')}` : '÷ Dividir'}
              </button>
              {it.kind === 'purchase' && !it.recurring && it.payer !== 'me' && (
                <button className={`pchip ${it.settle === 'later' ? 'on' : ''}`} style={{ '--pc': 'var(--muted)' }} onClick={() => toggleLater(it)} title="Paga depois, sem prazo (vai pro saldo devedor)">{it.settle === 'later' ? `⏳ sem prazo${it.debtGroup ? ` · ${it.debtGroup}` : ''}` : '⏳ paga depois?'}</button>
              )}
              {it.kind === 'bill' && sharesOf(it).length === 1 && it.payer !== 'me' && (
                <button className="pchip on" style={{ '--pc': 'var(--muted)' }} onClick={() => toggleMode(it)}>{it.mode === 'direto' ? 'paga direto' : 'te devolve'} ⇄</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {splitting && (
        <Modal title={`Dividir: ${splitting.desc}`} onClose={() => setSplitting(null)}
          footer={<><span style={{ flex: 1 }} /><button className="btn" onClick={() => setSplitting(null)}>Cancelar</button><button className="btn primary" onClick={() => { setShares(splitting, draft); if (splitting.kind === 'purchase' && !splitting.recurring) update((s) => { const p = find(s, splitting); if (p.payer !== 'me' && settleDraft.settle === 'later') { p.settle = 'later'; p.debtGroup = (settleDraft.group || '').trim() || undefined; } else { delete p.settle; delete p.debtGroup; } }); setSplitting(null); }}>Salvar</button></>}>
          <div className="form">
            <small className="muted">{splitting.meta} · {brl(splitting.amount)}</small>
            <SplitEditor total={splitting.amount} value={sharesOf(splitting)} onChange={setDraft} />
            {splitting.kind === 'purchase' && !splitting.recurring && (draft || []).some((s) => s.id !== 'me') && <SettleField settle={settleDraft.settle} group={settleDraft.group} onChange={setSettleDraft} />}
          </div>
        </Modal>
      )}
    </section>
  );
}

// ---------- aba Quem me deve ----------
function chargeText(state, g, M) {
  const { y } = parseMk(M);
  const pend = g.items.filter((i) => !i.received);
  const lines = pend.map((i) => `• ${i.desc}${i.inst ? (i.inst === 'mensal' ? '' : ` (${i.inst})`) : ''}${i.shared ? ` (sua parte de ${brl(i.full)})` : ''}: ${brl(i.amount)}`);
  return `Oi, ${g.person.name}! Sua parte de ${monthName(M).toLowerCase()}/${y}:\n${lines.join('\n')}\n\nTotal: ${brl(pend.reduce((s, i) => s + i.amount, 0))}\nPode mandar no Pix 🙂`;
}

function QuemDeve() {
  const { state, M, togglePaid } = useApp();
  const groups = receivablesByPerson(state, M);
  const [copied, setCopied] = useState(null);
  const charge = async (g) => {
    const text = chargeText(state, g, M);
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} ta.remove();
    }
    setCopied(g.person.id); setTimeout(() => setCopied(null), 1800);
  };
  if (!groups.length) return <section className="card"><Empty>Ninguém te deve nada em {monthName(M).toLowerCase()}.<br />Use a aba <b>Classificar</b> para marcar quem paga cada compra.</Empty></section>;
  return (
    <div className="people-grid">
      {groups.map((g) => {
        const allDone = g.pending === 0;
        return (
          <section key={g.person.id} className="card person-card" style={{ '--pc': g.person.color }}>
            <div className="pc-head">
              <Avatar person={g.person} size={40} />
              <div className="grow">
                <b>{g.person.name}</b>
                <small>{allDone ? <span className="green">tudo recebido ✓</span> : <>te deve <b className="ink">{brl(g.pending)}</b>{g.pending !== g.total ? ` de ${brl(g.total)}` : ''}</>}</small>
              </div>
            </div>
            <div className="list">
              {g.items.map((i) => (
                <div key={i.key} className={`pay-row ${i.received ? 'paid' : ''}`} onClick={() => togglePaid(M, `recv:${i.key}:${i.personId}`, !i.received)}>
                  <Check3 checked={i.received} onChange={(v) => togglePaid(M, `recv:${i.key}:${i.personId}`, v)} title="Marcar como recebido" />
                  <span className="grow">{i.desc}<small className="muted block">{i.kind === 'bill' ? 'conta fixa' : i.inst === 'mensal' ? 'assinatura' : i.inst ? `parcela ${i.inst}` : 'compra no cartão'}{i.shared ? ` · parte de ${brl(i.full)}` : ''}</small></span>
                  <b>{i.estimated && '≈ '}{brl(i.amount)}</b>
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn small primary" disabled={allDone} onClick={() => charge(g)}>{copied === g.person.id ? <><Check size={15} /> Copiado</> : <><Send size={15} /> Cobrar</>}</button>
              <button className="btn small" disabled={allDone} onClick={() => g.items.forEach((i) => !i.received && togglePaid(M, `recv:${i.key}:${i.personId}`, true))}><CheckCheck size={15} /> Recebi tudo</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- aba Pessoas ----------
function Pessoas() {
  const { state, update } = useApp();
  const add = useAddPerson();
  const [name, setName] = useState('');
  const count = (id) => [...state.purchases, ...state.bills].filter((x) => peopleIn(x).includes(id)).length;
  const remove = (p) => {
    const n = count(p.id);
    if (n && !confirm(`${p.name} está em ${n} item(ns). Eles voltam a ficar como seus. Excluir?`)) return;
    update((s) => {
      s.people = s.people.filter((x) => x.id !== p.id);
      for (const x of [...s.purchases, ...s.bills]) if (peopleIn(x).includes(p.id)) { const rest = sharesOf(x).filter((sh) => sh.id !== p.id); const tot = rest.reduce((a, sh) => a + sh.share, 0); applyShares(x, rest.length ? rest.map((sh) => ({ ...sh, share: sh.share / tot })) : [{ id: 'me', share: 1 }]); }
    });
  };
  return (
    <section className="card">
      <form className="add-person" onSubmit={(e) => { e.preventDefault(); add(name); setName(''); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pessoa" />
        <button className="btn primary" type="submit" disabled={!name.trim()}>Adicionar</button>
      </form>
      {(state.people || []).length === 0 && <Empty>Nenhuma pessoa cadastrada.</Empty>}
      <div className="list">
        {(state.people || []).map((p) => (
          <div key={p.id} className="list-row person-row">
            <Avatar person={p} size={32} />
            <span className="grow">
              <input className="inline-input" defaultValue={p.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) update((s) => { s.people.find((x) => x.id === p.id).name = v; }); }} />
              <small>{count(p.id)} itens marcados</small>
            </span>
            <span className="swatches">
              {PEOPLE_COLORS.map((c) => (
                <button key={c} style={{ background: c }} className={p.color === c ? 'on' : ''} onClick={() => update((s) => { s.people.find((x) => x.id === p.id).color = c; })} aria-label="Cor" />
              ))}
            </span>
            <button className="icon-btn ghost" onClick={() => remove(p)} aria-label="Excluir"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- aba Em aberto: tudo que cada pessoa me deve ----------
function debtText(g) {
  const lines = [];
  if (g.monthly.length) {
    lines.push('Mês a mês:');
    for (const r of g.monthly) lines.push(`• ${r.desc} (${monthShort(r.M).toLowerCase()}): ${brl(r.amount)}`);
  }
  const byGroup = {};
  for (const e of g.ledger) (byGroup[e.group || 'Outros'] = byGroup[e.group || 'Outros'] || []).push(e);
  for (const [name, list] of Object.entries(byGroup)) {
    const t = list.reduce((s, e) => s + e.amount, 0);
    const paid = -list.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    lines.push(`${name}: ${brl(t)}${paid ? ` (já abatido ${brl(paid)})` : ''}`);
  }
  return `Oi, ${g.person.name}! Resumo do que está em aberto:\n${lines.join('\n')}\n\nTotal: ${brl(g.total)}`;
}

function EmAberto() {
  const { state, openForm, togglePaid, setForm } = useApp();
  const debts = debtsByPerson(state);
  const [openGroups, setOpenGroups] = useState({});
  const [copied, setCopied] = useState(null);
  const share = async (g) => {
    const text = debtText(g);
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
    } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
    setCopied(g.person.id); setTimeout(() => setCopied(null), 1800);
  };
  return (
    <>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn small primary" onClick={() => openForm('ledger', { kind: 'debt' })}><Plus size={15} /> Lançar valor que me devem</button>
        <button className="btn small" onClick={() => openForm('ledger', { kind: 'pay' })}><HandCoins size={15} /> Registrar pagamento</button>
      </div>
      {debts.length === 0 && <section className="card"><Empty>Ninguém te deve nada 🎉</Empty></section>}
      <div className="people-grid">
        {debts.map((g) => {
          const byGroup = {};
          for (const e of g.ledger) (byGroup[e.group || 'Outros'] = byGroup[e.group || 'Outros'] || []).push(e);
          return (
            <section key={g.person.id} className="card person-card" style={{ '--pc': g.person.color }}>
              <div className="pc-head">
                <Avatar person={g.person} size={40} />
                <div className="grow">
                  <b>{g.person.name}</b>
                  <small>te deve <b className="ink">{brl(g.total)}</b></small>
                </div>
              </div>
              {g.monthly.length > 0 && (
                <div className="debt-group">
                  <div className="dg-head"><span>Mês a mês (não repassado)</span><b>{brl(g.monthlyTotal)}</b></div>
                  {g.monthly.map((r) => (
                    <div key={r.M + r.key} className="pay-row" onClick={() => togglePaid(r.M, `recv:${r.key}:${r.personId}`, true)}>
                      <Check3 checked={false} onChange={() => togglePaid(r.M, `recv:${r.key}:${r.personId}`, true)} title="Recebi" />
                      <span className="grow">{r.desc}<small className="muted block">{monthName(r.M).toLowerCase()} · {r.kind === 'bill' ? 'conta' : r.inst === 'mensal' ? 'assinatura' : r.inst ? `parcela ${r.inst}` : 'cartão'}</small></span>
                      <b>{brl(r.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
              {Object.entries(byGroup).map(([name, list]) => {
                const key = g.person.id + name;
                const t = round2(list.reduce((s, e) => s + e.amount, 0));
                const debt = round2(list.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0));
                const paid = round2(debt - t);
                const isOpen = openGroups[key];
                return (
                  <div key={name} className="debt-group">
                    <button className="dg-head clickable" onClick={() => setOpenGroups((o) => ({ ...o, [key]: !o[key] }))}>
                      <span>{name} <small className="muted">· sem prazo · {list.length} itens</small></span>
                      <b>{brl(t)}</b>
                      <ChevronDown size={16} className="muted" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    {debt > 0 && <div className="dg-bar"><i style={{ width: `${Math.min(paid / debt, 1) * 100}%` }} /><small>{brl(paid)} pagos de {brl(debt)}</small></div>}
                    {isOpen && list.map((e) => (
                      <div key={e.id} className={`list-row ${e.manual || e.purchaseId || e.txId ? 'clickable' : ''}`}
                        onClick={() => (e.manual ? openForm('ledger', state.ledger.find((x) => x.id === e.id)) : e.txId ? setForm({ type: 'tx', data: state.transactions.find((t) => t.id === e.txId) }) : setForm({ type: 'purchase', data: state.purchases.find((p) => p.id === e.purchaseId) }))}>
                        <span className="grow"><b>{e.desc}</b><small>{fmtDate(e.date)}/{e.date.slice(2, 4)}{e.note ? ` · ${e.note}` : ''}{e.purchaseId ? ` · ${e.cardName || 'cartão'}${e.inst > 1 ? ` ${e.inst}x` : ''}` : ''}{e.txId ? (e.amount < 0 ? ' · Pix recebido' : ' · você pagou') : ''}</small></span>
                        <b className={`nowrap ${e.amount < 0 ? 'green' : ''}`}>{e.amount < 0 ? '− ' : ''}{brl(Math.abs(e.amount))}</b>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="btn-row">
                <button className="btn small primary" onClick={() => openForm('ledger', { kind: 'pay', personId: g.person.id, group: Object.keys(byGroup)[0] === 'Outros' ? '' : Object.keys(byGroup)[0] || '' })}><HandCoins size={15} /> Me pagou</button>
                <button className="btn small" onClick={() => openForm('ledger', { kind: 'debt', personId: g.person.id })}><Plus size={15} /> Lançar</button>
                <button className="btn small" onClick={() => share(g)}>{copied === g.person.id ? <><Check size={15} /> Copiado</> : <><Send size={15} /> Resumo</>}</button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function Receber() {
  const { state, M } = useApp();
  const debts = debtsByPerson(state);
  const [tab, setTab] = useState(() => (debts.length ? 'geral' : 'class'));
  const groups = receivablesByPerson(state, M);
  const pending = groups.reduce((s, g) => s + g.pending, 0);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const owed = debts.reduce((s, g) => s + g.total, 0);
  return (
    <div className="page">
      <PageHead title="Quem me deve" icon="money_with_wings" value={owed}
        sub={`${debts.length} pessoa${debts.length !== 1 ? 's' : ''} com valor em aberto · em ${monthName(M).toLowerCase()} entram ${brl(pending)} (${brl(total - pending)} de ${brl(total)} já recebido)`}>
        <Segmented value={tab} onChange={setTab} className="tabs" options={[{ value: 'geral', label: 'Em aberto' }, { value: 'deve', label: 'Este mês' }, { value: 'class', label: 'Classificar' }, { value: 'pessoas', label: 'Pessoas' }]} />
      </PageHead>
      {tab === 'geral' && <EmAberto />}
      {tab === 'class' && <Classificar />}
      {tab === 'deve' && <QuemDeve />}
      {tab === 'pessoas' && <Pessoas />}
    </div>
  );
}
