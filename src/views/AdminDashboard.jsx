import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { traducirError } from '../lib/errores';
import { fechaLocal, eventoEstaActivo, ventanaEvento, inicioDiaISO } from '../lib/fecha';

const hoyISO = () => fechaLocal();

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const METODO_COLORS = {
  efectivo:      'bg-emerald-50 text-emerald-600',
  transferencia: 'bg-brand-50 text-brand-500',
  invitado:      'bg-stone-50 text-stone-400',
};

const ORDEN_METODOS = ['efectivo', 'transferencia'];
const ordenarMetodos = (entries) =>
  [...entries].sort(([a], [b]) => {
    const ia = ORDEN_METODOS.indexOf(a), ib = ORDEN_METODOS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

const agruparItems = (vs) => {
  const acc = {};
  vs.flatMap(v => v.items || []).forEach(i => {
    if (!acc[i.nombre]) acc[i.nombre] = { nombre: i.nombre, cantidad: 0, total: 0 };
    acc[i.nombre].cantidad += i.cantidad;
    acc[i.nombre].total    += i.precio * i.cantidad;
  });
  return Object.values(acc).sort((a, b) => b.total - a.total);
};

function DesgloseVentas({ ventas }) {
  const [barraAbierta, setBarraAbierta] = useState(false);
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

  if (ventasBarra.length === 0 && ventasTaquilla.length === 0) return null;

  return (
    <div className="space-y-3">
      {ventasBarra.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-stone-100 cursor-pointer" onClick={() => setBarraAbierta(o => !o)}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">🍺 Barra</p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className={`text-stone-300 transition-transform ${barraAbierta ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div className="space-y-2">
            {ordenarMetodos(Object.entries(porMetodoBarra)).map(([m, monto]) => (
              <div key={m} className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
              </div>
            ))}
          </div>
          {barraAbierta && (
            <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
              {ordenarMetodos(Object.entries(porMetodoBarra)).map(([m]) => {
                const items = agruparItems(ventasBarra.filter(v => v.metodo_pago === m));
                if (items.length === 0) return null;
                return (
                  <div key={m}>
                    <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">{m}</p>
                    <div className="space-y-1.5">
                      {items.map(i => (
                        <div key={i.nombre} className="flex items-center justify-between">
                          <div><span className="text-sm text-stone-600">{i.nombre}</span><span className="text-xs text-stone-400 ml-1.5">×{i.cantidad}</span></div>
                          <span className="font-bold text-stone-700 text-sm">${i.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {ventasTaquilla.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">🎟️ Entrada</p>
            <span className="text-xs font-bold text-stone-500">{ventasTaquilla.length} ingresos</span>
          </div>
          <div className="space-y-2">
            {ordenarMetodos(Object.entries(porMetodoTaquilla).filter(([m]) => m !== '_invitados')).map(([m, monto]) => (
              <div key={m} className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${METODO_COLORS[m]||'bg-stone-50 text-stone-400'}`}>{m}</span>
                <span className="font-bold text-stone-700 text-sm">${monto.toLocaleString()}</span>
              </div>
            ))}
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
  );
}

