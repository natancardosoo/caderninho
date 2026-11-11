import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Field, MoneyInput, Segmented, BillIcon, BILL_ICONS, Check3 } from './ui.jsx';
import { sharesOf, applyShares, TX_GROUP, uid, parseMoney, todayStr, CATEGORIES, BANKS, currentMk, brl, purchaseDueMonth, monthName, parseMk } from './lib.js';
import { useApp } from './store.jsx';
import { SplitEditor, SettleField, PersonPicker } from './people.jsx';

function Foot({ onDelete, onCancel, saveLabel = 'Salvar', disabled }) {
  return (
    <>
      {onDelete && (
        <button type="button" className="btn danger ghost" onClick={onDelete}><Trash2 size={16} /> Excluir</button>
      )}
      <span style={{ flex: 1 }} />
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      <button type="submit" form="f" className="btn primary" disabled={disabled}>{saveLabel}</button>
    </>
  );
}

// ---------- gasto / receita ----------
export function TxForm({ data, onClose }) {
  const { state, update, M } = useApp();
  const edit = data?.id ? data : null;
  const defDate = M === currentMk() ? todayStr() : `${M}-01`;
  const [f, setF] = useState({ type: data?.type || 'out', desc: edit?.desc || '', amount: edit?.amount || '', date: edit?.date || defDate, category: edit?.category || (data?.type === 'in' ? 'Outros' : 'Mercado'), group: edit?.debtGroup || '' });
  const [shares, setShares] = useState(() => sharesOf(edit?.type === 'out' ? edit : {}));
  const [from, setFrom] = useState(edit?.reimbFrom || 'me');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const amount = parseMoney(f.amount);
  const others = f.type === 'out' ? shares.some((x) => x.id !== 'me') : from !== 'me';
  const groups = [...new Set([TX_GROUP, ...(state.ledger || []).map((e) => e.group), ...state.purchases.map((p) => p.debtGroup), ...state.transactions.map((t) => t.debtGroup)].filter(Boolean))];
  const submit = (e) => {
    e.preventDefault();
    if (!amount || !f.desc.trim()) return;
    update((s) => {
      // mantém os campos da importação (pluggyId, banco…); salvar já conta como revisado
      const item = { ...(edit || {}), id: edit?.id || uid(), type: f.type, desc: f.desc.trim(), amount, date: f.date, category: f.category };
      for (const k of ['review', 'payer', 'split', 'otherMode', 'settle', 'reviewed', 'half', 'reimbFrom', 'debtGroup']) delete item[k];
      if (f.type === 'out') {
        applyShares(item, shares);
        for (const k of ['otherMode', 'reviewed']) delete item[k];
        if (item.payer === 'me') delete item.payer;
      } else if (from !== 'me') {
        item.reimbFrom = from;
        // lembra o nome de quem mandou o Pix, para a próxima importação já vir marcada
        const sender = item.desc.match(/^Pix — (.+)$/)?.[1];
        const person = (s.people || []).find((p) => p.id === from);
        if (sender && person && !(person.pixNames || []).includes(sender)) person.pixNames = [...(person.pixNames || []), sender];
      }
      if (others && f.group.trim() && f.group.trim() !== TX_GROUP) item.debtGroup = f.group.trim();
      if (edit) s.transactions = s.transactions.map((t) => (t.id === edit.id ? item : t));
      else s.transactions.push(item);
    });
    onClose();
  };
  const del = () => { update((s) => { s.transactions = s.transactions.filter((t) => t.id !== edit.id); }); onClose(); };
  const fromName = (state.people || []).find((p) => p.id === from)?.name;
  return (
    <Modal title={edit ? 'Editar lançamento' : f.type === 'in' ? 'Nova receita' : 'Novo gasto'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Segmented value={f.type} onChange={set('type')} options={[{ value: 'out', label: 'Gasto' }, { value: 'in', label: 'Receita' }]} />
        <Field label="Valor"><MoneyInput value={edit?.amount} onChange={set('amount')} autoFocus /></Field>
        <Field label="Descrição"><input value={f.desc} onChange={set('desc')} placeholder={f.type === 'in' ? 'Ex.: freela, reembolso' : 'Ex.: mercado, farmácia'} /></Field>
        <div className="row2">
          <Field label="Data"><input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="Categoria">
            <select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
        {f.type === 'out' ? (
          <Field group label="Quem paga?" hint="Pagou por outra pessoa? Marque ela: não conta como gasto seu e entra no que ela te deve.">
            <SplitEditor total={amount} value={shares} onChange={setShares} />
          </Field>
        ) : (
          <Field group label="De quem é esse dinheiro?" hint="Eu = renda sua. Se for alguém te devolvendo ou pagando, marque a pessoa: abate do que ela te deve e não conta como renda.">
            <PersonPicker value={from} onChange={setFrom} />
          </Field>
        )}
        {others && (
          <Field label="Grupo no saldo devedor">
            <input list="tx-groups" value={f.group} onChange={set('group')} placeholder={TX_GROUP} />
            <datalist id="tx-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </Field>
        )}
        {others && <p className="note">Vai para <b>A receber → Em aberto</b>{f.type === 'in' && fromName ? ` como pagamento de ${fromName}` : ''}.</p>}
        {f.type === 'out' && !others && <p className="note">Gastos do dia a dia no débito/pix. Compras no cartão vão em “Compra no cartão”.</p>}
      </form>
    </Modal>
  );
}

// ---------- compra no cartão ----------
export function PurchaseForm({ data, onClose }) {
  const { state, update } = useApp();
  const edit = data?.id ? data : null;
  const [f, setF] = useState({
    cardId: edit?.cardId || data?.cardId || state.cards[0]?.id || '', desc: edit?.desc || '', amount: edit?.amount || '',
    date: edit?.date || todayStr(), installments: edit?.installments || 1, recurring: !!edit?.recurring, category: edit?.category || 'Compras',
  });
  const [shares, setShares] = useState(() => sharesOf(edit || {}));
  const [settle, setSettle] = useState({ settle: edit?.settle, group: edit?.debtGroup || '' });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const card = state.cards.find((c) => c.id === f.cardId);
  if (!state.cards.length)
    return (
      <Modal title="Compra no cartão" onClose={onClose}>
        <p className="note">Cadastre um cartão primeiro em <b>Cartões</b>.</p>
      </Modal>
    );
  const amount = parseMoney(f.amount);
  const n = Number(f.installments) || 1;
  const due = card && f.date ? purchaseDueMonth(card, f.date) : null;
  const submit = (e) => {
    e.preventDefault();
    if (!amount || !f.desc.trim()) return;
    update((s) => {
      const item = { id: edit?.id || uid(), cardId: f.cardId, desc: f.desc.trim(), amount, date: f.date, installments: f.recurring ? 1 : n, recurring: f.recurring, category: f.category };
      applyShares(item, shares);
      const others = item.payer !== 'me';
      if (others && !f.recurring && settle.settle === 'later') { item.settle = 'later'; item.debtGroup = (settle.group || '').trim() || undefined; }
      else { item.settle = undefined; item.debtGroup = undefined; }
      if (edit) s.purchases = s.purchases.map((p) => {
        if (p.id !== edit.id) return p;
        const n2 = { ...p, ...item };
        delete n2.review;
        if (!item.split) delete n2.split;
        // valor ou nº de parcelas mudou: volta a dividir o total igualmente
        if (p.amount !== item.amount || (p.installments || 1) !== item.installments) { delete n2.installmentValue; delete n2.firstInstallment; }
        return n2;
      });
      else s.purchases.push(item);
    });
    onClose();
  };
  const del = () => { update((s) => { s.purchases = s.purchases.filter((p) => p.id !== edit.id); }); onClose(); };
  return (
    <Modal title={edit ? 'Editar compra' : 'Compra no cartão'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Field label="Cartão">
          <select value={f.cardId} onChange={set('cardId')}>{state.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Field label={f.recurring ? 'Valor mensal' : 'Valor total'}><MoneyInput value={edit?.amount} onChange={set('amount')} autoFocus /></Field>
        <Field label="Descrição"><input value={f.desc} onChange={set('desc')} placeholder="Ex.: notebook, mercado, Netflix" /></Field>
        <div className="row2">
          <Field label="Data da compra"><input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="Categoria"><select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <label className="toggle-line"><Check3 checked={f.recurring} onChange={set('recurring')} /> Assinatura (cobra todo mês)</label>
        <Field group label="Quem paga?" hint="Toque para incluir ou tirar pessoas. Compra em conjunto: marque todo mundo que divide.">
          <SplitEditor total={f.recurring ? amount : edit?.installmentValue && amount === edit.amount ? edit.installmentValue : amount / n} value={shares} onChange={setShares} />
        </Field>
        {!f.recurring && shares.some((s) => s.id !== 'me') && <SettleField settle={settle.settle} group={settle.group} onChange={setSettle} />}
        {!f.recurring && (
          <Field label="Parcelas">
            <select value={f.installments} onChange={set('installments')}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                <option key={i} value={i}>{i === 1 ? 'À vista' : `${i}x de ${brl(amount / i)}`}</option>
              ))}
            </select>
          </Field>
        )}
        {due && <p className="note">Entra na fatura de <b>{monthName(due).toLowerCase()} {parseMk(due).y}</b> (fecha dia {card.closingDay}, vence dia {card.dueDay}).</p>}
      </form>
    </Modal>
  );
}

