import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fechaLocal } from '../lib/fecha';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',     bg: 'bg-emerald-500', icon: '💵' },
  { key: 'transferencia', label: 'Transferencia', bg: 'bg-brand-400',  icon: '📲' },
  { key: 'invitado',      label: 'Invitado',      icon: '👤', bg: 'bg-white border border-stone-100', textColor: 'text-stone-600' },
];

export default function VistaTaquilla({ registrarVenta, eventoActivo, userMode }) {
  const [ingresos, setIngresos] = useState(0);
  const [procesando, setProcesando] = useState(null);

  const precioEntrada = eventoActivo?.precio_entrada ?? null;

  useEffect(() => {
    supabase.rpc('contar_entradas_hoy').then(({ data }) => {
      if (data !== null) setIngresos(data);
    });
  }, []);

  const vender = async (metodo) => {
    if (procesando) return;
    setProcesando(metodo);
    const precio = metodo === 'invitado' ? 0 : (precioEntrada ?? 0);
    const ok = await registrarVenta(
      [{ id: 'ENTRADA', nombre: 'Entrada General', precio, cantidad: 1 }],
      metodo, 'taquilla'
    );
    if (ok) setIngresos(p => p + 1);
    setProcesando(null);
  };

  return (
    <div className="space-y-4 relative">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-stone-100 text-center">
          <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Ingresaron</p>
          <p className="text-3xl font-bold text-stone-800 tabular-nums leading-none mt-1">{ingresos}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-stone-100 text-center">
          <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Valor entrada</p>
          <p className="text-3xl font-bold text-stone-800 tabular-nums leading-none mt-1">
            {precioEntrada != null ? `$${precioEntrada.toLocaleString()}` : '$-'}
          </p>
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
              {m.sub && <p className={`text-sm ${m.subColor || 'text-white/70'}`}>{m.sub}</p>}
            </div>
            {procesando === m.key && <span className={`ml-auto text-sm ${m.textColor || 'text-white/70'}`}>...</span>}
          </button>
        ))}
      </div>

      {userMode === 'admin' && (
        <button
          onClick={async () => {
            if (!confirm('¿Resetear el contador de ingresos a cero?')) return;
            await supabase.from('ventas').delete().eq('origen', 'taquilla').gte('fecha', fechaLocal());
            setIngresos(0);
          }}
          className="fixed bottom-6 right-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-400 text-white text-xs font-medium active:scale-95 transition-transform shadow-md"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Reset
        </button>
      )}
    </div>
  );
}
