import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { traducirError } from '../lib/errores';
import IconoFallback from '../components/IconoFallback';

const CATS = ['bebida', 'comida'];
const VACIO = { nombre:'', precio:'', categoria:'bebida' };

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
  const abrirEdicion = p => { setEditando(p.id); setForm({...p}); setErrorModal(null); };
  const abrirNuevo   = () => { setEditando('nuevo'); setForm(VACIO); setErrorModal(null); };
  const cerrar       = () => { setEditando(null); setErrorModal(null); };
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const cambiarCategoria = (v) => setForm(p => ({ ...p, categoria: v }));

  const guardar = async () => {
    if (!form.nombre.trim() || form.precio==='') { setErrorModal('Nombre y precio son obligatorios.'); return; }
    setCargando(true);
    const payload = {
      nombre: form.nombre.trim(),
      precio: Number(form.precio),
      stock: 0,
      stock_minimo: 0,
      categoria: form.categoria,
    };
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

  const ordenados = [...productos].sort((a,b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));

  return (
    <div className="space-y-3 pb-6">
      <button onClick={abrirNuevo} className="w-full bg-brand-400 text-white font-medium rounded-2xl py-3 text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <span className="text-lg leading-none">+</span> Nuevo producto
      </button>

      {ordenados.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-stone-100 flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-base shrink-0">
              <IconoFallback categoria={p.categoria}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-700 text-sm truncate">{p.nombre}</p>
              <p className="text-stone-400 text-xs">{p.categoria} · ${p.precio.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => abrirEdicion(p)} className="bg-stone-50 text-stone-500 font-medium text-xs rounded-xl px-3 py-2 active:scale-95">Editar</button>
              <button onClick={() => eliminar(p.id, p.nombre)} className="bg-red-50 text-red-400 font-medium text-xs rounded-xl px-3 py-2 active:scale-95">×</button>
            </div>
          </div>
      ))}

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
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Categoría</label>
                <select value={form.categoria} onChange={e=>cambiarCategoria(e.target.value)}
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
