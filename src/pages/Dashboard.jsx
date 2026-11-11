import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Pencil, ChevronLeft, ChevronRight, Check, ArrowRight } from 'lucide-react';
import { useApp } from '../store.jsx';
import { Money, Icon3D, Check3, Segmented, BillIcon, Empty, WalletIllustration } from '../ui.jsx';
import { BankCard, useInvoiceModal, dueText, InvoiceSplit } from '../components.jsx';
import {
  monthSummary, payables, brl, num, pct, monthName, monthShort, addMonths, parseMk, invoiceTotal, invoiceStatus,
  billsForMonth, reserveTotal, reserveEntries, currentMk, dateOf, daysUntil, receivablesByPerson, personName, isMine, peopleIn, MONTHS_SHORT,
} from '../lib.js';
import { FinancingModal, PayableModal } from '../components.jsx';
import { Who, Avatar } from '../people.jsx';


function SaldoCard({ s }) {
  const { go } = useApp();
  const base = Math.max(s.income, 1);
  const free = (s.sobra / base) * 100;
  const segs = [
    { k: 'casa', v: s.casa, c: 'var(--navy)' },
    { k: 'pes', v: s.pessoais, c: 'var(--blue)' },
    { k: 'dia', v: s.diaADia, c: 'var(--bar-gray)' },
    { k: 'sobra', v: Math.max(s.sobra, 0), c: 'var(--green)' },
  ];
  const tot = segs.reduce((a, b) => a + b.v, 0) || 1;
  return (
    <section className="card saldo area-saldo">
      <div className="card-head">
        <h2>Saldo previsto</h2>
        <WalletIllustration size={136} className="float-icon wallet-float" />
      </div>
      <div className="saldo-hero">
        <Money v={s.sobra} size="xxl" className={s.sobra < 0 ? 'neg' : ''} />
        <div className="saldo-note">
          <b className={s.sobra >= 0 ? 'green' : 'red'}>
            {s.sobra >= 0 ? <ArrowUpRight size={16} strokeWidth={2.4} /> : <ArrowDownRight size={16} strokeWidth={2.4} />}
            {s.sobra >= 0 ? `${pct(free)} do salário livre` : `faltam ${brl(-s.sobra)} este mês`}
          </b>
          <span>{s.sobra >= 0 ? 'valor estimado após pagar todas as contas' : 'as contas passam da renda — vai sair da reserva'}</span>
        </div>
      </div>
      <div className="seg-bar">
        {segs.map((g) => g.v > 0 && <i key={g.k} style={{ width: `${(g.v / tot) * 100}%`, background: g.c }} />)}
      </div>
      <div className="saldo-legend">
        <div className="lg clickable" onClick={() => go('/renda')}>
          <small>{s.extraIn > 0 ? 'Renda do mês' : 'Salário'}</small>
          <b>{brl(s.income)} <Pencil size={13} className="muted" /></b>
        </div>
        <div className="lg"><small><i className="dot" style={{ background: 'var(--navy)' }} />Contas da casa</small><b>− {brl(s.casa)} <em>· {pct((s.casa / base) * 100)}</em></b></div>
        <div className="lg"><small><i className="dot" style={{ background: 'var(--blue)' }} />Contas pessoais</small><b>− {brl(s.pessoais)} <em>· {pct((s.pessoais / base) * 100)}</em></b></div>
        <div className="lg"><small><i className="dot" style={{ background: 'var(--bar-gray)' }} />Dia a dia</small><b>− {brl(s.diaADia)} <em>· {pct((s.diaADia / base) * 100)}</em></b></div>
        <div className="lg"><small><i className="dot" style={{ background: 'var(--green)' }} /><b>= Sobra</b></small><b className={s.sobra >= 0 ? 'green' : 'red'}>{brl(s.sobra)} <em>· {pct(free)}</em></b></div>
      </div>
      {/* versão mobile da legenda (lista) */}
      <div className="saldo-list">
        {[
          ['Contas da casa', s.casa, 'var(--navy)'],
          ['Contas pessoais', s.pessoais, 'var(--blue)'],
          ['Dia a dia', s.diaADia, 'var(--bar-gray)'],
        ].map(([l, v, c]) => (
          <div key={l} className="sl-row"><span><i className="dot" style={{ background: c }} />{l}</span><b>{brl(v)}</b><em>{pct((v / base) * 100)}</em></div>
        ))}
        <div className="sl-row strong"><span><i className="dot" style={{ background: 'var(--green)' }} />Sobra</span><b className={s.sobra >= 0 ? 'green' : 'red'}>{brl(s.sobra)}</b><em>{pct(free)}</em></div>
        <button className="salary-pill" onClick={() => go('/renda')}><span>Renda</span><b>{brl(s.income)}</b><Pencil size={14} /></button>
      </div>
    </section>
  );
}

