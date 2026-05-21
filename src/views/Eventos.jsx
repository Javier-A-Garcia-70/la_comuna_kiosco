import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { traducirError } from '../lib/errores';

const CATS_BEBIDA = ['cerveza', 'vino', 'bebida'];
const FORM_VACIO = { nombre: '', hora_inicio: '', hora_fin: '', precio_entrada: '', comidas: [], ajustes: {} };

function estaActivo(ev) {
  const ahora = new Date();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const [h1, m1] = ev.hora_inicio.split(':').map(Number);
  const [h2, m2] = ev.hora_fin.split(':').map(Number);
  return min >= h1 * 60 + m1 && min <= h2 * 60 + m2;
}

export default function VistaEventos({ productos, eventos, mostrarNotif }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [nuevaComida, setNuevaComida] = useState({ nombre: '', precio: '' });
  const [cargando, setCargando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const bebidas = useMemo(
    () => productos.filter(p => CATS_BEBIDA.includes(p.categoria) && p.stock > 0)
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [productos]
  );

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setErrorForm(null);
    setAbierto(true);
  };

  const abrirEdicion = (ev) => {
    const ajustesMap = {};
    (ev.ajustes || []).forEach(a => { ajustesMap[a.producto_id] = String(a.precio_evento); });
    setForm({
      nombre: ev.nombre,
      hora_inicio: ev.hora_inicio.slice(0, 5),
      hora_fin: ev.hora_fin.slice(0, 5),
      precio_entrada: ev.precio_entrada != null ? String(ev.precio_entrada) : '',
      comidas: ev.comidas || [],
      ajustes: ajustesMap,
    });
    setEditandoId(ev.id);
    setErrorForm(null);
    setAbierto(true);
  };

  const cerrar = () => { setAbierto(false); setEditandoId(null); };

  const agregarComida = () => {
    if (!nuevaComida.nombre.trim() || nuevaComida.precio === '') return;
    setForm(p => ({ ...p, comidas: [...p.comidas, { nombre: nuevaComida.nombre.trim(), precio: Number(nuevaComida.precio) }] }));
    setNuevaComida({ nombre: '', precio: '' });
  };

  const quitarComida = (i) => {
    setForm(p => ({ ...p, comidas: p.comidas.filter((_, idx) => idx !== i) }));
  };

  const setAjuste = (producto_id, valor) => {
    setForm(p => ({ ...p, ajustes: { ...p.ajustes, [producto_id]: valor } }));
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.hora_inicio || !form.hora_fin) {
      setErrorForm('Nombre, hora inicio y hora fin son obligatorios.');
      return;
    }
    setCargando(true);
    const ajustesArray = Object.entries(form.ajustes)
      .filter(([, v]) => v !== '' && v !== undefined && !isNaN(Number(v)))
      .map(([producto_id, precio_evento]) => {
        const prod = bebidas.find(p => p.id === Number(producto_id));
        return {
          producto_id: Number(producto_id),
          nombre: prod?.nombre || '',
          precio_original: prod?.precio || 0,
          precio_evento: Number(precio_evento),
        };
      });

    const payload = {
      nombre: form.nombre.trim(),
      fecha: new Date().toISOString().split('T')[0],
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      precio_entrada: form.precio_entrada !== '' ? Number(form.precio_entrada) : null,
      comidas: form.comidas,
      ajustes: ajustesArray,
    };

    const { error } = editandoId
      ? await supabase.from('eventos').update(payload).eq('id', editandoId)
      : await supabase.from('eventos').insert(payload);

    setCargando(false);
    if (error) { setErrorForm(traducirError(error)); return; }
    mostrarNotif('ok', editandoId ? 'Evento actualizado.' : 'Evento creado.');
    cerrar();
  };

  const eliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar el evento "${nombre}"?`)) return;
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) mostrarNotif('error', traducirError(error));
    else mostrarNotif('ok', 'Evento eliminado.');
  };

  return (
    <div className="space-y-3 pb-6">
      <button
        onClick={abrirNuevo}
        className="w-full bg-brand-400 text-white font-medium rounded-2xl py-3 text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <span className="text-lg leading-none">+</span> Nuevo evento
      </button>

      {eventos.length === 0 && (
        <div className="text-center py-12 text-stone-300">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm">Sin eventos para hoy</p>
        </div>
      )}

      {eventos.map(ev => {
        const activo = estaActivo(ev);
        return (
          <div key={ev.id} className="bg-white rounded-2xl p-4 border border-stone-100 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-stone-700 text-sm">{ev.nombre}</p>
                  {activo && (
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Activo</span>
                  )}
                </div>
                <p className="text-stone-400 text-xs mt-0.5">
                  {ev.hora_inicio.slice(0,5)} – {ev.hora_fin.slice(0,5)}
                  {ev.comidas?.length > 0 && ` · ${ev.comidas.length} comida${ev.comidas.length > 1 ? 's' : ''}`}
                  {ev.ajustes?.length > 0 && ` · ${ev.ajustes.length} precio${ev.ajustes.length > 1 ? 's' : ''} ajustado${ev.ajustes.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => abrirEdicion(ev)}
                  className="bg-stone-50 text-stone-500 font-medium text-xs rounded-xl px-3 py-2 active:scale-95"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminar(ev.id, ev.nombre)}
                  className="bg-red-50 text-red-400 font-medium text-xs rounded-xl px-3 py-2 active:scale-95"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {abierto && (
        <div className="fixed inset-0 bg-black/25 z-50 flex items-end justify-center p-0">
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-800">{editandoId ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button onClick={cerrar} className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 active:scale-90">×</button>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Nombre del evento</label>
              <input
                type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Noche de jazz"
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            {/* Horario */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Hora inicio</label>
                <input
                  type="time" value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
                  className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Hora fin</label>
                <input
                  type="time" value={form.hora_fin} onChange={e => setForm(p => ({ ...p, hora_fin: e.target.value }))}
                  className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            {/* Precio entrada */}
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Precio entrada</label>
              <input
                type="number" placeholder="$-" value={form.precio_entrada}
                onChange={e => setForm(p => ({ ...p, precio_entrada: e.target.value }))}
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            {/* Comidas del evento */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Comidas del evento</p>
              {form.comidas.map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2">
                  <span className="flex-1 text-sm text-stone-700 truncate">{c.nombre}</span>
                  <span className="text-brand-400 font-bold text-sm">${Number(c.precio).toLocaleString()}</span>
                  <button onClick={() => quitarComida(i)} className="text-red-400 font-bold text-sm leading-none active:scale-90">×</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Nombre" value={nuevaComida.nombre}
                  onChange={e => setNuevaComida(p => ({ ...p, nombre: e.target.value }))}
                  className="flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <input
                  type="number" placeholder="$" value={nuevaComida.precio}
                  onChange={e => setNuevaComida(p => ({ ...p, precio: e.target.value }))}
                  className="w-20 bg-cream rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <button
                  onClick={agregarComida}
                  disabled={!nuevaComida.nombre.trim() || nuevaComida.precio === ''}
                  className="bg-brand-400 text-white font-medium text-xs rounded-xl px-3 py-2 active:scale-95 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* Precios de bebidas */}
            {bebidas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Precio evento en bebidas</p>
                <p className="text-xs text-stone-300">Dejá vacío para mantener el precio normal.</p>
                {bebidas.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 truncate">{p.nombre}</p>
                      <p className="text-xs text-stone-400">${p.precio.toLocaleString()} actual</p>
                    </div>
                    <input
                      type="number" placeholder="$ evento"
                      value={form.ajustes[p.id] || ''}
                      onChange={e => setAjuste(p.id, e.target.value)}
                      className="w-28 bg-cream rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                ))}
              </div>
            )}

            {errorForm && (
              <p className="text-red-400 text-xs font-medium bg-red-50 rounded-xl py-2 text-center">{errorForm}</p>
            )}

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
