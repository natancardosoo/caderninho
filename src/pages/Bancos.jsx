import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, AlertTriangle, RotateCcw, Inbox, History, Sparkles } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Empty } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { PluggyConnect } from 'pluggy-connect-sdk';
import { reviewQueue, monthName, addMonths, currentMk, monthDiff } from '../lib.js';

const monthLabel = (M) => `${monthName(M).toLowerCase()}/${M.slice(0, 4)}`;
const HISTORY_OPTIONS = [0, 1, 2, 3, 6, 12];

const STATUS = {
  UPDATED: ['Atualizado', 'green'], UPDATING: ['Atualizando…', ''], LOGIN_ERROR: ['Precisa reconectar', 'red'],
  OUTDATED: ['Desatualizado', 'orange'], WAITING_USER_INPUT: ['Aguardando você', 'orange'],
};
const when = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

async function call(path, method = 'GET', body) {
  const r = await fetch(`/api/pluggy${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}

export default function Bancos() {
  const { state, refresh, go } = useApp();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => call('/status').then(setSt).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const openConnect = async (itemId) => {
    setErr(''); setBusy(itemId ? `re:${itemId}` : 'connect');
    try {
      const { accessToken, connectorIds } = await call('/connect-token', 'POST', { itemId });
      const pc = new PluggyConnect({
        connectToken: accessToken, updateItem: itemId, connectorIds, language: 'pt', theme: state.theme === 'dark' ? 'dark' : 'light',
        onSuccess: async ({ item }) => { await call('/items', 'POST', { itemId: item.id }); load(); },
        onError: (e) => setErr(e?.message || 'Falha ao conectar'),
        onClose: () => setBusy(''),
      });
      await pc.init();
    } catch (e) { setErr(e.message); setBusy(''); }
  };
  const syncNow = async () => {
    setErr(''); setBusy('sync');
    try { const r = await call('/sync', 'POST'); if (!r.ok && r.error) setErr(r.error); await load(); await refresh(); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const remove = async (id) => { await call(`/items/${id}`, 'DELETE'); load(); };

  // importação de histórico: com dados de exemplo, apaga os exemplos e começa do zero com os dados do banco
  const cur = currentMk();
  const since = state.trackingStart || cur;
  const already = Math.max(0, monthDiff(since, cur)); // meses antes do atual que já estão no app
  const options = state.sample ? HISTORY_OPTIONS : HISTORY_OPTIONS.filter((n) => n > already && n <= (st?.maxHistoryMonths || 12));
  const [months, setMonths] = useState(2);
  const pick = options.includes(months) ? months : options[0];
  const importHistory = async () => {
    const from = monthLabel(addMonths(cur, -pick));
    const msg = state.sample
      ? `Apagar os dados de exemplo e importar dos bancos tudo desde ${from}?`
      : `Trazer dos bancos tudo desde ${from}? O que já está no app não é duplicado.`;
    if (!confirm(msg)) return;
    setErr(''); setBusy('history');
    try { const r = await call('/history', 'POST', { months: pick }); if (!r.ok && r.error) setErr(r.error); await load(); await refresh(); } catch (e) { setErr(e.message); }
    setBusy('');
  };

  const pending = reviewQueue(state).length;

  const res = st?.lastResult;
  return (
    <div className="page">
      <PageHead title="Bancos conectados" icon="classical_building"
        sub={st ? `Open Finance via Meu Pluggy · sincroniza todo dia às ${st.syncHour}h · última: ${when(st.lastSync)}` : 'carregando…'}>
        <button className="btn primary small" disabled={!st?.configured || !!busy} onClick={() => openConnect()}><Plus size={15} /> Conectar banco</button>
        <button className="btn small" disabled={!st?.configured || !st?.items?.length || !!busy || state.sample} onClick={syncNow}>
          <RefreshCw size={15} className={busy === 'sync' ? 'spin' : ''} /> {busy === 'sync' ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>
      </PageHead>

      {err && <section className="card"><p className="note red"><AlertTriangle size={14} /> {err}</p></section>}

      {st && !st.configured && (
        <section className="card">
          <div className="sec-head"><span>Falta configurar</span></div>
          <p className="note">Preencha <b>PLUGGY_CLIENT_ID</b> e <b>PLUGGY_CLIENT_SECRET</b> no arquivo <code>.env</code> da pasta do app (credenciais do dashboard.pluggy.ai). Não precisa reiniciar.</p>
        </section>
      )}

      {st?.configured && (state.sample || options.length > 0) && (
        <section className={`card ${state.sample ? 'banner' : ''} history-card`}>
          {state.sample ? <Sparkles size={18} /> : <History size={18} />}
          <span className="grow">
            {state.sample
              ? <><b>Começar com meus dados.</b> O app está com dados de exemplo. Escolha quantos meses trazer dos bancos: os exemplos são apagados e entra o que é seu.{!st.items.length && <> Conecte um banco primeiro.</>}</>
              : <><b>Histórico.</b> O app acompanha desde {monthLabel(since)}. Dá pra trazer meses anteriores (a Pluggy guarda até {st.maxHistoryMonths || 12} meses).</>}
          </span>
          <select value={pick} onChange={(e) => setMonths(Number(e.target.value))} disabled={!!busy} aria-label="Período">
            {options.map((n) => <option key={n} value={n}>{n === 0 ? 'Só este mês' : `Desde ${monthLabel(addMonths(cur, -n))} (${n} ${n > 1 ? 'meses' : 'mês'} antes)`}</option>)}
          </select>
          <button className="btn small primary" disabled={!st.items.length || !!busy} onClick={importHistory}>
            {busy === 'history' ? <><RefreshCw size={15} className="spin" /> Importando…</> : state.sample ? 'Apagar exemplos e importar' : 'Trazer histórico'}
          </button>
        </section>
      )}

      <div className="two-col">
        <section className="card">
          <div className="sec-head"><span>Conexões</span><span>{st?.items?.length || 0}</span></div>
          {st?.configured && !st.items.length && <Empty><span>Nenhum banco conectado. Toque em <b>Conectar banco</b>, escolha <b>Meu Pluggy</b> e autorize cada banco.</span></Empty>}
          <div className="list">
            {(st?.items || []).map((i) => {
              const [label, color] = STATUS[i.status] || [i.status || '—', ''];
              return (
                <div key={i.id} className="list-row">
                  {i.imageUrl && !/sandbox/.test(i.imageUrl) ? <img src={i.imageUrl} alt="" width={34} height={34} style={{ borderRadius: 9 }} /> : <span className="tile" />}
                  <span className="grow"><b>{i.institution || i.name || 'Banco'}</b><small className={color}>{label} · atualizado {when(i.lastUpdatedAt)}</small></span>
                  <button className="icon-btn ghost" title="Reconectar" disabled={!!busy} onClick={() => openConnect(i.id)}><RotateCcw size={16} /></button>
                  <button className="icon-btn ghost" title="Remover do app" onClick={() => remove(i.id)}><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
          {res && (
            <p className="note">
              {res.ok ? 'Última sincronização' : 'Última sincronização com problemas'} ({res.reason}, {when(res.at)}):{' '}
              {res.error ? res.error : <>{res.purchases} compras e {res.transactions} lançamentos novos,{res.income ? ` ${res.income} pagamentos de renda variável,` : ''} {res.billsPaid} contas marcadas como pagas, {res.linked} já existiam no app, {res.skipped} ignorados (renda fixa, investimentos, transferências entre suas contas, pagamento de fatura).</>}
              {res.errors?.length > 0 && <><br /><span className="red">{res.errors.join(' · ')}</span></>}
            </p>
          )}
        </section>

        <section className="card">
          <div className="sec-head"><span>Para revisar</span><span>{pending}</span></div>
          {pending === 0
            ? <Empty>Tudo revisado. O que chegar dos bancos aparece primeiro na tela Para revisar.</Empty>
            : <p className="note">{pending} lançamento{pending > 1 ? 's' : ''} esperando você conferir quem paga e a categoria.</p>}
          <div className="btn-row"><button className={`btn small ${pending ? 'primary' : ''}`} onClick={() => go('/revisar')}><Inbox size={15} /> Abrir Para revisar</button></div>
        </section>
      </div>
    </div>
  );
}
