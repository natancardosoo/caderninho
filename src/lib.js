// ---------- formatação ----------
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const num = (v) =>
  (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brl = (v) => `R$ ${num(v)}`;
export const pct = (v) => `${Math.round(v || 0)}%`;
export const round2 = (v) => Math.round(v * 100) / 100;

export function parseMoney(s) {
  if (typeof s === 'number') return s;
  s = String(s || '').replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- meses ("2026-12") ----------
export const mk = (y, m) => {
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const parseMk = (k) => {
  const [y, m] = k.split('-').map(Number);
  return { y, m: m - 1 };
};
export const addMonths = (k, n) => {
  const { y, m } = parseMk(k);
  return mk(y, m + n);
};
export const monthDiff = (a, b) => {
  const A = parseMk(a), B = parseMk(b);
  return (B.y - A.y) * 12 + (B.m - A.m);
};
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const currentMk = () => todayStr().slice(0, 7);
export const monthName = (k) => MONTHS[parseMk(k).m];
export const monthShort = (k, refYear) => {
  const { y, m } = parseMk(k);
  return refYear && y !== refYear ? `${MONTHS_SHORT[m]} ${String(y).slice(2)}` : MONTHS_SHORT[m];
};
export const daysInMonth = (k) => {
  const { y, m } = parseMk(k);
  return new Date(y, m + 1, 0).getDate();
};
export const dateOf = (k, day) => {
  const { y, m } = parseMk(k);
  return new Date(y, m, Math.min(day, daysInMonth(k)), 12);
};
export const daysUntil = (date) => {
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  return Math.round((date - t) / 86400000);
};
export const fmtDate = (s) => {
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
};

// ---------- regras ----------
// ---------- pessoas ("Quem paga?") ----------
// payer: 'me' (padrão) | id de uma pessoa. Contas: otherMode 'reembolso' (eu pago, a pessoa devolve) | 'direto' (a pessoa paga, só acompanho)
// Compras no cartão: payer + half (dividir meio a meio). Sempre reembolso, porque o cartão é meu.
export const PEOPLE_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#ef4444', '#0ea5e9'];
// divisão: lista [{ id: 'me' | personId, share: fração }]. Sem divisão = 100% de quem está em payer (vazio = eu).
export function sharesOf(x) {
  if (x.split?.length) return x.split;
  if (x.payer && x.payer !== 'me' && x.payer !== 'split') return x.half ? [{ id: 'me', share: 0.5 }, { id: x.payer, share: 0.5 }] : [{ id: x.payer, share: 1 }];
  return [{ id: 'me', share: 1 }];
}
export const myShare = (x) => sharesOf(x).filter((s) => s.id === 'me').reduce((a, s) => a + s.share, 0);
export const isMine = (b) => myShare(b) > 0;
export const isSplit = (x) => sharesOf(x).length > 1;
// "paga direto" só vale quando a conta é 100% de outra pessoa
export const iPay = (b) => !(b.otherMode === 'direto' && myShare(b) === 0 && !isSplit(b));
// grava a divisão no item (conta ou compra)
export function applyShares(item, shares) {
  const clean = shares.filter((s) => s.share > 0);
  delete item.half;
  if (!clean.length || (clean.length === 1 && clean[0].id === 'me')) { item.payer = 'me'; delete item.split; delete item.otherMode; delete item.settle; delete item.debtGroup; }
  else if (clean.length === 1) { item.payer = clean[0].id; delete item.split; item.otherMode = item.otherMode || 'reembolso'; }
  else { item.payer = 'split'; item.split = clean; delete item.otherMode; }
  item.reviewed = true;
}
export const peopleIn = (x) => sharesOf(x).map((s) => s.id).filter((id) => id !== 'me');
export const personOf = (state, id) => (state.people || []).find((p) => p.id === id);
export const personName = (state, id) => personOf(state, id)?.name || 'Alguém';
export const othersPart = (i) => round2(i.part * (1 - myShare(i)));
export const isLater = (x) => x.settle === 'later' && !x.recurring;
export const monthlyOthersPart = (i) => (isLater(i) ? 0 : othersPart(i));
export function purchaseTotal(p) {
  const n = p.installments || 1;
  if (p.installmentValue) return round2((p.firstInstallment ?? p.installmentValue) + p.installmentValue * (n - 1));
  return p.amount;
}

export function migrate(s) {
  if (!s.people) {
    s.people = [];
    if ((s.bills || []).some((b) => b.payer === 'outro')) {
      s.people.push({ id: 'mae', name: s.profile?.otherName || 'Mãe', color: PEOPLE_COLORS[0] });
      for (const b of s.bills) if (b.payer === 'outro') { b.payer = 'mae'; b.reviewed = true; }
    }
    for (const M of Object.keys(s.payments || {}))
      for (const k of Object.keys(s.payments[M])) if (k.startsWith('reimb:')) { s.payments[M]['recv:' + k.slice(6)] = true; delete s.payments[M][k]; }
  }
  if (!s.splitV2) {
    const all = [...(s.bills || []), ...(s.purchases || [])];
    for (const x of all) if (x.half && x.payer && x.payer !== 'me') applyShares(x, [{ id: 'me', share: 0.5 }, { id: x.payer, share: 0.5 }]);
    for (const M of Object.keys(s.payments || {}))
      for (const k of Object.keys(s.payments[M])) {
        const m = k.match(/^recv:([^:]+)$/);
        if (!m) continue;
        const it = all.find((x) => x.id === m[1]);
        for (const pid of it ? peopleIn(it) : []) s.payments[M][`recv:${m[1]}:${pid}`] = true;
        delete s.payments[M][k];
      }
    s.splitV2 = true;
  }
  return s;
}

export function billsForMonth(state, M) {
  return state.bills
    .filter((b) => (!b.startMonth || b.startMonth <= M) && (!b.endMonth || b.endMonth >= M))
    .map((b) => ({ ...b, amount: state.overrides?.[M]?.[b.id] ?? b.amount }));
}

// mês em que vence a fatura que contém uma compra feita em `dateStr`
export function purchaseDueMonth(card, dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  let m = mo - 1;
  if (d >= card.closingDay) m += 1;
  if (card.dueDay <= card.closingDay) m += 1;
  return mk(y, m);
}

export function invoiceItems(state, card, M) {
  const items = [];
  for (const p of state.purchases) {
    if (p.cardId !== card.id) continue;
    const start = purchaseDueMonth(card, p.date);
    const k = monthDiff(start, M);
    if (p.recurring) {
      if (k >= 0 && (!p.endMonth || M <= p.endMonth)) items.push({ ...p, part: p.amount, inst: 'mensal' });
    } else {
      const n = p.installments || 1;
      if (k >= 0 && k < n) {
        let part;
        if (p.installmentValue) part = k === 0 && p.firstInstallment ? p.firstInstallment : p.installmentValue;
        else {
          const base = Math.floor((p.amount / n) * 100) / 100;
          part = k === n - 1 ? round2(p.amount - base * (n - 1)) : base;
        }
        items.push({ ...p, part, inst: n > 1 ? `${k + 1}/${n}` : null });
      }
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}
export const invoiceTotal = (state, card, M) => round2(invoiceItems(state, card, M).reduce((s, i) => s + i.part, 0));

// quem paga cada pedaço das faturas que vencem em M (todos os cartões, ou só cardId)
// por pessoa: monthly = te devolve até o vencimento; later = vai pro saldo sem prazo (por grupo)
export function invoiceSplit(state, M, cardId) {
  const cards = state.cards.filter((c) => !cardId || c.id === cardId);
  const byId = new Map();
  let total = 0, me = 0;
  for (const c of cards)
    for (const i of invoiceItems(state, c, M)) {
      total += i.part;
      for (const sh of sharesOf(i)) {
        const amount = round2(i.part * sh.share);
        if (sh.id === 'me') { me += amount; continue; }
        if (!byId.has(sh.id)) byId.set(sh.id, { person: personOf(state, sh.id) || { id: sh.id, name: 'Alguém', color: '#64748b' }, total: 0, monthly: 0, monthlyOpen: 0, later: 0, groups: {}, items: [] });
        const g = byId.get(sh.id);
        const later = isLater(i);
        const received = !later && isPaid(state, M, `recv:${i.id}:${sh.id}`);
        g.total += amount;
        if (later) { g.later += amount; const k = i.debtGroup || 'sem grupo'; g.groups[k] = (g.groups[k] || 0) + amount; }
        else { g.monthly += amount; if (!received) g.monthlyOpen += amount; }
        g.items.push({ id: i.id, desc: i.desc, inst: i.inst, date: i.date, amount, full: i.part, shared: sh.share < 1, later, received, group: i.debtGroup, cardName: c.name, dueDay: c.dueDay });
      }
    }
  const people = [...byId.values()].map((g) => ({
    ...g, total: round2(g.total), monthly: round2(g.monthly), monthlyOpen: round2(g.monthlyOpen), later: round2(g.later),
    groups: Object.fromEntries(Object.entries(g.groups).map(([k, v]) => [k, round2(v)])),
  })).sort((a, b) => b.total - a.total);
  const dueDay = cards.length ? Math.min(...cards.map((c) => c.dueDay)) : null;
  return { total: round2(total), me: round2(me), people, dueDay };
}

export function invoiceClosingDate(card, M) {
  const closeMonth = card.dueDay > card.closingDay ? M : addMonths(M, -1);
  return dateOf(closeMonth, card.closingDay);
}
export const isPaid = (state, M, id) => !!state.payments?.[M]?.[id];

export function invoiceStatus(state, card, M) {
  if (isPaid(state, M, `card:${card.id}`)) return 'Paga';
  const close = invoiceClosingDate(card, M);
  const cur = currentMk();
  if (M < cur) return 'Vencida';
  if (daysUntil(close) > 0) return M === cur || monthDiff(cur, M) <= 1 ? 'Aberta' : 'Futura';
  return 'Fechada';
}

export function cardUsed(state, card) {
  const cur = currentMk();
  let used = 0;
  for (let k = -1; k < 48; k++) {
    const M = addMonths(cur, k);
    if (isPaid(state, M, `card:${card.id}`)) continue;
    if (k < 0 && invoiceStatus(state, card, M) !== 'Vencida') continue;
    for (const i of invoiceItems(state, card, M)) if (!i.recurring || k <= 0) used += i.part;
  }
  return round2(used);
}

// salário pode cair em várias datas: income.parts = [{ day, amount }]. Sem partes = valor único no salaryDay.
export function salaryParts(state, M) {
  const parts = state.income.parts?.length ? state.income.parts : state.income.salary ? [{ day: state.income.salaryDay || 5, amount: state.income.salary }] : [];
  const last = M ? daysInMonth(M) : 31;
  return parts.map((p, i) => ({ ...p, idx: i, day: Math.min(p.day, last) })).sort((a, b) => a.day - b.day);
}
export const salaryTotal = (state) => round2(salaryParts(state).reduce((s, p) => s + p.amount, 0));

export function extrasForMonth(state, M) {
  return (state.income.extras || []).filter((e) => (e.recurring ? (!e.startMonth || e.startMonth <= M) : e.month === M));
}

export function payables(state, M) {
  const list = billsForMonth(state, M).map((b) => ({
    id: b.id, name: b.name, amount: b.amount, day: b.dueDay, group: b.group, icon: b.icon,
    estimated: b.estimated, toReserve: b.toReserve, kind: 'bill', paid: isPaid(state, M, b.id),
    payer: b.payer || 'me', split: b.split, otherMode: b.otherMode, mine: isMine(b), iPay: iPay(b), myAmount: round2(b.amount * myShare(b)),
  }));
  for (const c of state.cards) {
    const items = invoiceItems(state, c, M);
    const t = round2(items.reduce((s, i) => s + i.part, 0));
    const myAmount = round2(t - items.reduce((s, i) => s + monthlyOthersPart(i), 0));
    if (t > 0)
      list.push({
        id: `card:${c.id}`, name: `Fatura ${c.name}`, amount: t, day: c.dueDay, group: 'cartao',
        icon: 'credit-card', kind: 'card', cardId: c.id, paid: isPaid(state, M, `card:${c.id}`), payer: 'me', mine: true, iPay: true, myAmount,
      });
  }
  return list.sort((a, b) => a.day - b.day || b.amount - a.amount);
}

export function monthSummary(state, M) {
  const bills = billsForMonth(state, M).filter(isMine);
  const casa = round2(bills.filter((b) => b.group === 'casa').reduce((s, b) => s + b.amount * myShare(b), 0));
  const pessoalBills = round2(bills.filter((b) => b.group !== 'casa').reduce((s, b) => s + b.amount * myShare(b), 0));
  const cardsFull = round2(state.cards.reduce((s, c) => s + invoiceTotal(state, c, M), 0));
  const cardsOthers = round2(state.cards.reduce((s, c) => s + invoiceItems(state, c, M).reduce((a, i) => a + monthlyOthersPart(i), 0), 0));
  const cards = round2(cardsFull - cardsOthers);
  const tx = state.transactions.filter((t) => t.date.startsWith(M));
  // Pix/débito feito por outra pessoa não é gasto meu; dinheiro que alguém me devolve não é renda (os dois vão pro saldo devedor)
  const extraIn = round2(extrasForMonth(state, M).reduce((s, e) => s + e.amount, 0) + tx.filter((t) => t.type === 'in' && !t.reimbFrom).reduce((s, t) => s + t.amount, 0));
  const spent = round2(tx.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount * myShare(t), 0));
  const salary = salaryTotal(state);
  const income = round2(salary + extraIn);
  const diaADia = Math.max(state.dailyBudget || 0, spent);
  const pessoais = round2(pessoalBills + cards);
  const sobra = round2(income - casa - pessoais - diaADia);
  return { salary, extraIn, income, casa, pessoalBills, cards, cardsFull, cardsOthers, pessoais, spent, diaADia, sobra };
}

// tudo que outras pessoas me devem no mês M (contas em modo reembolso + itens da fatura que vence em M)
export function receivables(state, M) {
  const out = [];
  for (const b of billsForMonth(state, M)) {
    if (!iPay(b)) continue;
    const sh = sharesOf(b);
    for (const s of sh) if (s.id !== 'me')
      out.push({ key: b.id, personId: s.id, desc: b.name, amount: round2(b.amount * s.share), full: b.amount, shared: sh.length > 1, kind: 'bill', day: b.dueDay, icon: b.icon, estimated: b.estimated });
  }
  for (const c of state.cards)
    for (const i of invoiceItems(state, c, M)) {
      if (isLater(i)) continue;
      const sh = sharesOf(i);
      for (const s of sh) if (s.id !== 'me')
        out.push({ key: i.id, personId: s.id, desc: i.desc, amount: round2(i.part * s.share), full: i.part, shared: sh.length > 1, kind: 'card', inst: i.inst, recurring: !!i.recurring, date: i.date, day: c.dueDay, icon: 'credit-card', cardName: c.name });
    }
  return out.map((r) => ({ ...r, received: isPaid(state, M, `recv:${r.key}:${r.personId}`) }));
}
// ---------- saldo devedor (sem prazo) ----------
// state.ledger: [{ id, personId, date, desc, amount (+ me deve / − me pagou), group }]
export function ledgerEntries(state, personId) {
  const out = (state.ledger || [])
    .filter((e) => !personId || e.personId === personId)
    .map((e) => ({ ...e, manual: true, kind: e.amount < 0 ? 'payment' : 'debt' }));
  for (const p of state.purchases) {
    if (!isLater(p)) continue;
    for (const sh of sharesOf(p)) {
      if (sh.id === 'me' || (personId && sh.id !== personId)) continue;
      const card = state.cards.find((c) => c.id === p.cardId);
      out.push({
        id: `pl-${p.id}-${sh.id}`, personId: sh.id, date: p.date, desc: p.desc, note: p.note, amount: round2(purchaseTotal(p) * sh.share),
        group: p.debtGroup || '', kind: 'debt', purchaseId: p.id, inst: p.installments || 1, cardName: card?.name,
      });
    }
  }
  // Pix/débito: o que paguei por alguém soma no saldo dela; o que ela me mandou de volta abate
  for (const t of state.transactions || []) {
    if (t.type === 'out') {
      for (const sh of sharesOf(t)) {
        if (sh.id === 'me' || (personId && sh.id !== personId)) continue;
        out.push({ id: `tx-${t.id}-${sh.id}`, personId: sh.id, date: t.date, desc: t.desc, amount: round2(t.amount * sh.share), group: t.debtGroup || TX_GROUP, kind: 'debt', txId: t.id, shared: sh.share < 1 });
      }
    } else if (t.reimbFrom && (!personId || t.reimbFrom === personId)) {
      out.push({ id: `tx-${t.id}`, personId: t.reimbFrom, date: t.date, desc: t.desc, amount: -t.amount, group: t.debtGroup || TX_GROUP, kind: 'payment', txId: t.id });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
export const TX_GROUP = 'Pix e débito';

// recebíveis mês a mês ainda não marcados, do início do acompanhamento até o mês atual
export function openReceivables(state, upTo = currentMk()) {
  const out = [];
  let M = state.trackingStart || upTo;
  for (let guard = 0; M <= upTo && guard < 120; guard++, M = addMonths(M, 1))
    for (const r of receivables(state, M)) if (!r.received) out.push({ ...r, M });
  return out;
}

export function debtsByPerson(state) {
  const open = openReceivables(state);
  const led = ledgerEntries(state);
  return (state.people || [])
    .map((person) => {
      const monthly = open.filter((r) => r.personId === person.id);
      const ledger = led.filter((e) => e.personId === person.id);
      const monthlyTotal = round2(monthly.reduce((s, r) => s + r.amount, 0));
      const ledgerTotal = round2(ledger.reduce((s, e) => s + e.amount, 0));
      return { person, monthly, ledger, monthlyTotal, ledgerTotal, total: round2(monthlyTotal + ledgerTotal) };
    })
    .filter((g) => g.monthly.length || g.ledger.length)
    .sort((a, b) => b.total - a.total);
}

export function receivablesByPerson(state, M) {
  const map = new Map();
  for (const r of receivables(state, M)) {
    if (!map.has(r.personId)) map.set(r.personId, { person: personOf(state, r.personId) || { id: r.personId, name: 'Alguém', color: '#64748b' }, items: [] });
    map.get(r.personId).items.push(r);
  }
  return [...map.values()].map((g) => ({
    ...g,
    total: round2(g.items.reduce((s, i) => s + i.amount, 0)),
    pending: round2(g.items.filter((i) => !i.received).reduce((s, i) => s + i.amount, 0)),
  })).sort((a, b) => b.pending - a.pending || b.total - a.total);
}

export function reserveEntries(state) {
  const list = (state.reserve.entries || []).map((e) => ({ ...e, auto: false }));
  for (const [M, pays] of Object.entries(state.payments || {})) {
    for (const b of billsForMonth(state, M)) {
      if (b.toReserve && pays[b.id]) list.push({ id: `auto-${M}-${b.id}`, date: `${M}-${String(Math.min(b.dueDay, 28)).padStart(2, '0')}`, desc: b.name, amount: b.amount, auto: true });
    }
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
export const reserveTotal = (state) => round2(reserveEntries(state).reduce((s, e) => s + e.amount, 0));

// fila do que chegou dos bancos e ainda não foi revisado (mais recentes primeiro)
export function reviewQueue(state) {
  const bankOf = (b) => (b ? (BANKS[b]?.label === 'nu' ? 'Nubank' : BANKS[b]?.label || b) : '');
  return [
    ...state.purchases.filter((p) => p.review).map((p) => ({ kind: 'purchase', x: p, where: state.cards.find((c) => c.id === p.cardId)?.name || 'Cartão' })),
    ...state.transactions.filter((t) => t.review).map((t) => ({ kind: 'tx', x: t, where: `${t.type === 'in' ? 'Entrou na conta' : 'Saiu da conta'}${t.bank ? ` · ${bankOf(t.bank)}` : ''}` })),
  ].sort((a, b) => b.x.date.localeCompare(a.x.date) || a.x.desc.localeCompare(b.x.desc));
}

export function notifications(state) {
  const cur = currentMk();
  const out = [];
  for (const M of [addMonths(cur, -1), cur, addMonths(cur, 1)]) {
    for (const p of payables(state, M)) {
      if (p.paid) continue;
      const d = daysUntil(dateOf(M, p.day));
      if (d <= 5) out.push({ ...p, M, days: d });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

// ---------- bancos ----------
export const BANKS = {
  santander: { label: 'Santander', bg: 'linear-gradient(135deg,#2a2a2c 0%,#141416 55%,#262628 100%)', fg: '#fff', accent: '#ec0000' },
  itau: { label: 'itaú', bg: 'linear-gradient(135deg,#ff7a00 0%,#ec6a00 100%)', fg: '#fff', accent: '#003399' },
  nubank: { label: 'nu', bg: 'linear-gradient(135deg,#8a19d6 0%,#5b0aa0 100%)', fg: '#fff', accent: '#fff' },
  inter: { label: 'inter', bg: 'linear-gradient(135deg,#ff8a3d 0%,#ff6a00 100%)', fg: '#fff', accent: '#fff' },
  c6: { label: 'C6 Bank', bg: 'linear-gradient(135deg,#3a3a3a 0%,#0e0e0e 100%)', fg: '#fff', accent: '#fff' },
  bradesco: { label: 'bradesco', bg: 'linear-gradient(135deg,#e1173f 0%,#b0002a 100%)', fg: '#fff', accent: '#fff' },
  bb: { label: 'Banco do Brasil', bg: 'linear-gradient(135deg,#fde047 0%,#f5c400 100%)', fg: '#1d3b8f', accent: '#1d3b8f' },
  caixa: { label: 'CAIXA', bg: 'linear-gradient(135deg,#1c64c8 0%,#0b4596 100%)', fg: '#fff', accent: '#f39200' },
  xp: { label: 'XP', bg: 'linear-gradient(135deg,#1b1b1b 0%,#000 100%)', fg: '#fff', accent: '#ffd400' },
  outro: { label: 'Cartão', bg: 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)', fg: '#fff', accent: '#fff' },
};

// ---------- dados de exemplo ----------
export function seedState() {
  const cur = currentMk();
  const prev = addMonths(cur, -1);
  const prev2 = addMonths(cur, -2);
  const d = (M, day) => `${M}-${String(day).padStart(2, '0')}`;
  const cards = [
    { id: 'c1', name: 'Santander Unique', product: 'UNIQUE', bank: 'santander', limit: 30000, closingDay: 27, dueDay: 5 },
    { id: 'c2', name: 'Itaú Personnalité', product: 'PERSONNALITÉ', bank: 'itau', limit: 15000, closingDay: 5, dueDay: 12 },
    { id: 'c3', name: 'Nubank', product: 'ULTRAVIOLETA', bank: 'nubank', limit: 8000, closingDay: 1, dueDay: 8 },
  ];
  return {
    version: 1,
    sample: true,
    people: [],
    profile: { name: 'Você' },
    theme: 'light',
    income: {
      salary: 12000,
      extras: [{ id: uid(), desc: 'Freela de design', amount: 1500, month: cur, recurring: false }],
    },
    dailyBudget: 1200,
    housingRef: 30,
    bills: [
      { id: 'b1', name: 'Aluguel', amount: 2400, dueDay: 1, group: 'casa', icon: 'key' },
      { id: 'b2', name: 'Condomínio', amount: 790, dueDay: 5, group: 'casa', icon: 'building' },
      { id: 'b3', name: 'Luz', amount: 170, dueDay: 10, group: 'casa', icon: 'zap', estimated: true },
      { id: 'b4', name: 'Internet', amount: 129.9, dueDay: 12, group: 'casa', icon: 'wifi' },
      { id: 'b5', name: 'Gás', amount: 64.95, dueDay: 15, group: 'casa', icon: 'flame', estimated: true },
      { id: 'b6', name: 'Guardar na reserva', amount: 2000, dueDay: 5, group: 'pessoal', icon: 'piggy', toReserve: true },
      { id: 'b7', name: 'Ajuda pra família', amount: 800, dueDay: 5, group: 'pessoal', icon: 'users' },
      { id: 'b8', name: 'Academia', amount: 149.9, dueDay: 8, group: 'pessoal', icon: 'dumbbell' },
      { id: 'b9', name: 'Plano de saúde', amount: 480, dueDay: 10, group: 'pessoal', icon: 'heart' },
      { id: 'b10', name: 'Celular', amount: 59.9, dueDay: 15, group: 'pessoal', icon: 'phone' },
    ],
    overrides: {},
    payments: { [prev]: { b1: true, b2: true, b3: true, b4: true, b5: true, b6: true, b7: true, b8: true, b9: true, b10: true, 'card:c1': true, 'card:c2': true, 'card:c3': true }, [cur]: Object.fromEntries([['b1',1],['b2',5],['b3',10],['b4',12],['b5',15],['b6',5],['b7',5],['b8',8],['b9',10],['b10',15],['card:c1',5],['card:c2',12],['card:c3',8]].filter(([, day]) => day < new Date().getDate()).map(([k]) => [k, true])) },
    cards,
    purchases: [
      { id: uid(), cardId: 'c1', desc: 'MacBook Air', amount: 9600, date: d(prev2, 14), installments: 10, category: 'Eletrônicos' },
      { id: uid(), cardId: 'c1', desc: 'Passagem aérea', amount: 2380, date: d(prev, 3), installments: 4, category: 'Viagem' },
      { id: uid(), cardId: 'c1', desc: 'Supermercado', amount: 612.4, date: d(prev, 29), installments: 1, category: 'Mercado' },
      { id: uid(), cardId: 'c1', desc: 'Restaurante', amount: 286.5, date: d(cur, 2), installments: 1, category: 'Restaurante' },
      { id: uid(), cardId: 'c1', desc: 'Spotify', amount: 21.9, date: d(prev2, 10), recurring: true, category: 'Assinaturas' },
      { id: uid(), cardId: 'c1', desc: 'Netflix', amount: 44.9, date: d(prev2, 10), recurring: true, category: 'Assinaturas' },
      { id: uid(), cardId: 'c1', desc: 'Farmácia', amount: 134.2, date: d(cur, 6), installments: 1, category: 'Saúde' },
      { id: uid(), cardId: 'c2', desc: 'Tênis de corrida', amount: 899.9, date: d(prev, 20), installments: 3, category: 'Compras' },
      { id: uid(), cardId: 'c2', desc: 'Combustível', amount: 260, date: d(prev, 28), installments: 1, category: 'Transporte' },
      { id: uid(), cardId: 'c2', desc: 'Seguro do carro', amount: 2400, date: d(prev2, 2), installments: 6, category: 'Transporte' },
      { id: uid(), cardId: 'c3', desc: 'iFood', amount: 89.9, date: d(prev, 25), installments: 1, category: 'Restaurante' },
      { id: uid(), cardId: 'c3', desc: 'Curso online', amount: 1188, date: d(prev2, 20), installments: 12, category: 'Educação' },
      { id: uid(), cardId: 'c3', desc: 'Uber', amount: 47.3, date: d(cur, 4), installments: 1, category: 'Transporte' },
    ],
    transactions: [
      { id: uid(), date: d(cur, 2), desc: 'Feira', amount: 86.4, type: 'out', category: 'Mercado' },
      { id: uid(), date: d(cur, 4), desc: 'Padaria', amount: 32.5, type: 'out', category: 'Mercado' },
      { id: uid(), date: d(cur, 7), desc: 'Barbeiro', amount: 60, type: 'out', category: 'Cuidados' },
      { id: uid(), date: d(cur, 9), desc: 'Pix recebido — venda', amount: 350, type: 'in', category: 'Outros' },
    ],
    reserve: {
      goal: 50000,
      entries: [
        { id: uid(), date: d(prev2, 5), desc: 'Saldo inicial', amount: 16000 },
      ],
    },
  };
}

export function emptyState() {
  return {
    version: 1, sample: false, people: [], profile: { name: 'Você' }, theme: 'light',
    income: { salary: 0, extras: [] }, dailyBudget: 0, housingRef: 30,
    bills: [], overrides: {}, payments: {}, cards: [], purchases: [], transactions: [],
    reserve: { goal: 0, entries: [] },
  };
}

export const CATEGORIES = ['Freela', 'Mercado', 'Restaurante', 'Transporte', 'Saúde', 'Compras', 'Assinaturas', 'Educação', 'Lazer', 'Viagem', 'Cuidados', 'Eletrônicos', 'Casa', 'Pets', 'Outros'];
