import React, { useEffect, useRef, useState } from 'react';
import {
  KeyRound, Building2, Zap, Wifi, Flame, Droplets, PiggyBank, Users, Dumbbell, HeartPulse, Smartphone,
  Car, GraduationCap, Tv, ShoppingCart, CreditCard, Home, Receipt, Plane, PawPrint, Shirt, Baby, Fuel,
  Landmark, Hammer, Sofa, X, Check, Music, Gift,
} from 'lucide-react';
import { num } from './lib.js';

export const BILL_ICONS = {
  key: KeyRound, building: Building2, zap: Zap, wifi: Wifi, flame: Flame, water: Droplets, piggy: PiggyBank,
  users: Users, dumbbell: Dumbbell, heart: HeartPulse, phone: Smartphone, car: Car, edu: GraduationCap, tv: Tv,
  cart: ShoppingCart, 'credit-card': CreditCard, home: Home, receipt: Receipt, plane: Plane, pet: PawPrint,
  shirt: Shirt, baby: Baby, fuel: Fuel, bank: Landmark, hammer: Hammer, sofa: Sofa, music: Music, gift: Gift,
};
export function BillIcon({ name, size = 18 }) {
  const I = BILL_ICONS[name] || Receipt;
  return <I size={size} strokeWidth={1.75} />;
}

export function Money({ v, size = 'lg', approx, className = '', signed }) {
  const neg = v < 0;
  const [int, dec] = num(Math.abs(v)).split(',');
  return (
    <span className={`money money-${size} ${className}`}>
      {approx && <span className="approx">≈</span>}
      <span className="cur">R$</span>
      <span className="int">{neg ? '−' : signed ? '+' : ''}{int}</span>
      <span className="dec">,{dec}</span>
    </span>
  );
}

export function Icon3D({ name, size = 92, className = '' }) {
  return <img className={`icon3d ${className}`} src={`/icons/${name}.png`} width={size} height={size} alt="" draggable="false" />;
}

