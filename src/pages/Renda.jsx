import React, { useRef, useState } from 'react';
import { Plus, Download, Upload, RotateCcw, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Field, MoneyInput, Empty, Segmented } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import {
  brl, num, parseMoney, monthName, extrasForMonth, seedState, emptyState, monthSummary, migrate, uid,
  incomeSources, incomeForMonth, tagIncomeTx, personByPixName,
} from '../lib.js';
import { X } from 'lucide-react';

// ---------- uma renda (fixa ou variável) ----------
const draftOf = (src) => ({
  name: src.name || '', kind: src.kind,
  parts: (src.parts?.length ? src.parts : [{ day: 5, amount: 0 }]).map((p) => ({ day: p.day, amount: p.amount ? num(p.amount) : '' })),
  day: src.day || 5, estimate: src.estimate ? num(src.estimate) : '',
});

function SourceBlock({ src }) {
  const { state, update, M } = useApp();
  const [d, setD] = useState(() => draftOf(src));
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setPart = (i, k, v) => setD((x) => ({ ...x, parts: x.parts.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(src));
  const info = incomeForMonth(state, M).find((r) => r.src.id === src.id);
  const partsTotal = d.parts.reduce((s, p) => s + parseMoney(p.amount), 0);

  const save = (e) => {
    e.preventDefault();
    update((st) => {
      const x = st.income.sources.find((y) => y.id === src.id);
      if (!x) return;
      x.name = d.name.trim() || (d.kind === 'fixa' ? 'Salário' : 'Renda variável');
      x.kind = d.kind;
      if (d.kind === 'fixa') {
        x.parts = d.parts.map((p) => ({ day: Math.min(31, Math.max(1, Number(p.day) || 1)), amount: parseMoney(p.amount) })).filter((p) => p.amount > 0).sort((a, b) => a.day - b.day);
        delete x.day; delete x.estimate;
      } else {
        x.day = Math.min(31, Math.max(1, Number(d.day) || 5));
        const est = parseMoney(d.estimate);
        if (est > 0) x.estimate = est; else delete x.estimate;
        delete x.parts;
      }
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  const remove = () => {
    if (!confirm(`Excluir a renda "${src.name}"? Os lançamentos que já caíram continuam no app, como entradas avulsas.`)) return;
    update((st) => {
      st.income.sources = st.income.sources.filter((y) => y.id !== src.id);
      for (const t of st.transactions) if (t.incomeSource === src.id) delete t.incomeSource;
    });
  };

  return (
    <form className="income-src" onSubmit={save}>
      <div className="is-head">
        <input className="inline-input is-name" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome (ex.: Colégio X)" aria-label="Nome da renda" />
        <Segmented value={d.kind} onChange={(v) => set('kind', v)} options={[{ value: 'fixa', label: 'Fixa' }, { value: 'variavel', label: 'Variável' }]} />
        <button type="button" className="icon-btn ghost" onClick={remove} aria-label="Excluir renda"><Trash2 size={16} /></button>
      </div>

      {d.kind === 'fixa' ? (
        <div className="field">
          <span className="field-label">Valor líquido — datas em que cai</span>
          <div className="salary-parts">
            {d.parts.map((p, i) => (
              <div key={i} className="sp-row">
                <span className="sp-day">dia<input type="number" min="1" max="31" value={p.day} onChange={(e) => setPart(i, 'day', e.target.value)} /></span>
                <span className="money-input"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={p.amount} onChange={(e) => setPart(i, 'amount', e.target.value)} /></span>
                {d.parts.length > 1 && <button type="button" className="icon-btn ghost" onClick={() => set('parts', d.parts.filter((_, j) => j !== i))} aria-label="Remover data"><X size={16} /></button>}
              </div>
            ))}
          </div>
          <div className="sp-foot">
            <button type="button" className="btn small" onClick={() => set('parts', [...d.parts, { day: 30, amount: '' }])}>+ Outra data</button>
            <span>Total no mês: <b>{brl(partsTotal)}</b></span>
          </div>
          <span className="field-hint">Dia 30/31 vira o último dia do mês quando o mês é mais curto.</span>
        </div>
      ) : (
        <div className="is-var">
          <div className="is-forecast">
            {info?.avg != null
              ? <>Previsão: <b>≈ {brl(info.avg)}</b> por mês <small className="muted">(média dos últimos 3 meses)</small></>
              : <>Ainda sem histórico. Quando o banco trouxer os pagamentos, a previsão vira a média dos últimos 3 meses.</>}
            {info && <small className="block">Em {monthName(M).toLowerCase()}: recebido <b>{brl(info.received)}</b>{info.estimated ? <> de ≈ {brl(info.expected)}</> : ''}</small>}
          </div>
          <div className="row2">
            <Field label="Dia em que costuma cair"><input type="number" min="1" max="31" value={d.day} onChange={(e) => set('day', e.target.value)} /></Field>
            {info?.avg == null && <Field label="Enquanto isso, quanto costuma receber?"><MoneyInput value={src.estimate} onChange={(v) => set('estimate', v)} /></Field>}
          </div>
        </div>
      )}

      <PayerNames src={src} />
      {dirty && <div><button className="btn primary small" type="submit">{saved ? 'Salvo ✓' : 'Salvar'}</button></div>}
      {!dirty && saved && <small className="green">Salvo ✓</small>}
    </form>
  );
}

// "No banco aparece como": nomes de quem paga essa renda (como em Pessoas)
function PayerNames({ src }) {
  const { state, update, saveNow, refresh } = useApp();
  const [v, setV] = useState('');
  const [msg, setMsg] = useState('');
  const names = src.payerNames || [];
  const clash = v.trim() && personByPixName(state, v.trim());
  const add = async (e) => {
    e.preventDefault();
    const name = v.trim();
    if (!name) return;
    let tagged = 0;
    update((st) => {
      const x = st.income.sources.find((y) => y.id === src.id);
      if (!x) return;
      if (!(x.payerNames || []).some((n) => n.toLowerCase() === name.toLowerCase())) x.payerNames = [...(x.payerNames || []), name];
      tagged = tagIncomeTx(st, x); // entradas já lançadas desse nome passam a contar nessa renda
    });
    setV('');
    // revê no banco os créditos que antes foram tratados como salário (só quando há banco conectado)
    setMsg(tagged ? `${tagged} entrada${tagged > 1 ? 's' : ''} já lançada${tagged > 1 ? 's' : ''} ligada${tagged > 1 ? 's' : ''} a essa renda. Conferindo o banco…` : 'Conferindo o banco…');
    try {
      await saveNow();
      const r = await fetch('/api/pluggy/reprocess-income', { method: 'POST' }).then((x) => x.json()).catch(() => ({}));
      await refresh();
      const found = r.income || 0;
      setMsg(r.ok || found ? `${tagged ? `${tagged} já lançada${tagged > 1 ? 's' : ''}` : 'Banco conferido'}${found ? ` · ${found} pagamento${found > 1 ? 's' : ''} novo${found > 1 ? 's' : ''} encontrado${found > 1 ? 's' : ''}` : ''} ✓` : tagged ? `${tagged} entrada${tagged > 1 ? 's' : ''} ligada${tagged > 1 ? 's' : ''} a essa renda ✓` : '');
    } catch { setMsg(''); }
    setTimeout(() => setMsg(''), 6000);
  };
  const removeName = (n) => update((st) => {
    const x = st.income.sources.find((y) => y.id === src.id);
    if (x) x.payerNames = (x.payerNames || []).filter((y) => y !== n);
  });
  return (
    <div className="pix-names is-names">
      <small>No banco aparece como {src.kind === 'variavel' ? <span className="muted">— quem paga (Pix, TED, folha)</span> : <span className="muted">— opcional, ajuda a reconhecer o crédito</span>}</small>
      <div className="pchips">
        {names.map((n) => (
          <span key={n} className="pix-name">{n}<button type="button" onClick={() => removeName(n)} aria-label={`Remover ${n}`}>×</button></span>
        ))}
        <span className="pix-add">
          <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(e)} placeholder={names.length ? '+ outro nome' : '+ nome de quem paga'} />
          {v.trim() && <button className="btn small primary" type="button" onClick={add}>Adicionar</button>}
        </span>
      </div>
      {clash && <small className="orange block"><AlertTriangle size={12} /> Esse nome também está em {clash.name} (A receber). Pix desse nome vão contar como renda, não como devolução.</small>}
      {(src.payerDocs || []).length > 0 && <small className="muted block">+ {src.payerDocs.length} CPF/CNPJ reconhecido{src.payerDocs.length > 1 ? 's' : ''} automaticamente</small>}
      {msg && <small className="muted block">{msg}</small>}
    </div>
  );
}

export default function Renda() {
  const { state, update, setState, M, openForm } = useApp();
  const [f, setF] = useState({ daily: state.dailyBudget, ref: state.housingRef || 30 });
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const s = monthSummary(state, M);
  const sources = incomeSources(state);
  const addSource = (kind) => update((st) => {
    st.income.sources = st.income.sources || [];
    const hasFixed = st.income.sources.some((x) => x.kind === 'fixa');
    st.income.sources.push(kind === 'fixa'
      ? { id: uid(), name: hasFixed ? 'Outra renda fixa' : 'Salário', kind, parts: [], payerNames: [] }
      : { id: uid(), name: 'Renda variável', kind, day: 5, payerNames: [] });
  });
  const save = (e) => {
    e.preventDefault();
    update((st) => {
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
      <PageHead title="Minhas rendas" icon="dollar_banknote" value={s.income}
        sub={`renda ${s.incomeEstimated ? 'prevista (≈) ' : ''}em ${monthName(M).toLowerCase()} · fixa ${brl(s.salary)}${s.variable ? ` · variável ${brl(s.variable)}` : ''}${s.extraIn ? ` · extras ${brl(s.extraIn)}` : ''}`}>
        <button className="btn small" onClick={() => addSource('fixa')}><Plus size={15} /> Renda fixa</button>
        <button className="btn small" onClick={() => addSource('variavel')}><Plus size={15} /> Renda variável</button>
        <button className="btn small" onClick={() => openForm('extra')}><Plus size={15} /> Renda extra</button>
      </PageHead>
      {state.sample && (
        <section className="card banner">
          <Sparkles size={18} />
          <span className="grow">Você está vendo <b>dados de exemplo</b>. Quando quiser começar com os seus, zere tudo aqui (ou importe dos bancos em <b>Bancos conectados</b>).</span>
          <button className="btn small primary" onClick={() => { if (confirm('Apagar os dados de exemplo e começar do zero?')) { setState(emptyState()); setF({ daily: 0, ref: 30 }); } }}>Começar do zero</button>
        </section>
      )}
      <div className="two-col">
        <section className="card">
          <h4 className="caps">Minhas rendas</h4>
          <p className="meta">
            <b>Fixa</b>: valor certo todo mês (salário). <b>Variável</b>: muda todo mês (hora-aula, comissão) — o app soma o que cai de quem paga e prevê pela média dos últimos 3 meses.
          </p>
          {sources.length === 0 && <Empty>Nenhuma renda cadastrada. Use <b>+ Renda fixa</b> ou <b>+ Renda variável</b>.</Empty>}
          {/* key inclui o conteúdo salvo: ao salvar/sincronizar, o rascunho recomeça do valor atual */}
          {sources.map((x) => <SourceBlock key={`${x.id}:${x.kind}:${JSON.stringify(x.parts || [])}:${x.day}:${x.estimate}:${x.name}`} src={x} />)}

          <h4 className="caps" style={{ marginTop: 28 }}>Rendas extras <span className="muted">(lançadas à mão)</span></h4>
          {extras.length === 0 && <Empty>Nenhuma renda extra cadastrada.</Empty>}
          <div className="list">
            {extras.map((e) => (
              <button key={e.id} className="list-row clickable" onClick={() => openForm('extra', e)}>
                <span className="grow"><b>{e.desc}</b><small>{e.recurring ? 'todo mês' : `só em ${monthName(e.month).toLowerCase()} ${e.month.slice(0, 4)}`}{monthExtras.includes(e) ? '' : ''}</small></span>
                <b className="green nowrap">+ {brl(e.amount)}</b>
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <h4 className="caps">Orçamento</h4>
          <form className="form" onSubmit={save}>
            <Field label="Orçamento do dia a dia (mês)" hint="Mercado, transporte, lanches… pago no débito/pix. Usado no saldo previsto."><MoneyInput value={state.dailyBudget} onChange={(v) => setF({ ...f, daily: v })} /></Field>
            <Field label="Referência de moradia (% da renda do trabalho)" hint="Quanto da renda fixa + variável, no máximo, você quer gastar pra morar."><input type="number" min="5" max="60" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Field>
            <div><button className="btn primary" type="submit">{saved ? 'Salvo ✓' : 'Salvar'}</button></div>
          </form>
          <h4 className="caps" style={{ marginTop: 28 }}>Seus dados</h4>
          <p className="meta">Tudo fica salvo neste computador (pasta <code>data/</code> do app). Faça backup de vez em quando.</p>
          <div className="btn-row">
            <button className="btn small" onClick={exportJson}><Download size={15} /> Exportar backup</button>
            <button className="btn small" onClick={() => fileRef.current.click()}><Upload size={15} /> Importar</button>
            <button className="btn small ghost" onClick={() => confirm('Carregar dados de exemplo? Isso substitui seus dados atuais.') && setState(migrate(seedState()))}><RotateCcw size={15} /> Dados de exemplo</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} />
          </div>
        </section>
      </div>
    </div>
  );
}
