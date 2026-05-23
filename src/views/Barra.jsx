import React, { useState, useMemo } from 'react';
import IconoFallback from '../components/IconoFallback';
import { supabase } from '../lib/supabase';
import { fechaLocal } from '../lib/fecha';

export default function VistaBarra({ productos, registrarVenta, mostrarNotif, eventoActivo }) {
  const [carrito, setCarrito] = useState({});
  const [procesando, setProcesando] = useState(false);
  const [verCarrito, setVerCarrito] = useState(false);

  const productosConEvento = useMemo(() => {
    let lista = [...productos];
    if (eventoActivo) {
      lista = lista.map(p => {
        const ajuste = eventoActivo.ajustes?.find(a => a.producto_id === p.id);
        return ajuste ? { ...p, precio: ajuste.precio_evento } : p;
      });
      const comidas = (eventoActivo.comidas || []).map(c => ({
        id: `EVT_${c.nombre.replace(/\s+/g, '_')}`,
        nombre: c.nombre,
        precio: c.precio,
        categoria: 'comida',
        stock: 999,
        stock_minimo: 0,
      }));
      lista = [...lista, ...comidas];
    }
    return lista;
  }, [productos, eventoActivo]);

  const agregar = (prod) => {
    const cant = carrito[prod.id]?.cantidad || 0;
    if (!['comida','fernet'].includes(prod.categoria) && cant >= prod.stock) return;
    setCarrito(prev => ({ ...prev, [prod.id]: { ...prod, cantidad: cant + 1 } }));
  };

  const quitar = (id) => {
    setCarrito(prev => {
      const n = { ...prev };
      if (n[id].cantidad <= 1) delete n[id];
      else n[id] = { ...n[id], cantidad: n[id].cantidad - 1 };
      return n;
    });
  };

  const finalizar = async (metodo) => {
    const items = Object.values(carrito);
    if (!items.length || procesando) return;
    setProcesando(true);
    const ok = await registrarVenta(items, metodo, 'barra');
    if (ok) { setCarrito({}); setVerCarrito(false); }
    setProcesando(false);
  };

  const total      = Object.values(carrito).reduce((a, c) => a + c.precio * c.cantidad, 0);
  const totalItems = Object.values(carrito).reduce((a, c) => a + c.cantidad, 0);
  const disponibles = productosConEvento.filter(p => ['comida','fernet'].includes(p.categoria) || p.stock > 0);

  return (
    <div className="pb-24 space-y-3">
      {eventoActivo && (
        <div className="bg-brand-400 text-white rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium">
          <span>🎉</span>
          <span>{eventoActivo.nombre}</span>
          <span className="ml-auto text-white/70 text-xs">{eventoActivo.hora_inicio.slice(0,5)}–{eventoActivo.hora_fin.slice(0,5)}</span>
        </div>
      )}
      {disponibles.length === 0 ? (
        <div className="text-center py-20 text-stone-300">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">Sin productos disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {disponibles.map(p => {
            const critico = !['comida','fernet'].includes(p.categoria) && p.stock <= p.stock_minimo;
            const enCarrito = carrito[p.id]?.cantidad || 0;
            return (
              <button
                key={p.id}
                onClick={() => agregar(p)}
                className="bg-white rounded-2xl p-4 text-left border border-stone-100 active:scale-95 transition-transform relative"
              >
                {critico && (
                  <span className="absolute top-3 right-3 bg-brand-400 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                    últimas {p.stock}
                  </span>
                )}
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-2xl mb-3">
                  <IconoFallback categoria={p.categoria} />
                </div>
                <p className="font-medium text-stone-700 text-sm leading-tight">{p.nombre}</p>
                <p className="text-brand-400 font-bold text-base mt-1">${p.precio.toLocaleString()}</p>
                {enCarrito > 0 && (
                  <div className="absolute bottom-3 right-3 w-5 h-5 rounded-full bg-brand-400 text-white text-[10px] font-bold flex items-center justify-center">
                    {enCarrito}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2 pb-20">
        <button
          onClick={async () => {
            if (!confirm('¿Borrar todas las ventas de barra de hoy?')) return;
            await supabase.from('ventas').delete().eq('origen', 'barra').gte('fecha', fechaLocal());
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-400 text-white text-xs font-medium active:scale-95 transition-transform shadow-sm"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
          </svg>
          Reset
        </button>
      </div>

      {/* Botón flotante de carrito */}
      {totalItems > 0 && !verCarrito && (
        <div className="fixed bottom-5 left-4 right-4 max-w-lg mx-auto z-20" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
          <button
            onClick={() => setVerCarrito(true)}
            className="w-full bg-brand-400 text-white rounded-2xl py-3.5 px-5 flex items-center justify-between active:scale-95 transition-transform"
          >
            <span className="bg-brand-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{totalItems}</span>
            <span className="font-medium text-sm">Ver pedido</span>
            <span className="font-bold text-sm">${total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Bottom sheet del carrito */}
      {verCarrito && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" style={{background:'rgba(0,0,0,0.25)'}} onClick={() => setVerCarrito(false)}>
          <div className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[75vh] overflow-y-auto" style={{paddingBottom:'max(1.25rem,env(safe-area-inset-bottom))'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-800">Tu pedido</h3>
              <button onClick={() => setVerCarrito(false)} className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-lg active:scale-90">×</button>
            </div>

            <div className="space-y-3">
              {Object.values(carrito).map(i => (
                <div key={i.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-lg shrink-0">
                    <IconoFallback categoria={i.categoria} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-700 text-sm truncate">{i.nombre}</p>
                    <p className="text-brand-400 font-bold text-sm">${(i.precio * i.cantidad).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => quitar(i.id)} className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 font-bold flex items-center justify-center active:scale-90">−</button>
                    <span className="font-bold text-stone-700 text-sm w-4 text-center">{i.cantidad}</span>
                    <button onClick={() => agregar(i)} className="w-7 h-7 rounded-full bg-brand-400 text-white font-bold flex items-center justify-center active:scale-90">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-100 pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-stone-400 text-sm">Total</span>
                <span className="font-bold text-xl text-stone-800">${total.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => finalizar('efectivo')} disabled={procesando}
                  className="bg-emerald-500 text-white font-medium rounded-xl py-3 text-sm active:scale-95 transition-transform disabled:opacity-50">
                  {procesando ? '...' : 'Efectivo'}
                </button>
                <button onClick={() => finalizar('transferencia')} disabled={procesando}
                  className="bg-brand-400 text-white font-medium rounded-xl py-3 text-sm active:scale-95 transition-transform disabled:opacity-50">
                  {procesando ? '...' : 'Transferencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
