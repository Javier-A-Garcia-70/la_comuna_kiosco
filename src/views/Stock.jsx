import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { traducirError } from '../lib/errores';
import IconoFallback from '../components/IconoFallback';

const CATS = ['bebida', 'comida', 'otro'];
const VACIO = { nombre:'', precio:'', stock:'', stock_minimo:'', categoria:'bebida' };

function Campo({ label, tipo, valor, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input type={tipo} value={valor} onChange={e => onChange(e.target.value)}
        className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300" />
    </div>
  );
}

export default function VistaStock({ productos, mostrarNotif }) {
  const [editando, setEditando]   = useState(null);
  const [form, setForm]           = useState(VACIO);
  const [cargando, setCargando]   = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [refills, setRefills]     = useState({});
  const [refillLoad, setRefillLoad] = useState(null);

  const abrirEdicion = p => { setEditando(p.id); setForm({...p}); setErrorModal(null); };
  const abrirNuevo   = () => { setEditando('nuevo'); setForm(VACIO); setErrorModal(null); };
  const cerrar       = () => { setEditando(null); setErrorModal(null); };
  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre.trim() || form.precio==='' || form.stock==='') { setErrorModal('Nombre, precio y stock son obligatorios.'); return; }
    setCargando(true);
    const payload = { nombre:form.nombre.trim(), precio:Number(form.precio), stock:Number(form.stock), stock_minimo:Number(form.stock_minimo)||0, categoria:form.categoria };
    const { error } = editando==='nuevo'
      ? await supabase.from('productos').insert(payload)
      : await supabase.from('productos').update(payload).eq('id', editando);
    setCargando(false);
    if (error) setErrorModal(traducirError(error));
    else { mostrarNotif('ok', editando==='nuevo' ? 'Producto creado.' : 'Actualizado.'); cerrar(); }
  };

  const eliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    const { error } = await supabase.from('productos').delete().eq('id',id);
    if (error) mostrarNotif('error', traducirError(error));
    else mostrarNotif('ok','Producto eliminado.');
  };

  const refill = async (prod) => {
    const cant = Number(refills[prod.id]);
    if (!cant || cant<=0) return;
    setRefillLoad(prod.id);
    const { error } = await supabase.from('productos').update({ stock: prod.stock+cant }).eq('id',prod.id);
    setRefillLoad(null);
    if (error) mostrarNotif('error', traducirError(error));
    else { mostrarNotif('ok', `+${cant} de ${prod.nombre}.`); setRefills(p=>({...p,[prod.id]:''})); }
  };

  const ordenados = [...productos].sort((a,b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));

  return (
    <div className="space-y-3 pb-6">
      <button onClick={abrirNuevo} className="w-full bg-brand-400 text-white font-medium rounded-2xl py-3 text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg leading-none">+</span> Nuevo producto
      </button>

      {ordenados.map(p => {
        const sinStock = p.stock===0;
        const bajo = p.stock>0 && p.stock<=p.stock_minimo;
        return (
          <div key={p.id} className="bg-white rounded-2xl p-4 border border-stone-100 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-xl shrink-0">
                <IconoFallback categoria={p.categoria}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-700 text-sm truncate">{p.nombre}</p>
                <p className="text-stone-400 text-xs">{p.categoria} · ${p.precio.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {sinStock
                  ? <span className="bg-red-50 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">sin stock</span>
                  : bajo
                  ? <span className="bg-brand-50 text-brand-400 text-xs font-medium px-2 py-0.5 rounded-full">{p.stock} u. bajo</span>
                  : <span className="bg-emerald-50 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full">{p.stock} u.</span>
                }
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min="1" placeholder="+ unidades"
                value={refills[p.id]||''}
                onChange={e => setRefills(prev=>({...prev,[p.id]:e.target.value}))}
                className="flex-1 bg-cream rounded-xl px-3 py-2 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button onClick={() => refill(p)} disabled={refillLoad===p.id || !refills[p.id]}
                className="bg-brand-400 text-white font-medium text-xs rounded-xl px-3 py-2 active:scale-95 transition-transform disabled:opacity-40">
                {refillLoad===p.id ? '...' : 'Agregar'}
              </button>
              <button onClick={() => abrirEdicion(p)} className="bg-stone-50 text-stone-500 font-medium text-xs rounded-xl px-3 py-2 active:scale-95">Editar</button>
              <button onClick={() => eliminar(p.id, p.nombre)} className="bg-red-50 text-red-400 font-medium text-xs rounded-xl px-3 py-2 active:scale-95">×</button>
            </div>
          </div>
        );
      })}

      {editando !== null && (
        <div className="fixed inset-0 bg-black/25 flex items-end justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-800">{editando==='nuevo' ? 'Nuevo producto' : 'Editar producto'}</h3>
              <button onClick={cerrar} className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 active:scale-90">×</button>
            </div>
            <Campo label="Nombre" tipo="text" valor={form.nombre} onChange={v=>set('nombre',v)} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Precio ($)" tipo="number" valor={form.precio} onChange={v=>set('precio',v)} />
              <Campo label="Stock" tipo="number" valor={form.stock} onChange={v=>set('stock',v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Mínimo" tipo="number" valor={form.stock_minimo} onChange={v=>set('stock_minimo',v)} />
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Categoría</label>
                <select value={form.categoria} onChange={e=>set('categoria',e.target.value)}
                  className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300">
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {errorModal && <p className="text-red-400 text-xs font-medium bg-red-50 rounded-xl py-2 text-center">{errorModal}</p>}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={cerrar} className="bg-stone-50 text-stone-500 font-medium rounded-2xl py-3 text-sm active:scale-95">Cancelar</button>
              <button onClick={guardar} disabled={cargando} className="bg-brand-400 text-white font-medium rounded-2xl py-3 text-sm active:scale-95 disabled:opacity-50">
                {cargando ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
