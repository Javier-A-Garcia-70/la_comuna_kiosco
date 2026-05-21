import React from 'react';

export default function Sidebar({ open, onClose, rutas, currentPath, onNavegar, userMode, onSalir }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      )}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col transition-transform duration-300 ease-out shadow-xl ${open ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="bg-brand-400 p-5">
          <div className="flex items-center justify-between mb-4">
            <img src="/logo.png" alt="La Comuna" className="h-8 object-contain" />
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white active:scale-90 transition-transform">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <p className="text-white/60 text-xs mt-2">{userMode === 'admin' ? 'Administrador' : 'Invitado'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <p className="text-xs font-medium text-stone-300 uppercase tracking-wider px-3 py-2">Vistas</p>
          {rutas.map(r => {
            const activa = currentPath === r.path;
            return (
              <button
                key={r.path}
                onClick={() => onNavegar(r.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors active:scale-95 ${
                  activa ? 'bg-brand-50 text-brand-500 font-medium' : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                <span className="text-base w-6 text-center">{r.icon}</span>
                <span>{r.label}</span>
                {activa && (
                  <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-100">
          <button
            onClick={onSalir}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-400 text-sm hover:bg-red-50 hover:text-red-400 transition-colors active:scale-95"
          >
            <span className="text-base w-6 text-center">🚪</span>
            <span>{userMode === 'admin' ? 'Cerrar sesión' : 'Salir'}</span>
          </button>
        </div>
      </div>
    </>
  );
}
