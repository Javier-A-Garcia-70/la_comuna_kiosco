import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { traducirError } from './lib/errores';
import { fechaLocal, eventoEstaActivo } from './lib/fecha';
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
  const [userMode, setUserMode] = useState(() => localStorage.getItem('userMode') || null);
  const [currentPath, setCurrentPath] = useState('/barra');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productos, setProductos] = useState([]);
  const [ventasEnVivo, setVentasEnVivo] = useState([]);
  const [notif, setNotif] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === '1');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [yaInstalada, setYaInstalada] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstallPrompt(null); setYaInstalada(true); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const instalarApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('dark', darkMode ? '1' : '0');
  }, [darkMode]);

  const mostrarNotif = useCallback((tipo, texto) => setNotif({ tipo, texto }), []);
  const cerrarNotif  = useCallback(() => setNotif(null), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) localStorage.removeItem('pos-cultural-auth');
      else if (data.session) setUserMode('admin');
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUserMode('admin');
      } else if (!session) {
        setUserMode(prev => {
          if (prev === 'admin') {
            if (event !== 'SIGNED_OUT') mostrarNotif('error', 'Sesión vencida, volvé a ingresar.');
            return null;
          }
          return prev;
        });
        localStorage.removeItem('userMode');
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const calcularEventoActivo = useCallback((lista) => {
    setEventoActivo(lista.find(ev => eventoEstaActivo(ev)) || null);
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
      const ayer = fechaLocal(new Date(Date.now() - 86400000));
      const { data: evs } = await supabase.from('eventos').select('*').in('fecha', [ayer, hoy]).order('fecha').order('hora_inicio');
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
        const ayer = fechaLocal(new Date(Date.now() - 86400000));
        supabase.from('eventos').select('*').in('fecha', [ayer, hoy]).order('fecha').order('hora_inicio')
          .then(({ data }) => setEventos(data || []));
      }).subscribe();

    const canalVentas = userMode === 'admin'
      ? supabase.channel('cambios-ventas')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, (payload) => {
            setVentasEnVivo(prev => [...prev, payload.new]);
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ventas' }, (payload) => {
            setVentasEnVivo(prev => prev.filter(v => v.id !== payload.old.id));
          })
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(canalProductos);
      supabase.removeChannel(canalEventos);
      if (canalVentas) supabase.removeChannel(canalVentas);
    };
  }, [userMode]);

  const procesarTransaccion = async (items, metodoPago, origen) => {
    const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
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
  const salir    = async () => { await supabase.auth.signOut(); localStorage.removeItem('userMode'); setUserMode(null); setCurrentPath('/barra'); };

  const rutas = userMode === 'admin'
    ? [{ path:'/barra', label:'Barra', icon:'🍺' }, { path:'/entrada', label:'Entrada', icon:'🎟️' }, { path:'/eventos', label:'Eventos', icon:'🎉' }, { path:'/admin', label:'Ventas', icon:'📊' }, { path:'/stock', label:'Stock', icon:'📦' }]
    : [{ path:'/barra', label:'Barra', icon:'🍺' }, { path:'/entrada', label:'Entrada', icon:'🎟️' }];

  if (!userMode) return (
    <>
      <Landing onGuest={() => { localStorage.setItem('userMode', 'guest'); setUserMode('guest'); setCurrentPath('/barra'); }} />
      <Toast notif={notif} onClose={cerrarNotif} />
    </>
  );

  const props = { mostrarNotif, userMode };
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

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} rutas={rutas} currentPath={currentPath} onNavegar={navegar} userMode={userMode} onSalir={salir} installPrompt={installPrompt} onInstalar={instalarApp} yaInstalada={yaInstalada} />

      {eventoActivo && (currentPath === '/barra' || currentPath === '/entrada') && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="bg-brand-400 text-white rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium">
            <span>🎉</span>
            <span>{eventoActivo.nombre}</span>
            <span className="ml-auto text-white/70 text-xs">{eventoActivo.hora_inicio.slice(0,5)}–{eventoActivo.hora_fin.slice(0,5)}</span>
          </div>
        </div>
      )}

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