export default function VistaAdmin({ productos, ventas, eventos, eventoActivo, mostrarNotif }) {
  const hoy = new Date();
  const [tab, setTab]           = useState('vivo');
  const [desde, setDesde]       = useState(hoyISO());
  const [hasta, setHasta]       = useState(hoyISO());
  const [rango, setRango]       = useState(null);
  const [cargando, setCargando] = useState(false);

  // Tab Evento
  const [mesVisto, setMesVisto]           = useState({ year: hoy.getFullYear(), month: hoy.getMonth() });
  const [eventosDelMes, setEventosDelMes] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [ventasDelEvento, setVentasDelEvento]       = useState(null);
  const [cargandoEvento, setCargandoEvento]         = useState(false);
  const [eventosExtendidos, setEventosExtendidos]   = useState([]);

  // Tick por minuto para que "En vivo" corte solo al pasar la medianoche
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const ventasHoy = ventas.filter(v => new Date(v.fecha) >= new Date(`${hoyISO()}T00:00:00`));

  useEffect(() => {
    if (tab !== 'evento') return;
    const { year, month } = mesVisto;
    const desde = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const hasta  = fechaLocal(new Date(year, month+1, 0));
    supabase.from('eventos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('hora_inicio')
      .then(({ data }) => setEventosDelMes(data || []));
  }, [mesVisto, tab]);

  const seleccionarEvento = async (ev) => {
    setEventoSeleccionado(ev);
    const esHoy = ev.fecha === hoyISO();
    if (esHoy) { setVentasDelEvento(null); return; }
    setCargandoEvento(true);
    const { inicio, fin } = ventanaEvento(ev);
    const { data } = await supabase.from('ventas').select('*')
      .gte('fecha', inicio.toISOString()).lte('fecha', fin.toISOString());
    setCargandoEvento(false);
    setVentasDelEvento(data || []);
  };

  const irMes = (delta) => {
    setMesVisto(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      if (m < 0)  { m = 11; y--; }
      return { year: y, month: m };
    });
    setEventoSeleccionado(null);
  };

  const cajaHoy = ventasHoy.reduce((a,v) => a+(v.total||0), 0);

  const consultar = async () => {
    setCargando(true); setRango(null); setEventosExtendidos([]);
    // Período en hora local del dispositivo
    const inicio = new Date(`${desde}T00:00:00`);
    let fin = new Date(new Date(`${hasta}T00:00:00`).getTime() + 86400000); // fin de día exclusivo
    const finPeriodo = fin;

    // Si un evento empezó dentro del período pero termina después, se extiende el cálculo
    const { data: evs } = await supabase.from('eventos').select('*').gte('fecha', desde).lte('fecha', hasta);
    const extendidos = [];
    (evs || []).forEach(ev => {
      const { fin: finEv } = ventanaEvento(ev);
      if (finEv > finPeriodo) {
        extendidos.push(ev);
        if (finEv > fin) fin = finEv;
      }
    });

    const { data, error } = await supabase.from('ventas').select('*')
      .gte('fecha', inicio.toISOString()).lte('fecha', fin.toISOString()).order('fecha',{ascending:false});
    setCargando(false);
    if (error) mostrarNotif('error', traducirError(error));
    else { setRango(data||[]); setEventosExtendidos(extendidos); }
  };

  const totalRango       = rango?.reduce((a,v) => a+(v.total||0), 0) ?? 0;
  const entradasRango    = rango?.filter(v => v.origen==='taquilla').length ?? 0;
  const ventasBarraRango = rango?.filter(v => v.origen==='barra').length ?? 0;

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-white rounded-2xl p-1 flex border border-stone-100">
        {[['vivo','En vivo'],['evento','Evento'],['historial','Historial']].map(([t,label]) => (
          <button key={t} onClick={() => { setTab(t); if (eventoActivo) seleccionarEvento(eventoActivo); else setEventoSeleccionado(null); }}
            className={`flex-1 py-2 rounded-xl text-sm transition-colors active:scale-95 ${tab===t ? 'bg-brand-400 text-white font-medium' : 'text-stone-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab==='vivo' && (
        <div className="space-y-3">
          {eventoActivo && (
            <div className="bg-brand-50 border border-brand-100 rounded-2xl px-4 py-2.5 text-xs text-brand-500 text-center">
              Esta vista incluye las operaciones del evento en curso
            </div>
          )}
          <div className="bg-white rounded-2xl p-5 border border-stone-100 relative">
            <button
              onClick={async () => {
                if (!confirm('¿Borrar todas las ventas de hoy? Esta acción no se puede deshacer.')) return;
                const { error } = await supabase.from('ventas').delete().gte('fecha', inicioDiaISO());
                if (error) mostrarNotif('error', error.message);
                else mostrarNotif('ok', 'Ventas borradas.');
              }}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-400 text-white text-xs font-medium active:scale-95 transition-transform shadow-sm"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
              Reset
            </button>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Caja del día</p>
            <p className="text-4xl font-bold text-brand-400">${cajaHoy.toLocaleString()}</p>
            <p className="text-stone-400 text-xs mt-1">{ventasHoy.length} operaciones</p>
          </div>

          <DesgloseVentas ventas={ventasHoy} />

        </div>
      )}

      {tab==='evento' && (() => {
        const ev = eventoSeleccionado;
        const esHoy = ev?.fecha === hoyISO();
        const fuenteVentas = esHoy ? ventas : (ventasDelEvento || []);
        const ventasEvento = ev ? (() => {
          const inicio = new Date(`${ev.fecha}T${ev.hora_inicio}`);
          const fin    = new Date(`${ev.fecha}T${ev.hora_fin}`);
          if (fin <= inicio) fin.setDate(fin.getDate() + 1);
          return fuenteVentas.filter(v => { const d = new Date(v.fecha); return d >= inicio && d <= fin; });
        })() : [];
        const totalEvento = ventasEvento.reduce((a,v) => a+(v.total||0), 0);
        const activo = ev ? eventoEstaActivo(ev) : false;

        return (
          <div className="space-y-3">
            {/* Navegación por mes */}
            <div className="bg-white rounded-2xl border border-stone-100 flex items-center justify-between px-4 py-3">
              <button onClick={() => irMes(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 active:bg-stone-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="font-medium text-stone-700 text-sm">{MESES[mesVisto.month]} {mesVisto.year}</span>
              <button onClick={() => irMes(1)} disabled={mesVisto.year === hoy.getFullYear() && mesVisto.month >= hoy.getMonth()} className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 active:bg-stone-50 disabled:opacity-30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Lista de eventos del mes */}
            {eventosDelMes.length === 0 ? (
              <div className="text-center py-10 text-stone-300">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-sm">Sin eventos este mes</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-50">
                {eventosDelMes.map(e => {
                  const esActivo = eventoEstaActivo(e);
                  return (
                    <button key={e.id} onClick={() => seleccionarEvento(e)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${eventoSeleccionado?.id===e.id ? 'bg-brand-50' : 'hover:bg-stone-50'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${eventoSeleccionado?.id===e.id ? 'text-brand-500' : 'text-stone-700'}`}>{e.nombre}</span>
                          {esActivo && <span className="bg-emerald-100 text-emerald-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">En curso</span>}
                        </div>
                        <span className="text-xs text-stone-400">{e.fecha.slice(8,10)}/{e.fecha.slice(5,7)} · {e.hora_inicio.slice(0,5)}–{e.hora_fin.slice(0,5)}</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4856a" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Detalle del evento seleccionado */}
            {cargandoEvento && <p className="text-center text-stone-400 text-sm py-4">Cargando...</p>}

            {ev && !cargandoEvento && (
              <>
                <div className="bg-white rounded-2xl p-4 border border-stone-100">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-stone-800">{ev.nombre}</p>
                    {activo && <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">En curso</span>}
                  </div>
                  <p className="text-xs text-stone-400 mb-3">{ev.hora_inicio.slice(0,5)} – {ev.hora_fin.slice(0,5)}{ev.precio_entrada != null ? ` · Entrada $${ev.precio_entrada.toLocaleString()}` : ''}</p>
                  <p className="text-3xl font-bold text-brand-400">${totalEvento.toLocaleString()}</p>
                </div>

                <DesgloseVentas ventas={ventasEvento} />

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
              {eventosExtendidos.length > 0 && (
                <div className="bg-brand-50 border border-brand-100 rounded-2xl px-4 py-2.5 text-xs text-brand-500">
                  {eventosExtendidos.map(ev => {
                    const { fin } = ventanaEvento(ev);
                    return (
                      <p key={ev.id}>
                        🎉 Este cálculo contempla la totalidad de las ventas del evento <span className="font-bold">{ev.nombre}</span> del {ev.fecha.slice(8,10)}/{ev.fecha.slice(5,7)}, que terminó el {String(fin.getDate()).padStart(2,'0')}/{String(fin.getMonth()+1).padStart(2,'0')} a las {ev.hora_fin.slice(0,5)}.
                      </p>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Recaudado', valor:`$${totalRango.toLocaleString()}`, color:'text-brand-400' },
                  { label:'Ventas barra', valor:ventasBarraRango, color:'text-stone-700' },
                  { label:'Entradas', valor:entradasRango, color:'text-stone-700' },
                ].map(({label,valor,color}) => (
                  <div key={label} className="bg-white rounded-2xl p-3 text-center border border-stone-100">
                    <p className={`font-bold text-lg ${color}`}>{valor}</p>
                    <p className="text-stone-400 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <DesgloseVentas ventas={rango} />

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