export function Check3({ checked, onChange, title }) {
  return (
    <button type="button" className={`check ${checked ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onChange?.(!checked); }} title={title} aria-pressed={checked}>
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

// "Voltar" do celular fecha o que estiver aberto por cima (modal, folha, menu) em vez de sair da tela.
// Cada camada aberta ganha uma entrada no histórico; fechar pelo X/fora também limpa essa entrada.
let layerSeq = 0;
const openLayers = [];
let ignorePops = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    if (ignorePops > 0) { ignorePops--; return; }
    const id = e.state?.layerId;
    while (openLayers.length && openLayers[openLayers.length - 1].id !== id) {
      const top = openLayers.pop();
      top.byBack = true;
      top.close();
    }
    // caiu numa entrada de camada que já foi fechada por outro caminho: pula
    if (id && !openLayers.some((l) => l.id === id)) history.back();
  });
}
export function useBackClose(active, onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const layer = { id: ++layerSeq, close: () => ref.current(), byBack: false };
    openLayers.push(layer);
    history.pushState({ ...(history.state || {}), layerId: layer.id }, '');
    return () => {
      const i = openLayers.indexOf(layer);
      if (i >= 0) openLayers.splice(i, 1);
      if (!layer.byBack) setTimeout(() => { if (history.state?.layerId === layer.id) { ignorePops++; history.back(); } }, 0);
    };
  }, [active]);
}
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function Modal({ title, onClose, children, footer, wide }) {
  useBackClose(true, onClose);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, group }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
  );
}

export function MoneyInput({ value, onChange, autoFocus }) {
  const [txt, setTxt] = useState(value ? num(value) : '');
  return (
    <div className="money-input">
      <span>R$</span>
      <input inputMode="decimal" autoFocus={autoFocus && (!isTouch() || !value)} value={txt} placeholder="0,00"
        onChange={(e) => { setTxt(e.target.value); onChange(e.target.value); }}
        onBlur={() => { const v = parseFloatBR(txt); if (txt) setTxt(num(v)); }} />
    </div>
  );
}
function parseFloatBR(s) {
  s = String(s).replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`segmented ${className}`}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useOutside(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [open, setOpen]);
  return ref;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

// chip do cartão (SVG) e ícone de contactless
export function ChipSvg({ size = 36 }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 36 28" fill="none">
      <rect x="0.5" y="0.5" width="35" height="27" rx="6" fill="#e9e9ec" stroke="#cfcfd4" />
      <path d="M12 0.5v9M24 0.5v9M12 18.5v9M24 18.5v9M0.5 9.5h11.5M24 9.5h11.5M0.5 18.5h11.5M24 18.5h11.5" stroke="#b7b7bd" />
      <rect x="12" y="9.5" width="12" height="9" rx="2" stroke="#b7b7bd" fill="#f3f3f5" />
    </svg>
  );
}
export function ContactlessSvg({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round">
      <path d="M8 8.5a5 5 0 0 1 0 7" /><path d="M11.5 6a8.5 8.5 0 0 1 0 12" /><path d="M15 3.5a12 12 0 0 1 0 17" />
    </svg>
  );
}

// Ilustração do "Saldo previsto": carteira de couro preta com notas saindo (SVG próprio)
export function WalletIllustration({ size = 132, className = '' }) {
  const id = React.useId().replace(/:/g, '');
  const g = (n) => `${n}-${id}`;
  const Note = ({ x, y, r }) => (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-46" y="-25" width="92" height="50" rx="5" fill={`url(#${g('note')})`} stroke="#0f6b35" strokeWidth="1" />
      <rect x="-40" y="-19" width="80" height="38" rx="3" fill="none" stroke="#c9f2d6" strokeOpacity=".55" strokeWidth="1.2" />
      <circle cx="0" cy="0" r="11" fill="#2fae5f" stroke="#c9f2d6" strokeOpacity=".6" strokeWidth="1.2" />
      <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill="#e9fbef" fontFamily="Inter, sans-serif">$</text>
      <text x="-33" y="-8" fontSize="8" fontWeight="800" fill="#e9fbef" fontFamily="Inter, sans-serif">100</text>
      <text x="33" y="15" textAnchor="end" fontSize="8" fontWeight="800" fill="#e9fbef" fontFamily="Inter, sans-serif">100</text>
    </g>
  );
  return (
    <svg className={`wallet-ill ${className}`} width={size} height={size * 0.9} viewBox="0 0 160 144" aria-hidden="true">
      <defs>
        <linearGradient id={g('note')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4fd17f" /><stop offset="1" stopColor="#1f9a4f" />
        </linearGradient>
        <linearGradient id={g('body')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3b40" /><stop offset=".45" stopColor="#232326" /><stop offset="1" stopColor="#111113" />
        </linearGradient>
        <linearGradient id={g('lip')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0b0c" /><stop offset="1" stopColor="#1c1c1f" />
        </linearGradient>
        <linearGradient id={g('strap')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#36363a" /><stop offset="1" stopColor="#18181a" />
        </linearGradient>
        <radialGradient id={g('snap')} cx=".35" cy=".35" r=".7">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#c7cad1" /><stop offset="1" stopColor="#7d828c" />
        </radialGradient>
        <filter id={g('shadow')} x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {/* sombra no chão */}
      <ellipse cx="80" cy="134" rx="56" ry="6" fill="#0f172a" opacity=".22" filter={`url(#${g('shadow')})`} />
      {/* abertura (fundo da carteira) */}
      <rect x="16" y="50" width="124" height="26" rx="12" fill={`url(#${g('lip')})`} />
      {/* notas saindo */}
      <Note x={70} y={46} r={-14} />
      <Note x={86} y={40} r={-4} />
      <Note x={98} y={46} r={9} />
      {/* corpo */}
      <rect x="12" y="60" width="132" height="70" rx="15" fill={`url(#${g('body')})`} />
      <rect x="12" y="60" width="132" height="70" rx="15" fill="none" stroke="#ffffff" strokeOpacity=".08" />
      <rect x="18" y="66" width="120" height="58" rx="11" fill="none" stroke="#ffffff" strokeOpacity=".16" strokeWidth="1" strokeDasharray="3 3" />
      {/* brilho */}
      <path d="M24 66 Q78 58 132 66 L132 72 Q78 64 24 72 Z" fill="#ffffff" opacity=".07" />
      {/* aba com botão */}
      <rect x="104" y="80" width="46" height="30" rx="11" fill={`url(#${g('strap')})`} />
      <rect x="104" y="80" width="46" height="30" rx="11" fill="none" stroke="#ffffff" strokeOpacity=".12" />
      <rect x="108" y="84" width="38" height="22" rx="8" fill="none" stroke="#ffffff" strokeOpacity=".14" strokeDasharray="2.5 2.5" />
      <circle cx="131" cy="95" r="6.5" fill={`url(#${g('snap')})`} stroke="#5d626b" strokeWidth=".8" />
    </svg>
  );
}
