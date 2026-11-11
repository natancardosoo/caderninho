import React, { useRef, useState } from 'react';
import { Plus, Download, Upload, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Field, MoneyInput, Empty } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { brl, num, parseMoney, monthName, extrasForMonth, seedState, emptyState, monthSummary, migrate, salaryParts } from '../lib.js';
import { X } from 'lucide-react';

export default function Renda() {
  const { state, update, setState, M, openForm } = useApp();
  const [f, setF] = useState({ daily: state.dailyBudget, ref: state.housingRef || 30 });
  const [parts, setParts] = useState(() => { const p = salaryParts(state); return p.length ? p.map((x) => ({ day: x.day, amount: num(x.amount) })) : [{ day: 5, amount: '' }]; });
  const setPart = (i, k, v) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const partsTotal = parts.reduce((s, p) => s + parseMoney(p.amount), 0);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const s = monthSummary(state, M);
  const save = (e) => {
    e.preventDefault();
    update((st) => {
      const clean = parts.map((p) => ({ day: Math.min(31, Math.max(1, Number(p.day) || 1)), amount: parseMoney(p.amount) })).filter((p) => p.amount > 0).sort((a, b) => a.day - b.day);
      st.income.parts = clean;
      st.income.salary = Math.round(clean.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      st.income.salaryDay = clean[0]?.day || 5;
      st.dailyBudget = parseMoney(f.daily);
      st.housingRef = Math.min(60, Math.max(5, Number(f.ref) || 30));
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importJson = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.bills || !data.income) throw new Error();
      if (confirm('Substituir todos os dados atuais pelo backup?')) setState(migrate(data));
    } catch { alert('Arquivo inválido.'); }
    e.target.value = '';
  };
  const extras = state.income.extras || [];
  const monthExtras = extrasForMonth(state, M);
  return (
    <div className="page">
      <PageHead title="Minha renda" icon="dollar_banknote" value={s.income} sub={`renda prevista em ${monthName(M).toLowerCase()} (salário + extras)`}>
        <button className="btn small" onClick={() => openForm('extra')}><Plus size={15} /> Renda extra</button>
      </PageHead>
      {state.sample && (
        <section className="card banner">
          <Sparkles size={18} />
          <span className="grow">Você está vendo <b>dados de exemplo</b>. Quando quiser começar com os seus, zere tudo aqui.</span>
          <button className="btn small primary" onClick={() => { if (confirm('Apagar os dados de exemplo e começar do zero?')) { setState(emptyState()); setF({ salary: 0, salaryDay: 5, daily: 0, ref: 30 }); } }}>Começar do zero</button>
        </section>
      )}
      <div className="two-col">
        <section className="card">
          <h4 className="caps">Salário e orçamento</h4>
          <form className="form" onSubmit={save}>
            <div className="field">
              <span className="field-label">Salário líquido — datas em que cai</span>
              <div className="salary-parts">
                {parts.map((p, i) => (
                  <div key={i} className="sp-row">
                    <span className="sp-day">dia<input type="number" min="1" max="31" value={p.day} onChange={(e) => setPart(i, 'day', e.target.value)} /></span>
                    <span className="money-input"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={p.amount} onChange={(e) => setPart(i, 'amount', e.target.value)} /></span>
                    {parts.length > 1 && <button type="button" className="icon-btn ghost" onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))} aria-label="Remover data"><X size={16} /></button>}
                  </div>
                ))}
              </div>
              <div className="sp-foot">
                <button type="button" className="btn small" onClick={() => setParts((ps) => [...ps, { day: 30, amount: '' }])}>+ Outra data</button>
                <span>Total no mês: <b>{brl(partsTotal)}</b></span>
              </div>
              <span className="field-hint">Dia 30/31 vira o último dia do mês quando o mês é mais curto.</span>
            </div>
            <Field label="Orçamento do dia a dia (mês)" hint="Mercado, transporte, lanches… pago no débito/pix. Usado no saldo previsto."><MoneyInput value={state.dailyBudget} onChange={(v) => setF({ ...f, daily: v })} /></Field>
            <Field label="Referência de moradia (% do salário)" hint="Quanto do salário, no máximo, você quer gastar pra morar."><input type="number" min="5" max="60" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Field>
            <div><button className="btn primary" type="submit">{saved ? 'Salvo ✓' : 'Salvar'}</button></div>
          </form>
        </section>
        <section className="card">
          <h4 className="caps">Rendas extras</h4>
          {extras.length === 0 && <Empty>Nenhuma renda extra cadastrada.</Empty>}
          <div className="list">
            {extras.map((e) => (
              <button key={e.id} className="list-row clickable" onClick={() => openForm('extra', e)}>
                <span className="grow"><b>{e.desc}</b><small>{e.recurring ? 'todo mês' : `só em ${monthName(e.month).toLowerCase()} ${e.month.slice(0, 4)}`}{monthExtras.includes(e) ? '' : ''}</small></span>
                <b className="green nowrap">+ {brl(e.amount)}</b>
              </button>
            ))}
          </div>
          <h4 className="caps" style={{ marginTop: 28 }}>Seus dados</h4>
          <p className="meta">Tudo fica salvo neste computador (pasta <code>data/</code> do app). Faça backup de vez em quando.</p>
          <div className="btn-row">
            <button className="btn small" onClick={exportJson}><Download size={15} /> Exportar backup</button>
            <button className="btn small" onClick={() => fileRef.current.click()}><Upload size={15} /> Importar</button>
            <button className="btn small ghost" onClick={() => confirm('Carregar dados de exemplo? Isso substitui seus dados atuais.') && setState(seedState())}><RotateCcw size={15} /> Dados de exemplo</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} />
          </div>
        </section>
      </div>
    </div>
  );
}