// ---------- conta fixa ----------
export function BillForm({ data, onClose }) {
  const { update, M, state } = useApp();
  const edit = data?.id ? data : null;
  const [f, setF] = useState({
    name: edit?.name || '', amount: edit?.amount || '', dueDay: edit?.dueDay || 10, group: edit?.group || data?.group || 'casa',
    icon: edit?.icon || 'receipt', otherMode: edit?.otherMode || 'reembolso', estimated: !!edit?.estimated, toReserve: !!edit?.toReserve, once: edit ? edit.startMonth && edit.startMonth === edit.endMonth : false,
  });
  const [shares, setShares] = useState(() => sharesOf(edit || {}));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const soloOther = shares.length === 1 && shares[0].id !== 'me';
  const submit = (e) => {
    e.preventDefault();
    const amount = parseMoney(f.amount);
    if (!f.name.trim()) return;
    update((s) => {
      const base = edit ? s.bills.find((b) => b.id === edit.id) : null;
      const item = {
        ...(base || {}), id: edit?.id || uid(), name: f.name.trim(), amount, dueDay: Math.min(31, Math.max(1, Number(f.dueDay) || 1)),
        group: f.group, icon: f.icon, estimated: f.estimated, toReserve: f.toReserve,
        otherMode: f.otherMode,
      };
      delete item.split; delete item.payer;
      applyShares(item, shares);
      if (f.once) { item.startMonth = base?.startMonth || M; item.endMonth = item.startMonth; }
      else if (base && base.startMonth === base.endMonth) { delete item.endMonth; }
      if (!base && !f.once) item.startMonth = M;
      if (edit) s.bills = s.bills.map((b) => (b.id === edit.id ? item : b));
      else s.bills.push(item);
    });
    onClose();
  };
  const del = () => {
    update((s) => {
      // encerra a conta a partir deste mês, mantendo o histórico
      const b = s.bills.find((x) => x.id === edit.id);
      const prevMonths = Object.keys(s.payments).some((k) => k < M && s.payments[k][b.id]);
      if (prevMonths) {
        const [y, m] = M.split('-').map(Number);
        b.endMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
      } else s.bills = s.bills.filter((x) => x.id !== edit.id);
    });
    onClose();
  };
  return (
    <Modal title={edit ? 'Editar conta' : 'Nova conta fixa'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Segmented value={f.group} onChange={set('group')} options={[{ value: 'casa', label: 'Casa' }, { value: 'pessoal', label: 'Pessoal' }]} />
        <Field label="Nome"><input value={f.name} onChange={set('name')} placeholder="Ex.: Aluguel, Luz, Academia" autoFocus={!edit} /></Field>
        <div className="row2">
          <Field label="Valor mensal"><MoneyInput value={edit?.amount} onChange={set('amount')} /></Field>
          <Field label="Vence dia"><input type="number" min="1" max="31" value={f.dueDay} onChange={set('dueDay')} /></Field>
        </div>
        <Field group label="Quem paga?">
          <SplitEditor total={parseMoney(f.amount)} value={shares} onChange={setShares} />
        </Field>
        {soloOther && (
          <>
            <Segmented value={f.otherMode} onChange={set('otherMode')} options={[{ value: 'reembolso', label: 'Eu pago, a pessoa me devolve' }, { value: 'direto', label: 'A pessoa paga direto' }]} />
            <p className="note">{f.otherMode === 'reembolso'
              ? `Entra nas suas contas a pagar, mas não pesa no seu saldo: o app espera o Pix de volta e te lembra de marcar quando chegar.`
              : `Só para acompanhar o vencimento. Não entra no seu saldo nem no total a pagar.`}</p>
          </>
        )}
        <Field group label="Ícone">
          <div className="icon-pick">
            {Object.keys(BILL_ICONS).map((k) => (
              <button type="button" key={k} className={f.icon === k ? 'on' : ''} onClick={() => set('icon')(k)}><BillIcon name={k} size={17} /></button>
            ))}
          </div>
        </Field>
        <label className="toggle-line"><Check3 checked={f.estimated} onChange={set('estimated')} /> Valor estimado (varia todo mês)</label>
        <label className="toggle-line"><Check3 checked={f.toReserve} onChange={set('toReserve')} /> Ao marcar como paga, somar na reserva</label>
        <label className="toggle-line"><Check3 checked={f.once} onChange={set('once')} /> Só neste mês (conta avulsa)</label>
      </form>
    </Modal>
  );
}

// ---------- cartão ----------
export function CardForm({ data, onClose }) {
  const { update } = useApp();
  const edit = data?.id ? data : null;
  const [f, setF] = useState({ name: edit?.name || '', product: edit?.product || '', bank: edit?.bank || 'nubank', limit: edit?.limit || '', closingDay: edit?.closingDay || 1, dueDay: edit?.dueDay || 8 });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    update((s) => {
      const item = { id: edit?.id || uid(), name: f.name.trim(), product: f.product.trim(), bank: f.bank, limit: parseMoney(f.limit), closingDay: Number(f.closingDay) || 1, dueDay: Number(f.dueDay) || 1 };
      if (edit) s.cards = s.cards.map((c) => (c.id === edit.id ? item : c));
      else s.cards.push(item);
    });
    onClose();
  };
  const del = () => {
    if (!confirm('Excluir este cartão e todas as compras dele?')) return;
    update((s) => { s.cards = s.cards.filter((c) => c.id !== edit.id); s.purchases = s.purchases.filter((p) => p.cardId !== edit.id); });
    onClose();
  };
  return (
    <Modal title={edit ? 'Editar cartão' : 'Novo cartão'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Field group label="Banco">
          <div className="bank-pick">
            {Object.entries(BANKS).map(([k, b]) => (
              <button type="button" key={k} className={f.bank === k ? 'on' : ''} onClick={() => set('bank')(k)} style={{ background: b.bg, color: b.fg }}>{b.label}</button>
            ))}
          </div>
        </Field>
        <div className="row2">
          <Field label="Nome"><input value={f.name} onChange={set('name')} placeholder="Ex.: Nubank" autoFocus={!edit} /></Field>
          <Field label="Texto no cartão"><input value={f.product} onChange={set('product')} placeholder="Ex.: ULTRAVIOLETA" /></Field>
        </div>
        <Field label="Limite"><MoneyInput value={edit?.limit} onChange={set('limit')} /></Field>
        <div className="row2">
          <Field label="Fecha dia"><input type="number" min="1" max="31" value={f.closingDay} onChange={set('closingDay')} /></Field>
          <Field label="Vence dia"><input type="number" min="1" max="31" value={f.dueDay} onChange={set('dueDay')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------- reserva ----------
export function ReserveForm({ data, onClose }) {
  const { update } = useApp();
  const edit = data?.id ? data : null;
  const [f, setF] = useState({ kind: edit && edit.amount < 0 ? 'out' : data?.kind || 'in', desc: edit?.desc || '', amount: edit ? Math.abs(edit.amount) : '', date: edit?.date || todayStr() });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const submit = (e) => {
    e.preventDefault();
    const a = parseMoney(f.amount);
    if (!a) return;
    update((s) => {
      const item = { id: edit?.id || uid(), desc: f.desc.trim() || (f.kind === 'in' ? 'Aporte' : 'Resgate'), amount: f.kind === 'in' ? a : -a, date: f.date };
      if (edit) s.reserve.entries = s.reserve.entries.map((x) => (x.id === edit.id ? item : x));
      else s.reserve.entries.push(item);
    });
    onClose();
  };
  const del = () => { update((s) => { s.reserve.entries = s.reserve.entries.filter((x) => x.id !== edit.id); }); onClose(); };
  return (
    <Modal title={edit ? 'Editar movimentação' : 'Movimentar reserva'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Segmented value={f.kind} onChange={set('kind')} options={[{ value: 'in', label: 'Guardar' }, { value: 'out', label: 'Resgatar' }]} />
        <Field label="Valor"><MoneyInput value={edit ? Math.abs(edit.amount) : undefined} onChange={set('amount')} autoFocus /></Field>
        <div className="row2">
          <Field label="Descrição"><input value={f.desc} onChange={set('desc')} placeholder={f.kind === 'in' ? 'Aporte' : 'Resgate'} /></Field>
          <Field label="Data"><input type="date" value={f.date} onChange={set('date')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------- receita extra (Minha renda) ----------
export function ExtraForm({ data, onClose }) {
  const { update, M } = useApp();
  const edit = data?.id ? data : null;
  const [f, setF] = useState({ desc: edit?.desc || '', amount: edit?.amount || '', recurring: !!edit?.recurring });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const submit = (e) => {
    e.preventDefault();
    const a = parseMoney(f.amount);
    if (!a || !f.desc.trim()) return;
    update((s) => {
      const item = { id: edit?.id || uid(), desc: f.desc.trim(), amount: a, recurring: f.recurring, month: f.recurring ? undefined : edit?.month || M, startMonth: f.recurring ? edit?.startMonth || M : undefined };
      if (edit) s.income.extras = s.income.extras.map((x) => (x.id === edit.id ? item : x));
      else s.income.extras.push(item);
    });
    onClose();
  };
  const del = () => { update((s) => { s.income.extras = s.income.extras.filter((x) => x.id !== edit.id); }); onClose(); };
  return (
    <Modal title={edit ? 'Editar renda extra' : 'Renda extra'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Field label="Descrição"><input value={f.desc} onChange={set('desc')} placeholder="Ex.: freela, aluguel recebido, bônus" autoFocus={!edit} /></Field>
        <Field label="Valor"><MoneyInput value={edit?.amount} onChange={set('amount')} /></Field>
        <label className="toggle-line"><Check3 checked={f.recurring} onChange={set('recurring')} /> Recebo todo mês</label>
      </form>
    </Modal>
  );
}


// ---------- saldo devedor: alguém me deve / me pagou ----------
export function LedgerForm({ data, onClose }) {
  const { state, update } = useApp();
  const edit = data?.id ? data : null;
  const [f, setF] = useState({
    kind: edit ? (edit.amount < 0 ? 'pay' : 'debt') : data?.kind || 'debt', personId: edit?.personId || data?.personId || state.people?.[0]?.id || '',
    amount: edit ? Math.abs(edit.amount) : '', desc: edit?.desc || '', date: edit?.date || todayStr(), group: edit?.group ?? data?.group ?? '',
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const groups = [...new Set([...(state.ledger || []).map((e) => e.group), ...state.purchases.map((p) => p.debtGroup)].filter(Boolean))];
  const submit = (e) => {
    e.preventDefault();
    const a = parseMoney(f.amount);
    if (!a || !f.personId || f.personId === 'me') return;
    update((s) => {
      s.ledger = s.ledger || [];
      const item = { id: edit?.id || uid(), personId: f.personId, amount: f.kind === 'pay' ? -a : a, desc: f.desc.trim() || (f.kind === 'pay' ? 'Pagamento recebido' : 'Valor emprestado'), date: f.date, group: f.group.trim() };
      if (edit) s.ledger = s.ledger.map((x) => (x.id === edit.id ? item : x));
      else s.ledger.push(item);
    });
    onClose();
  };
  const del = () => { update((s) => { s.ledger = s.ledger.filter((x) => x.id !== edit.id); }); onClose(); };
  return (
    <Modal title={edit ? 'Editar lançamento' : f.kind === 'pay' ? 'Registrar pagamento' : 'Lançar valor que me devem'} onClose={onClose} footer={<Foot onCancel={onClose} onDelete={edit && del} />}>
      <form id="f" onSubmit={submit} className="form">
        <Segmented value={f.kind} onChange={set('kind')} options={[{ value: 'debt', label: 'Me deve' }, { value: 'pay', label: 'Me pagou' }]} />
        <Field group label="Pessoa"><PersonPicker value={f.personId} onChange={set('personId')} /></Field>
        <Field label="Valor"><MoneyInput value={edit ? Math.abs(edit.amount) : undefined} onChange={set('amount')} autoFocus /></Field>
        <Field label="Descrição"><input value={f.desc} onChange={set('desc')} placeholder={f.kind === 'pay' ? 'Ex.: Pix parcial da obra' : 'Ex.: material, empréstimo'} /></Field>
        <div className="row2">
          <Field label="Data"><input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="Grupo"><input list="ledger-groups" value={f.group} onChange={set('group')} placeholder="Ex.: Obra" /><datalist id="ledger-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Field>
        </div>
        {f.kind === 'pay' && <p className="note">O pagamento abate do saldo sem prazo da pessoa. Valores do mês a mês você marca direto na lista.</p>}
      </form>
    </Modal>
  );
}

export const FORMS = { tx: TxForm, purchase: PurchaseForm, bill: BillForm, card: CardForm, reserve: ReserveForm, extra: ExtraForm, ledger: LedgerForm };
