import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { traducirError } from '../lib/errores';

const hoyISO = () => new Date().toISOString().split('T')[0];

const METODO_COLORS = {
  efectivo:      'bg-emerald-50 text-emerald-600',
  transferencia: 'bg-brand-50 text-brand-500',
  invitado:      'bg-stone-50 text-stone-400',
};

export default function VistaAdmin({ productos, ventas, eventos, eventoActivo, mostrarNotif }) {
  const [tab, setTab]           = useState('vivo');
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [desde, setDesde]       = useState(hoyISO());
  const [hasta, setHasta]       = useState(hoyISO());
  const [rango, setRango]       = useState(null);
  const [cargando, setCargando] = useState(false);

  const cajaHoy = ventas.reduce((a,v) => a+(v.total||0), 0);

  const ventasBarra    = ventas.filter(v => v.origen === 'barra');
  const ventasTaquilla = ventas.filter(v => v.origen === 'taquilla');

  const porMetodoBarra = ventasBarra.reduce((a,v) => {
    const m = v.metodo_pago || 'otro';
    a[m] = (a[m]||0) + (v.total||0);
    return a;
  }, {});

  const porMetodoTaquilla = ventasTaquilla.reduce((a,v) => {
    const m = v.metodo_pago || 'otro';
    if (m === 'invitado') { a._invitados = (a._invitados||0) + 1; return a; }
    a[m] = (a[m]||0) + (v.total||0);
    return a;
  }, {});

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
        {[['vivo','En vivo'],['evento','Evento'],['historial','Historial']].map(([t,label]) => (
          <button key={t} onClick={() => { setTab(t); setEventoSeleccionado(eventoActivo || null); }}
            className={`flex-1 py-2 rounded-xl text-sm transition-colors active:scale-95 ${tab===t ? 'bg-brand-400 text-white font-medium' : 'text-stone-400'}`}>
            {label}
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

          {(ventasBarra.length > 0 || ventasTaquilla.length > 0) && (
            <div className="space-y-3">
              {ventasBarra.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">🍺 Barra</p>
                  <div className="space-y-2">
                    {Object.entries(porMetodoBarra).map(([m, monto]) => (
                      <div key={m} className="flex items-center justify-between">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                        <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ventasTaquilla.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">🎟️ Entrada</p>
                  <div className="space-y-2">
                    {Object.entries(porMetodoTaquilla)
                      .filter(([m]) => m !== '_invitados')
                      .map(([m, monto]) => (
                        <div key={m} className="flex items-center justify-between">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                          <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
                        </div>
                      ))
                    }
                    {porMetodoTaquilla._invitados > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-50 text-stone-400">invitado</span>
                        <span className="font-bold text-stone-400 text-sm">{porMetodoTaquilla._invitados} personas</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

      {tab==='evento' && (() => {
        const ev = eventoSeleccionado;
        const ventasEvento = ev ? ventas.filter(v => {
          const hora = new Date(v.fecha).getHours() * 60 + new Date(v.fecha).getMinutes();
          const [h1,m1] = ev.hora_inicio.split(':').map(Number);
          const [h2,m2] = ev.hora_fin.split(':').map(Number);
          return hora >= h1*60+m1 && hora <= h2*60+m2;
        }) : [];
        const totalEvento = ventasEvento.reduce((a,v) => a+(v.total||0), 0);
        const activo = ev && (() => {
          const min = new Date().getHours()*60+new Date().getMinutes();
          const [h1,m1] = ev.hora_inicio.split(':').map(Number);
          const [h2,m2] = ev.hora_fin.split(':').map(Number);
          return min >= h1*60+m1 && min <= h2*60+m2;
        })();

        return (
          <div className="space-y-3">
            {/* Selector de evento */}
            {eventos.length > 0 ? (
              <div className="bg-white rounded-2xl p-4 border border-stone-100 space-y-2">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Eventos de hoy</p>
                {eventos.map(e => (
                  <button key={e.id} onClick={() => setEventoSeleccionado(e)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${eventoSeleccionado?.id===e.id ? 'bg-brand-50 text-brand-500 font-medium' : 'text-stone-600 hover:bg-stone-50'}`}>
                    <span>{e.nombre}</span>
                    <span className="text-xs text-stone-400">{e.hora_inicio.slice(0,5)}–{e.hora_fin.slice(0,5)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-stone-300">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-sm">Sin eventos hoy</p>
              </div>
            )}

            {ev && (
              <>
                <div className="bg-white rounded-2xl p-4 border border-stone-100">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-stone-800">{ev.nombre}</p>
                    {activo && <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">En curso</span>}
                  </div>
                  <p className="text-xs text-stone-400 mb-3">{ev.hora_inicio.slice(0,5)} – {ev.hora_fin.slice(0,5)}{ev.precio_entrada != null ? ` · Entrada $${ev.precio_entrada.toLocaleString()}` : ''}</p>
                  <p className="text-3xl font-bold text-brand-400">${totalEvento.toLocaleString()}</p>
                  <p className="text-xs text-stone-400 mt-1">{ventasEvento.length} operaciones durante el evento</p>
                </div>

                {(() => {
                  const porMetodoEv = ventasEvento.reduce((a,v) => {
                    const m = v.metodo_pago;
                    if (m === 'invitado') { a._invitados = (a._invitados||0)+1; return a; }
                    a[m] = (a[m]||0)+(v.total||0);
                    return a;
                  }, {});
                  const itemsVendidos = ventasEvento.flatMap(v => v.items||[]).reduce((a,i) => {
                    const key = i.nombre;
                    if (!a[key]) a[key] = { nombre:i.nombre, cantidad:0, total:0 };
                    a[key].cantidad += i.cantidad;
                    a[key].total += i.precio * i.cantidad;
                    return a;
                  }, {});
                  const itemsOrdenados = Object.values(itemsVendidos).sort((a,b) => b.total-a.total);

                  return (
                    <>
                      {Object.keys(porMetodoEv).length > 0 && (
                        <div className="bg-white rounded-2xl p-4 border border-stone-100">
                          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Por método</p>
                          <div className="space-y-2">
                            {Object.entries(porMetodoEv).filter(([m])=>m!=='_invitados').map(([m,monto]) => (
                              <div key={m} className="flex items-center justify-between">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                                <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
                              </div>
                            ))}
                            {porMetodoEv._invitados > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-50 text-stone-400">invitado</span>
                                <span className="font-bold text-stone-400 text-sm">{porMetodoEv._invitados} personas</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {itemsOrdenados.length > 0 && (
                        <div className="bg-white rounded-2xl p-4 border border-stone-100">
                          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Productos vendidos</p>
                          <div className="space-y-2">
                            {itemsOrdenados.map(i => (
                              <div key={i.nombre} className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm text-stone-600">{i.nombre}</span>
                                  <span className="text-xs text-stone-400 ml-1.5">×{i.cantidad}</span>
                                </div>
                                <span className="font-bold text-stone-700 text-sm">${i.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {ev.ajustes?.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-stone-100">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Precios ajustados</p>
                    <div className="space-y-2">
                      {ev.ajustes.map((a,i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-stone-600">{a.nombre}</span>
                          <div className="text-right">
                            <span className="font-bold text-stone-700 text-sm">${a.precio_evento.toLocaleString()}</span>
                            <span className="text-xs text-stone-400 ml-1.5">(era ${a.precio_original.toLocaleString()})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

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
