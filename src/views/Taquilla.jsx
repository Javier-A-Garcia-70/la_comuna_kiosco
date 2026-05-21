import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PRECIO = 1500;

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      sub: `$${PRECIO.toLocaleString()}`, bg: 'bg-emerald-500', icon: '💵' },
  { key: 'transferencia', label: 'Transferencia',  sub: `$${PRECIO.toLocaleString()}`, bg: 'bg-brand-400',  icon: '📲' },
  { key: 'invitado',      label: 'Invitado',       sub: 'Sin cargo',                  bg: 'bg-white border border-stone-100', textColor: 'text-stone-600', subColor: 'text-stone-400', iconColor: '' },
];

export default function VistaTaquilla({ registrarVenta }) {
  const [ingresos, setIngresos] = useState(0);
  const [procesando, setProcesando] = useState(null);

  useEffect(() => {
    supabase.rpc('contar_entradas_hoy').then(({ data }) => {
      if (data !== null) setIngresos(data);
    });
  }, []);

  const vender = async (metodo) => {
    if (procesando) return;
    setProcesando(metodo);
    const precio = metodo === 'invitado' ? 0 : PRECIO;
    const ok = await registrarVenta(
      [{ id: 'ENTRADA', nombre: 'Entrada General', precio, cantidad: 1 }],
      metodo, 'taquilla'
    );
    if (ok) setIngresos(p => p + 1);
    setProcesando(null);
  };

  return (
    <div className="space-y-4">
      {/* Contador compacto */}
      <div className="bg-white rounded-2xl p-4 border border-stone-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4856A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Ingresaron esta noche</p>
          <p className="text-4xl font-bold text-stone-800 tabular-nums leading-none mt-0.5">{ingresos}</p>
        </div>
      </div>

      {/* Botones de cobro */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1">Cobrar entrada</p>
        {METODOS.map(m => (
          <button
            key={m.key}
            onClick={() => vender(m.key)}
            disabled={!!procesando}
            className={`w-full ${m.bg} rounded-2xl px-4 py-3.5 flex items-center gap-3.5 active:scale-95 transition-transform disabled:opacity-50`}
          >
            <span className="text-2xl w-8 text-center">{m.icon}</span>
            <div className="text-left">
              <p className={`font-bold text-base leading-tight ${m.textColor || 'text-white'}`}>{m.label}</p>
              <p className={`text-sm ${m.subColor || 'text-white/70'}`}>{m.sub}</p>
            </div>
            {procesando === m.key && <span className={`ml-auto text-sm ${m.textColor || 'text-white/70'}`}>...</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
