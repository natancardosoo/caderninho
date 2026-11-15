import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useApp } from './store.jsx';
import { uid, PEOPLE_COLORS, personOf, sharesOf, brl, num, parseMoney, round2, TX_GROUP } from './lib.js';
import { Segmented } from './ui.jsx';

export function Avatar({ person, size = 20 }) {
  const name = person?.name || '?';
  return (
    <span className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.48), background: person?.color || '#64748b', borderWidth: 0 }}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

export function useAddPerson() {
  const { state, update } = useApp();
  return (name) => {
    const n = name.trim();
    if (!n) return null;
    const existing = (state.people || []).find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (existing) return existing.id;
    const id = uid();
    const color = PEOPLE_COLORS[(state.people || []).length % PEOPLE_COLORS.length];
    update((s) => { s.people = s.people || []; s.people.push({ id, name: n, color }); });
    return id;
  };
}

// fileira de chips: [Eu] [Ana] [Bruno] [+ Pessoa]
export function PersonPicker({ value = 'me', onChange, compact }) {
  const { state } = useApp();
  const add = useAddPerson();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const me = state.profile.name || 'Eu';
  const commit = () => {
    const id = add(name);
    if (id) onChange(id);
    setAdding(false);
    setName('');
  };
  return (
    <div className={`person-picker ${compact ? 'compact' : ''}`}>
      <button type="button" className={`pchip ${!value || value === 'me' ? 'on' : ''}`} style={{ '--pc': 'var(--blue)' }} onClick={() => onChange('me')}>
        <span className="av" style={{ background: 'var(--blue)' }}>{me[0].toUpperCase()}</span>Eu
      </button>
      {(state.people || []).map((p) => (
        <button type="button" key={p.id} className={`pchip ${value === p.id ? 'on' : ''}`} style={{ '--pc': p.color }} onClick={() => onChange(p.id)}>
          <Avatar person={p} />{p.name}
        </button>
      ))}
      {adding ? (
        <span className="pchip adding">
          <input autoFocus value={name} placeholder="Nome" onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setAdding(false); }}
            onBlur={() => (name.trim() ? commit() : setAdding(false))} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Adicionar"><Check size={14} /></button>
        </span>
      ) : (
        <button type="button" className="pchip ghost" onClick={() => setAdding(true)}><Plus size={14} /> Pessoa</button>
      )}
    </div>
  );
}

// selo pequeno ao lado do nome de uma conta/compra (mostra todos que dividem)
export function Who({ item, payer, mode }) {
  const { state } = useApp();
  const shares = item ? sharesOf(item) : sharesOf({ payer });
  const others = shares.filter((s) => s.id !== 'me').map((s) => ({ ...s, p: personOf(state, s.id) })).filter((s) => s.p);
  if (!others.length) return null;
  const m = item?.otherMode ?? mode;
  if (shares.length === 1) {
    const o = others[0].p;
    return <span className="who" style={{ '--pc': o.color }} title={m === 'direto' ? `${o.name} paga direto` : `${o.name} te devolve`}><Avatar person={o} size={15} />{o.name}</span>;
  }
  const hasMe = shares.some((s) => s.id === 'me');
  return (
    <span className="who split" title={shares.map((s) => `${s.id === 'me' ? 'Você' : personOf(state, s.id)?.name}: ${Math.round(s.share * 100)}%`).join(' · ')}>
      <span className="stack">{others.slice(0, 3).map((o) => <Avatar key={o.id} person={o.p} size={15} />)}</span>
      {hasMe ? `dividido c/ ${others.length === 1 ? others[0].p.name : `${others.length} pessoas`}` : `${others.length} pessoas`}
    </span>
  );
}

