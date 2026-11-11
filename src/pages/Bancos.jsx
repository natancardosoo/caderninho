import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Check, Pencil, AlertTriangle, RotateCcw } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Empty } from '../ui.jsx';
import { PageHead } from './Fluxo.jsx';
import { PluggyConnect } from 'pluggy-connect-sdk';
import { brl, fmtDate, personName } from '../lib.js';
import { Who } from '../people.jsx';

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
  const { state, update, setForm, refresh } = useApp();
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

  const review = [
    ...state.purchases.filter((p) => p.review).map((p) => ({ kind: 'purchase', x: p, where: state.cards.find((c) => c.id === p.cardId)?.name || 'Cartão' })),
    ...state.transactions.filter((t) => t.review).map((t) => ({ kind: 'tx', x: t, where: t.type === 'in' ? 'Entrada na conta' : 'Saída da conta' })),
  ].sort((a, b) => b.x.date.localeCompare(a.x.date));
  const key = (k) => (k === 'purchase' ? 'purchases' : 'transactions');
  const confirm = (it) => update((s) => { const r = s[key(it.kind)].find((y) => y.id === it.x.id); if (r) delete r.review; });
  const confirmAll = () => update((s) => { for (const k of ['purchases', 'transactions']) for (const r of s[k]) delete r.review; });
  const discard = (it) => update((s) => { s[key(it.kind)] = s[key(it.kind)].filter((y) => y.id !== it.x.id); });

  const res = st?.lastResult;
  return (
    <div className="page">
      <PageHead title="Bancos conectados" icon="classical_building"
        sub={st ? `Open Finance via Meu Pluggy · sincroniza todo dia às ${st.syncHour}h · última: ${when(st.lastSync)}` : 'carregando…'}>
        <button className="btn primary small" disabled={!st?.configured || !!busy} onClick={() => openConnect()}><Plus size={15} /> Conectar banco</button>
        <button className="btn small" disabled={!st?.configured || !st?.items?.length || !!busy} onClick={syncNow}>
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
              {res.error ? res.error : <>{res.purchases} compras e {res.transactions} lançamentos novos, {res.billsPaid} contas marcadas como pagas, {res.linked} já existiam no app, {res.skipped} ignorados (salário, investimentos, transferências entre suas contas, pagamento de fatura).</>}
              {res.errors?.length > 0 && <><br /><span className="red">{res.errors.join(' · ')}</span></>}
            </p>
          )}
        </section>

        <section className="card">
          <div className="sec-head">
            <span>Para revisar</span>
            <span>{review.length > 0 && <button className="btn small" onClick={confirmAll}><Check size={14} /> Confirmar todos</button>}</span>
          </div>
          {review.length === 0 && <Empty>Tudo revisado. O que chegar dos bancos aparece aqui primeiro.</Empty>}
          <p className="note" style={review.length ? {} : { display: 'none' }}>Toque no lápis para conferir categoria e quem paga. Pix que você fez por alguém: marque a pessoa em <b>Quem paga?</b>. Dinheiro que alguém te devolveu: marque em <b>De quem é esse dinheiro?</b>. Os dois vão para <b>A receber → Em aberto</b> e não contam como gasto ou renda seus.</p>
          <div className="list">
            {review.map((it) => (
              <div key={it.kind + it.x.id} className="list-row">
                <span className="grow">
                  <b>{it.x.desc}</b>
                  <small>{fmtDate(it.x.date)} · {it.where} · {it.x.category}{it.x.installments > 1 ? ` · ${it.x.installments}x` : ''}{it.x.reimbFrom ? ` · devolução de ${personName(state, it.x.reimbFrom)}` : ''}</small>
                  {it.x.type !== 'in' && <Who item={it.x} />}
                </span>
                <b className={`nowrap ${it.kind === 'tx' && it.x.type === 'in' ? 'green' : ''}`}>{brl(it.x.amount)}</b>
                <button className="icon-btn ghost" title="Editar" onClick={() => setForm({ type: it.kind, data: it.x })}><Pencil size={15} /></button>
                <button className="icon-btn ghost" title="Confirmar" onClick={() => confirm(it)}><Check size={16} /></button>
                <button className="icon-btn ghost" title="Excluir (não volta a ser importado)" onClick={() => discard(it)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
