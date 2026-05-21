import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { traducirError } from '../lib/errores';

const hoyISO = () => new Date().toISOString().split('T')[0];

const METODO_COLORS = {
  efectivo:      'bg-emerald-50 text-emerald-600',
  transferencia: 'bg-brand-50 text-brand-500',
  invitado:      'bg-stone-50 text-stone-400',
};

export default function VistaAdmin({ productos, ventas, mostrarNotif }) {
  const [tab, setTab]           = useState('vivo');
  const [desde, setDesde]       = useState(hoyISO());
  const [hasta, setHasta]       = useState(hoyISO());
  const [rango, setRango]       = useState(null);
  const [cargando, setCargando] = useState(false);

  const cajaHoy   = ventas.reduce((a,v) => a+(v.total||0), 0);
  const porMetodo = ventas.reduce((a,v) => { const m=v.metodo_pago||'otro'; a[m]=(a[m]||0)+(v.total||0); return a; }, {});

  const consultar = async () => {
    setCargando(true); setRango(null);
    const { data, error } = await supabase.from('ventas').select('*')
      .gte('fecha', desde+'T00:00:00').lte('fecha', hasta+'T23:59:59').order('fecha',{ascending:false});
    setCargando(false);
    if (error) mostrarNotif('error', traducirError(error));
    else setRango(data||[]);
  };

  const totalRango    = rango?.reduce((a,v) => a+(v.total||0), 0) ?? 0;
  const entradasRango = rango?.filter(v => v.origen==='taquilla').length ?? 0;
  const metodoRango   = rango?.reduce((a,v) => { const m=v.metodo_pago||'otro'; a[m]=(a[m]||0)+(v.total||0); return a; }, {});

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-white rounded-2xl p-1 flex border border-stone-100">
        {['vivo','historial'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm transition-colors active:scale-95 ${tab===t ? 'bg-brand-400 text-white font-medium' : 'text-stone-400'}`}>
            {t==='vivo' ? 'En vivo — hoy' : 'Historial'}
          </button>
        ))}
      </div>

      {tab==='vivo' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-5 border border-stone-100">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Caja del día</p>
            <p className="text-4xl font-bold text-brand-400">${cajaHoy.toLocaleString()}</p>
            <p className="text-stone-400 text-xs mt-1">{ventas.length} operaciones</p>
          </div>

          {Object.keys(porMetodo).length>0 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-100">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Por método</p>
              <div className="space-y-2">
                {Object.entries(porMetodo).map(([m,monto]) => (
                  <div key={m} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                    <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 border border-stone-100">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Stock</p>
            <div className="space-y-2">
              {productos.map(p => {
                const sinStock = p.stock===0;
                const bajo = p.stock>0 && p.stock<=p.stock_minimo;
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600">{p.nombre}</span>
                    {sinStock
                      ? <span className="bg-red-50 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">sin stock</span>
                      : bajo
                      ? <span className="bg-brand-50 text-brand-400 text-xs font-medium px-2 py-0.5 rounded-full">{p.stock} u. bajo</span>
                      : <span className="bg-emerald-50 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full">{p.stock} u.</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab==='historial' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-stone-100 space-y-3">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Consultar período</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Desde</label>
                <input type="date" value={desde} onChange={e=>setDesde(e.target.value)}
                  className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Hasta</label>
                <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}
                  className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
              </div>
            </div>
            <button onClick={consultar} disabled={cargando}
              className="w-full bg-brand-400 text-white font-medium rounded-xl py-2.5 text-sm active:scale-95 disabled:opacity-50">
              {cargando ? 'Consultando...' : 'Ver período'}
            </button>
          </div>

          {rango !== null && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Recaudado', valor:`$${totalRango.toLocaleString()}`, color:'text-brand-400' },
                  { label:'Operaciones', valor:rango.length, color:'text-stone-700' },
                  { label:'Entradas', valor:entradasRango, color:'text-stone-700' },
                ].map(({label,valor,color}) => (
                  <div key={label} className="bg-white rounded-2xl p-3 text-center border border-stone-100">
                    <p className={`font-bold text-lg ${color}`}>{valor}</p>
                    <p className="text-stone-400 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {metodoRango && Object.keys(metodoRango).length>0 && (
                <div className="bg-white rounded-2xl p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Por método</p>
                  {Object.entries(metodoRango).map(([m,monto]) => (
                    <div key={m} className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                      <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {rango.length===0 && (
                <div className="text-center py-10 text-stone-300">
                  <p className="text-2xl mb-1">📭</p>
                  <p className="text-sm">Sin ventas en ese período.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