// "Quem paga?" com várias pessoas: tocar inclui/remove; divide igual ou por valor.
// total = valor de um mês/parcela; full = valor da compra inteira (só em compras parceladas):
// aí os valores podem ser digitados sobre a compra toda e o app acha a proporção sozinho.
export function SplitEditor({ total = 0, full, value, onChange }) {
  const { state } = useApp();
  const add = useAddPerson();
  const init = value?.length ? value : [{ id: 'me', share: 1 }];
  const [sel, setSel] = useState(init.map((s) => s.id));
  const equalInit = init.every((s) => Math.abs(s.share - init[0].share) < 0.001);
  const [mode, setMode] = useState(equalInit ? 'equal' : 'custom');
  const parcelado = full > 0 && Math.abs(full - total) > 0.009;
  const [onFull, setOnFull] = useState(true);
  const useFull = parcelado && onFull;
  const base = useFull ? full : total; // sobre qual valor os campos são digitados
  const [amounts, setAmounts] = useState(() => Object.fromEntries(init.map((s) => [s.id, num(s.share * (parcelado ? full : total))])));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const me = state.profile.name || 'Eu';
  const people = [{ id: 'me', name: 'Eu', color: 'var(--blue)', initial: me[0].toUpperCase() }, ...(state.people || [])];

  const compute = (sel2, mode2, am) => {
    if (!sel2.length) return [{ id: 'me', share: 1 }];
    if (sel2.length === 1 || mode2 === 'equal') return sel2.map((id) => ({ id, share: 1 / sel2.length }));
    const others = sel2.filter((id) => id !== 'me');
    const vals = Object.fromEntries(others.map((id) => [id, parseMoney(am[id] || 0)]));
    if (sel2.includes('me')) vals.me = Math.max(base - others.reduce((a, id) => a + vals[id], 0), 0);
    const sum = Object.values(vals).reduce((a, b) => a + b, 0) || 1;
    return sel2.map((id) => ({ id, share: vals[id] / sum }));
  };
  const emit = (sel2, mode2 = mode, am = amounts) => onChange(compute(sel2, mode2, am));
  const toggle = (id) => {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    const am = { ...amounts };
    if (!sel.includes(id) && mode === 'custom') am[id] = am[id] || '0,00';
    setSel(next); setAmounts(am); emit(next, mode, am);
  };
  const commitNew = () => {
    const id = add(name);
    if (id && !sel.includes(id)) { const next = [...sel, id]; setSel(next); emit(next); }
    setAdding(false); setName('');
  };
  const shares = compute(sel, mode, amounts);
  const shareOf = (id) => shares.find((s) => s.id === id)?.share || 0;
  const othersSum = sel.filter((id) => id !== 'me').reduce((a, id) => a + parseMoney(amounts[id] || 0), 0);
  const diff = round2(base - othersSum);
  const switchBase = (f) => {
    if (f === useFull) return;
    const to = f ? full : total;
    const am = Object.fromEntries(sel.map((id) => [id, num(shareOf(id) * to)]));
    setOnFull(f); setAmounts(am);
  };

  return (
    <div className="split-ed">
      <div className="person-picker">
        {people.map((p) => (
          <button type="button" key={p.id} className={`pchip ${sel.includes(p.id) ? 'on' : ''}`} style={{ '--pc': p.color }} onClick={() => toggle(p.id)}>
            {p.id === 'me' ? <span className="av" style={{ background: 'var(--blue)' }}>{p.initial}</span> : <Avatar person={p} />}{p.name}
          </button>
        ))}
        {adding ? (
          <span className="pchip adding">
            <input autoFocus value={name} placeholder="Nome" onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitNew(); } if (e.key === 'Escape') setAdding(false); }}
              onBlur={() => (name.trim() ? commitNew() : setAdding(false))} />
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitNew}><Check size={14} /></button>
          </span>
        ) : <button type="button" className="pchip ghost" onClick={() => setAdding(true)}><Plus size={14} /> Pessoa</button>}
      </div>
      {sel.length === 0 && <small className="split-hint">Ninguém marcado: conta como sua.</small>}
      {sel.length > 1 && (
        <div className="split-box">
          <Segmented value={mode} onChange={(m) => {
            const am = m === 'custom' ? Object.fromEntries(sel.map((id) => [id, num(shareOf(id) * base)])) : amounts;
            setMode(m); setAmounts(am); emit(sel, m, am);
          }} options={[{ value: 'equal', label: 'Dividir igual' }, { value: 'custom', label: 'Valor de cada um' }]} />
          {parcelado && mode === 'custom' && (
            <Segmented value={useFull ? 'full' : 'part'} onChange={(v) => switchBase(v === 'full')}
              options={[{ value: 'full', label: `Da compra toda (${brl(full)})` }, { value: 'part', label: `Por parcela (${brl(total)})` }]} />
          )}
          {sel.map((id) => {
            const p = people.find((x) => x.id === id);
            const auto = mode === 'equal' || id === 'me';
            return (
              <div key={id} className="split-row">
                {id === 'me' ? <span className="av" style={{ background: 'var(--blue)', width: 22, height: 22, fontSize: 10.5, borderWidth: 0 }}>{p.initial}</span> : <Avatar person={p} size={22} />}
                <span className="grow">{id === 'me' ? 'Você' : p?.name}</span>
                {parcelado && <small className="split-sub">{useFull || auto ? `${brl(shareOf(id) * total)}/parcela` : `${brl(shareOf(id) * full)} no total`}</small>}
                {auto ? <b>{brl(shareOf(id) * base)}</b> : (
                  <span className="money-input sm"><span>R$</span>
                    <input inputMode="decimal" value={amounts[id] ?? ''} onChange={(e) => { const am = { ...amounts, [id]: e.target.value }; setAmounts(am); emit(sel, mode, am); }} />
                  </span>
                )}
              </div>
            );
          })}
          {mode === 'custom' && !sel.includes('me') && Math.abs(diff) > 0.009 && <small className="split-hint orange">{diff > 0 ? `Faltam ${brl(diff)} para fechar ${brl(base)}` : `Passou ${brl(-diff)} do total`} — os valores serão ajustados proporcionalmente.</small>}
          {mode === 'custom' && sel.includes('me') && <small className="split-hint">Sua parte é o que sobra.</small>}
          {total > 0 && <small className="split-hint">{parcelado
            ? `Divisão sobre ${useFull ? `a compra toda (${brl(full)})` : `a parcela (${brl(total)})`}. Todas as parcelas seguem a mesma proporção.`
            : `Divisão sobre ${brl(total)}. Nos outros meses vale a mesma proporção.`}</small>}
        </div>
      )}
    </div>
  );
}

