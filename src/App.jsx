import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { traducirError } from './lib/errores';
import { fechaLocal } from './lib/fecha';
import Toast from './components/Toast';
import Sidebar from './components/Sidebar';
import Landing from './views/Landing';
import VistaTaquilla from './views/Taquilla';
import VistaBarra from './views/Barra';
import VistaAdmin from './views/AdminDashboard';
import VistaStock from './views/Stock';
import VistaEventos from './views/Eventos';

async function conRetry(fn, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === intentos - 1) throw err;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}

export default function App() {
  const [userMode, setUserMode] = useState(null);
  const [currentPath, setCurrentPath] = useState('/barra');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productos, setProductos] = useState([]);
  const [ventasEnVivo, setVentasEnVivo] = useState([]);
  const [notif, setNotif] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('dark', darkMode ? '1' : '0');
  }, [darkMode]);

  const mostrarNotif = useCallback((tipo, texto) => setNotif({ tipo, texto }), []);
  const cerrarNotif  = useCallback(() => setNotif(null), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUserMode('admin');
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setUserMode('admin');
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const calcularEventoActivo = useCallback((lista) => {
    const ahora = new Date();
    const minActual = ahora.getHours() * 60 + ahora.getMinutes();
    const activo = lista.find(ev => {
      const [h1, m1] = ev.hora_inicio.split(':').map(Number);
      const [h2, m2] = ev.hora_fin.split(':').map(Number);
      return minActual >= h1 * 60 + m1 && minActual <= h2 * 60 + m2;
    }) || null;
    setEventoActivo(activo);
  }, []);

  useEffect(() => {
    calcularEventoActivo(eventos);
    const timer = setInterval(() => calcularEventoActivo(eventos), 60000);
    return () => clearInterval(timer);
  }, [eventos, calcularEventoActivo]);

  useEffect(() => {
    if (!userMode) return;
    const init = async () => {
      const { data: prods, error } = await supabase.from('productos').select('*');
      if (error) mostrarNotif('error', traducirError(error));
      else setProductos(prods || []);
      const hoy = fechaLocal();
      const { data: evs } = await supabase.from('eventos').select('*').eq('fecha', hoy).order('hora_inicio');
      setEventos(evs || []);
      if (userMode === 'admin') {
        const { data: ventas } = await supabase.from('ventas').select('*').gte('fecha', hoy);
        setVentasEnVivo(ventas || []);
      }
    };
    init();

    const canalProductos = supabase.channel('cambios-productos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, (payload) => {
        if (payload.eventType === 'INSERT') setProductos(prev => [...prev, payload.new]);
        else if (payload.eventType === 'UPDATE') setProductos(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
        else if (payload.eventType === 'DELETE') setProductos(prev => prev.filter(p => p.id !== payload.old.id));
      }).subscribe();

    const canalEventos = supabase.channel('cambios-eventos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos' }, () => {
        const hoy = fechaLocal();
        supabase.from('eventos').select('*').eq('fecha', hoy).order('hora_inicio')
          .then(({ data }) => setEventos(data || []));
      }).subscribe();

    const canalVentas = userMode === 'admin'
      ? supabase.channel('cambios-ventas')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, (payload) => {
            setVentasEnVivo(prev => [...prev, payload.new]);
          }).subscribe()
      : null;

    return () => {
      supabase.removeChannel(canalProductos);
      supabase.removeChannel(canalEventos);
      if (canalVentas) supabase.removeChannel(canalVentas);
    };
  }, [userMode]);

  const procesarTransaccion = async (items, metodoPago, origen) => {
    const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    for (const item of items) {
      if (item.id === 'ENTRADA') continue;
      if (item.categoria === 'comida') continue;
      const { data: ok, error } = await supabase.rpc('decrementar_stock', { producto_id: item.id, cantidad: item.cantidad });
      if (error) { mostrarNotif('error', traducirError(error)); return false; }
      if (!ok)   { mostrarNotif('error', `Sin stock: ${item.nombre}`); return false; }
    }
    try {
      await conRetry(async () => {
        const { error } = await supabase.from('ventas').insert({ items, total, metodo_pago: metodoPago, origen, fecha: new Date().toISOString() });
        if (error) throw error;
      });
    } catch {
      mostrarNotif('error', 'Venta procesada pero no guardada. Anotala manualmente.');
      return false;
    }
    return true;
  };

  const navegar  = (path) => { setCurrentPath(path); setSidebarOpen(false); };
  const salir    = async () => { await supabase.auth.signOut(); setUserMode(null); setCurrentPath('/barra'); };

  const rutas = userMode === 'admin'
    ? [{ path:'/barra', label:'Barra', icon:'🍺' }, { path:'/entrada', label:'Taquilla', icon:'🎟️' }, { path:'/eventos', label:'Eventos', icon:'🎉' }, { path:'/admin', label:'Ventas', icon:'📊' }, { path:'/stock', label:'Stock', icon:'📦' }]
    : [{ path:'/barra', label:'Barra', icon:'🍺' }, { path:'/entrada', label:'Taquilla', icon:'🎟️' }];

  if (!userMode) return (
    <>
      <Landing onGuest={() => { setUserMode('guest'); setCurrentPath('/barra'); }} />
      <Toast notif={notif} onClose={cerrarNotif} />
    </>
  );

  const props = { mostrarNotif };
  const titulo = rutas.find(r => r.path === currentPath)?.label ?? '';

  return (
    <div className="min-h-dvh bg-cream overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-white border-b border-stone-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center text-stone-500 active:scale-95 transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span className="font-medium text-stone-700 text-base">{titulo}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode(d => !d)}
            className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center text-stone-500 active:scale-95 transition-transform text-base">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <div className="w-9 h-9 rounded-xl bg-brand-400 flex items-center justify-center text-white text-xs font-bold">
            {userMode === 'admin' ? 'AD' : 'G'}
          </div>
        </div>
      </header>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} rutas={rutas} currentPath={currentPath} onNavegar={navegar} userMode={userMode} onSalir={salir} />

      <main className="p-4 max-w-lg mx-auto">
        {currentPath === '/barra'   && <VistaBarra   productos={productos} registrarVenta={procesarTransaccion} eventoActivo={eventoActivo} {...props} />}
        {currentPath === '/entrada' && <VistaTaquilla registrarVenta={procesarTransaccion} eventoActivo={eventoActivo} {...props} />}
        {currentPath === '/admin'   && userMode === 'admin' && <VistaAdmin productos={productos} ventas={ventasEnVivo} eventos={eventos} eventoActivo={eventoActivo} {...props} />}
        {currentPath === '/stock'   && userMode === 'admin' && <VistaStock productos={productos} {...props} />}
        {currentPath === '/eventos' && userMode === 'admin' && <VistaEventos productos={productos} eventos={eventos} {...props} />}
      </main>

      <Toast notif={notif} onClose={cerrarNotif} />
    </div>
  );
}