function ContasCard({ M, list }) {
  const { togglePaid } = useApp();
  const days = useMemo(() => [...new Set(list.map((p) => p.day))].sort((a, b) => a - b), [list]);
  const firstOpen = days.find((d) => list.some((p) => p.day === d && !p.paid)) ?? days[0];
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(null);
  const day = days.includes(sel) ? sel : firstOpen;
  const total = list.filter((p) => p.iPay).reduce((s, p) => s + p.amount, 0);
  const paidCount = list.filter((p) => p.paid).length;
  const dayItems = list.filter((p) => p.day === day);
  return (
    <section className="card contas area-contas">
      <div className="card-head">
        <h2>Contas a pagar {day && <span className="sub">• dia {String(day).padStart(2, '0')}</span>}</h2>
        <Icon3D name="spiral_calendar" size={84} className="float-icon sm" />
      </div>
      <Money v={total} size="lg" />
      <p className="meta">{day ? dueText(M, day) : 'sem contas'} · <b>{paidCount} de {list.length} pagas</b></p>
      {days.length > 0 && (
        <div className="day-chips">
          {days.map((d) => {
            const items = list.filter((p) => p.day === d);
            const allPaid = items.every((p) => p.paid);
            return (
              <button key={d} className={`chip ${d === day ? 'on' : ''} ${allPaid ? 'done' : ''}`} onClick={() => setSel(d)}>
                <b>{String(d).padStart(2, '0')}</b>
                <span className="dots">{items.slice(0, 5).map((p, i) => <i key={i} />)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="pay-list scroll-fade">
        {dayItems.length === 0 && <Empty>Cadastre suas contas em Ajustes → Contas fixas.</Empty>}
        {dayItems.map((p) => (
          <div key={p.id} className={`pay-row ${p.paid ? 'paid' : ''}`} onClick={() => setOpen(p)} title="Editar valor e quem paga">
            <Check3 checked={p.paid} onChange={(v) => togglePaid(M, p.id, v)} />
            <span className="grow">{p.name} <Who item={p} /></span>
            <b>{p.estimated && '≈ '}{brl(p.amount)}</b>
            <ChevronRight size={15} className="faint-ic" />
          </div>
        ))}
      </div>
      {open && <PayableModal item={open} M={M} onClose={() => setOpen(null)} />}
    </section>
  );
}

function DistribuicaoCard({ M, list: all }) {
  const { togglePaid, state, go } = useApp();
  // só a minha parte: contas de outras pessoas saem, fatura entra só com o que é meu
  const list = all.filter((p) => p.mine).map((p) => ({ ...p, amount: p.myAmount ?? p.amount }));
  const owe = receivablesByPerson(state, M).filter((g) => g.pending > 0);
  const oweTotal = owe.reduce((s, g) => s + g.pending, 0);
  const casa = list.filter((p) => p.group === 'casa').reduce((s, p) => s + p.amount, 0);
  const pes = list.filter((p) => p.group !== 'casa').reduce((s, p) => s + p.amount, 0);
  const total = casa + pes;
  const pc = total ? (casa / total) * 100 : 50;
  const sorted = [...list].sort((a, b) => b.amount - a.amount);
  const next = list.filter((p) => !p.paid).sort((a, b) => a.day - b.day)[0];
  return (
    <section className="card divisao area-div">
      <div className="card-head">
        <h2>Para onde vai</h2>
        <Icon3D name="balance_scale" size={88} className="float-icon sm" />
      </div>
      <small className="label">Total das contas</small>
      <Money v={total} size="lg" />
      <div className="split-head">
        <div><small><i className="dot" style={{ background: 'var(--blue)' }} />Casa</small><b>{brl(casa)}</b></div>
        <div className="right"><small>Pessoal &amp; cartões<i className="dot r" style={{ background: 'var(--pink)' }} /></small><b>{brl(pes)}</b></div>
      </div>
      <div className="split-bar">
        <div className="sb-a" style={{ width: `${pc}%` }}>{pc >= 12 && <span>{num(pc).replace(/,(\d)\d$/, ',$1')}%</span>}</div>
        <div className="sb-b">{100 - pc >= 12 && <span>{num(100 - pc).replace(/,(\d)\d$/, ',$1')}%</span>}</div>
        <i className="sb-mark" style={{ left: `${pc}%` }} />
      </div>
      <h4>Cada conta do mês</h4>
      <div className="dist-list scroll-fade">
        {sorted.map((p) => (
          <div key={p.id} className={`dist-row ${p.paid ? 'paid' : ''}`}>
            <i className="dot" style={{ background: p.group === 'casa' ? 'var(--blue)' : 'var(--pink)' }} />
            <span className="grow">{p.name}</span>
            <b>{brl(p.amount)}</b>
          </div>
        ))}
        {sorted.length === 0 && <Empty>Sem contas neste mês.</Empty>}
      </div>
      <div className="card-foot">
        {owe.length > 0 ? (
          <>
            <span className="pair">
              <span className="stack">{owe.slice(0, 3).map((g) => <Avatar key={g.person.id} person={g.person} />)}</span>
              <ArrowRight size={12} className="muted" /><span className="av xs blue">{(state.profile.name || 'V')[0].toUpperCase()}</span>
            </span>
            <span className="grow foot-text">
              {owe.length === 1 ? <>{owe[0].person.name} te devolve</> : <>{owe.length} pessoas te devolvem</>} <b>{brl(oweTotal)}</b> no Pix
            </span>
            {owe.length === 1
              ? <button className="btn small" onClick={() => owe[0].items.filter((i) => !i.received).forEach((i) => togglePaid(M, `recv:${i.key}:${i.personId}`, true))}>Marcar feito</button>
              : <button className="btn small" onClick={() => go('/receber')}>Ver quem</button>}
          </>
        ) : next ? (
          <>
            <span className="pair"><span className="av xs blue"><BillIcon name={next.icon} size={11} /></span><ArrowRight size={12} className="muted" /><span className="av xs green">✓</span></span>
            <span className="grow foot-text"><b>{next.name}</b> {brl(next.amount)} vence dia {String(next.day).padStart(2, '0')}</span>
            <button className="btn small" onClick={() => togglePaid(M, next.id, true)}>Marcar pago</button>
          </>
        ) : (
          <span className="grow foot-text green"><Check size={14} /> Tudo pago neste mês</span>
        )}
      </div>
    </section>
  );
}

function CartoesCard({ M }) {
  const { state, openForm, setM, go } = useApp();
  const [idx, setIdx] = useState(0);
  const [invNode, openInv] = useInvoiceModal();
  const cards = state.cards;
  if (!cards.length)
    return (
      <section className="card cartoes area-cart">
        <div className="card-head"><h2>Cartões</h2><Icon3D name="credit_card" size={84} className="float-icon sm" /></div>
        <Empty>Nenhum cartão ainda.<br /><button className="btn small" onClick={() => openForm('card')}>Adicionar cartão</button></Empty>
      </section>
    );
  const i = Math.min(idx, cards.length - 1);
  const card = cards[i];
  const months = [M, addMonths(M, 1), addMonths(M, 2)];
  const vals = months.map((m) => invoiceTotal(state, card, m));
  const max = Math.max(...vals, 1), min = Math.min(...vals);
  const y = (v) => 44 + (1 - (v - min) / Math.max(max - min, 1)) * 26 - (max === min ? 13 : 0);
  const pts = vals.map((v, k) => [((k + 0.5) / 3) * 300, y(v)]);
  const line = `M0 ${pts[0][1]} L${pts.map((p) => p.join(' ')).join(' L')} L300 ${pts[2][1]}`;
  const { y: yr } = parseMk(M);
  return (
    <section className="card cartoes area-cart">
      <div className="card-head">
        <h2>Cartões</h2>
        <Icon3D name="credit_card" size={84} className="float-icon sm tilt" />
      </div>
      <small className="label">Fatura de {monthName(M).toLowerCase()}</small>
      <Money v={vals[0]} size="lg" />
      <InvoiceSplit compact M={M} onOpen={() => go('/cartoes')} />
      <div className="cart-actions">
        <button className="btn small" onClick={() => openInv(card.id, M)}>Ver fatura</button>
        <div className="arrows">
          <button className="icon-btn round" disabled={i === 0} onClick={() => setIdx(i - 1)} aria-label="Cartão anterior"><ChevronLeft size={15} /></button>
          <button className="icon-btn round" disabled={i === cards.length - 1} onClick={() => setIdx(i + 1)} aria-label="Próximo cartão"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="card-rail">
        <div className="card-track" style={{ transform: `translateX(calc(${-i} * (100% - 82px + 12px)))` }}>
          {cards.map((c, k) => (
            <div className="track-item" key={c.id} onClick={() => (k === i ? openInv(c.id, M) : setIdx(k))}>
              <BankCard card={c} M={M} />
            </div>
          ))}
        </div>
      </div>
      <h4 className="caps">Próximas faturas</h4>
      <div className="next-inv">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="ni-svg">
          <defs>
            <clipPath id="ni-clip"><rect x="0" y="0" width="100" height="100" /></clipPath>
            <linearGradient id="ni-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--blue)" stopOpacity=".22" /><stop offset="1" stopColor="var(--blue)" stopOpacity=".04" /></linearGradient>
          </defs>
          <path d={`${line} L300 100 L0 100 Z`} fill="url(#ni-grad)" clipPath="url(#ni-clip)" />
          <path d={line} fill="none" stroke="var(--blue)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" clipPath="url(#ni-clip)" />
          <clipPath id="ni-clip2"><rect x="100" y="0" width="200" height="100" /></clipPath>
          <path d={line} fill="none" stroke="var(--faint)" strokeWidth="1.3" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" clipPath="url(#ni-clip2)" />
        </svg>
        {months.map((m, k) => {
          const st = invoiceStatus(state, card, m);
          return (
            <button key={m} className={`ni ${k === 0 ? 'on' : ''}`} onClick={() => (k === 0 ? openInv(card.id, m) : setM(m))}>
              <b>{monthShort(m, yr)}</b>
              {k === 0 && <span className={`pill s-${st.toLowerCase()}`}>{st}</span>}
              <span className="ni-dot" style={{ top: `${pts[k][1]}%` }} />
              <span className="ni-val">{brl(vals[k])}</span>
            </button>
          );
        })}
      </div>
      {invNode}
    </section>
  );
}

function MoradiaCard({ M, s }) {
  const { state, go } = useApp();
  const [base, setBase] = useState('salario');
  const bills = billsForMonth(state, M).filter((b) => b.group === 'casa');
  const income = base === 'salario' ? s.salary : s.income;
  const p = income ? (s.casa / income) * 100 : 0;
  const ref = state.housingRef || 30;
  const scale = ref * 2;
  const color = p <= ref ? 'var(--green)' : p <= ref * 1.33 ? 'var(--orange)' : 'var(--red)';
  return (
    <section className="card moradia area-mor">
      <div className="card-head">
        <h2>Moradia</h2>
        <Icon3D name="house" size={92} className="float-icon sm" />
      </div>
      <small className="label">Quanto você gasta pra morar</small>
      <Money v={s.casa} size="lg" />
      <p className="meta">
        <b style={{ color }}><Check size={14} strokeWidth={2.6} /> {pct(p)} {base === 'salario' ? 'do salário' : 'da renda'}</b> referência: até {ref}%
      </p>
      <Segmented className="mor-seg" value={base} onChange={setBase} options={[{ value: 'salario', label: 'Só salário' }, { value: 'renda', label: 'Renda total' }]} />
      <div className="ref-bar">
        <span className="ref-label" style={{ left: `${(ref / scale) * 100}%` }}>{ref}%</span>
        <div className="rb-track"><i style={{ width: `${Math.min(p / scale, 1) * 100}%`, background: color }} /></div>
        <i className="rb-mark" style={{ left: `${(ref / scale) * 100}%` }} />
        <div className="rb-scale"><span>0%</span><span>{scale}% do salário</span></div>
      </div>
      <h4>O que entra na conta</h4>
      <div className="mor-grid">
        {bills.map((b) => (
          <div key={b.id} className="mor-item clickable" onClick={() => go('/casa')}>
            <span className="tile"><BillIcon name={b.icon} size={17} /></span>
            <span><small>{b.name}{peopleIn(b).length ? ` · ${peopleIn(b).map((id) => personName(state, id)).join(', ')}` : ''}</small><b className={!isMine(b) ? 'muted' : ''}>{b.estimated && '≈ '}{brl(b.amount)}</b></span>
          </div>
        ))}
        {bills.length === 0 && <Empty>Nenhuma conta da casa.</Empty>}
      </div>
    </section>
  );
}

function FinanciamentoCard({ M }) {
  const { state, togglePaid } = useApp();
  const [edit, setEdit] = useState(false);
  const f = state.financing;
  const bill = f.billId && billsForMonth(state, M).find((b) => b.id === f.billId);
  const paidN = f.total - f.remaining;
  const end = addMonths(f.refMonth, f.remaining - 1);
  const paid = bill && state.payments?.[M]?.[bill.id];
  return (
    <section className="card financ area-fin">
      <div className="res-body">
        <h2>{f.name} <span className="sub">• {f.bank} · {f.system}</span></h2>
        <div className="res-line">
          <Money v={f.balance} size="md" approx />
          <span className="tag yellow">saldo devedor</span>
        </div>
        <small className="muted">
          parcela {bill ? <b className="ink">{brl(bill.amount)}</b> : '—'} dia {String(f.dueDay).padStart(2, '0')} ({f.debitNote}) · {paidN} de {f.total} pagas · última em {MONTHS_SHORT[parseMk(end).m].toLowerCase()}/{parseMk(end).y}
        </small>
        <div className="fin-bar"><i style={{ width: `${Math.max((paidN / f.total) * 100, 1)}%` }} /></div>
        <div className="fin-split">
          <span><i className="dot" style={{ background: 'var(--green)' }} />amortiza <b>{brl(f.amort)}</b></span>
          <span><i className="dot" style={{ background: 'var(--orange)' }} />juros <b>{brl(f.interest)}</b></span>
          <span><i className="dot" style={{ background: 'var(--bar-gray)' }} />seguro + taxa <b>{brl(f.fees)}</b></span>
          <span className="muted">{num(f.rate)}% a.a.</span>
        </div>
      </div>
      <div className="fin-side">
        <Icon3D name="classical_building" size={92} className="res-icon" />
        <div className="fin-actions">
          {bill && <button className={`btn small ${paid ? '' : 'primary'}`} onClick={() => togglePaid(M, bill.id, !paid)}>{paid ? 'Paga ✓' : 'Marcar paga'}</button>}
          <button className="btn small" onClick={() => setEdit(true)}>Atualizar</button>
        </div>
      </div>
      {edit && <FinancingModal onClose={() => setEdit(false)} />}
    </section>
  );
}

function ReservaCard() {
  const { state, go } = useApp();
  const total = reserveTotal(state);
  const goal = state.reserve.goal || 0;
  const last = reserveEntries(state)[0];
  return (
    <section className="card reserva area-res clickable" onClick={() => go('/reserva')}>
      <div className="res-body">
        <h2>Minha reserva</h2>
        <div className="res-line">
          <Money v={total} size="md" />
          {goal > 0 && <span className="tag yellow">{pct((total / goal) * 100)} da meta</span>}
        </div>
        <small className="muted">
          {goal > 0 ? `meta de ${brl(goal)} · faltam ${brl(Math.max(goal - total, 0))}` : 'defina uma meta em Minha reserva'}
          {last ? ` · última movimentação ${last.date.slice(8)}/${last.date.slice(5, 7)}: ${last.amount < 0 ? '−' : '+'} ${brl(Math.abs(last.amount))}` : ''}
        </small>
        {goal > 0 && <div className="res-bar"><i style={{ width: `${Math.min(total / goal, 1) * 100}%` }} /></div>}
      </div>
      <Icon3D name="money_bag" size={96} className="res-icon" />
    </section>
  );
}

export default function Dashboard() {
  const { state, M } = useApp();
  const s = monthSummary(state, M);
  const list = payables(state, M);
  return (
    <div className={`dash ${state.financing ? 'has-fin' : ''}`}>
      <SaldoCard s={s} />
      <ContasCard M={M} list={list} key={`c-${M}`} />
      <DistribuicaoCard M={M} list={list} />
      <CartoesCard M={M} />
      <MoradiaCard M={M} s={s} />
      {state.financing && <FinanciamentoCard M={M} />}
      <ReservaCard />
    </div>
  );
}