// grupos do saldo devedor (Obra, Empréstimo...): escolhe com um toque ou cria um novo
export function useDebtGroups() {
  const { state } = useApp();
  const txs = state.transactions || [];
  const hasTx = txs.some((t) => !t.debtGroup && (t.reimbFrom || (t.type === 'out' && sharesOf(t).some((sh) => sh.id !== 'me'))));
  return [...new Set([...(state.ledger || []).map((e) => e.group), ...state.purchases.map((p) => p.debtGroup), ...txs.map((t) => t.debtGroup), hasTx && TX_GROUP].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
export function GroupPicker({ value = '', onChange, noneLabel = 'Sem grupo' }) {
  const groups = useDebtGroups().filter((g) => g !== noneLabel);
  const [adding, setAdding] = useState(false);
  const custom = value && !groups.includes(value);
  const chip = (label, v, on) => (
    <button type="button" key={label} className={`pchip ${on ? 'on' : ''}`} style={{ '--pc': 'var(--blue)' }} onClick={() => { setAdding(false); onChange(v); }}>
      {on && <Check size={13} />}{label}
    </button>
  );
  return (
    <div className="group-picker">
      <div className="pchips">
        {chip(noneLabel, '', !value && !adding)}
        {groups.map((g) => chip(g, g, value === g && !adding))}
        <button type="button" className={`pchip ${adding || custom ? 'on' : ''}`} style={{ '--pc': 'var(--blue)' }} onClick={() => { setAdding(true); if (!custom) onChange(''); }}>
          <Plus size={13} />{custom && !adding ? value : 'Novo grupo'}
        </button>
      </div>
      {(adding || custom) && <input className="name-input" autoFocus={adding} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nome do grupo (ex.: Obra, Empréstimo)" />}
    </div>
  );
}

// quando a(s) pessoa(s) devolvem: junto com a fatura (todo mês) ou depois, sem prazo (vai pro saldo devedor)
export function SettleField({ settle, group, onChange }) {
  return (
    <div className="settle">
      <Segmented value={settle === 'later' ? 'later' : 'monthly'} onChange={(v) => onChange({ settle: v === 'later' ? 'later' : undefined, group })}
        options={[{ value: 'monthly', label: 'Devolve todo mês' }, { value: 'later', label: 'Paga depois, sem prazo' }]} />
      {settle === 'later' && (
        <label className="field">
          <span className="field-hint">O valor total (todas as parcelas) entra no saldo devedor da pessoa. No seu caixa, a fatura continua sendo sua.</span>
          <GroupPicker value={group || ''} onChange={(g) => onChange({ settle: 'later', group: g })} />
        </label>
      )}
    </div>
  );
}
