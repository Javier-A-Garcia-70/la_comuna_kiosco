import React from 'react';

export default function Sidebar({ open, onClose, rutas, currentPath, onNavegar, userMode, onSalir, installPrompt, onInstalar }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      )}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col transition-transform duration-300 ease-out shadow-xl ${open ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="bg-brand-400 p-5">
          <div className="mb-4">
            <img src="/logo.png" alt="La Comuna" className="h-8 object-contain" />
          </div>
          <p className="text-white/60 text-xs mt-2">{userMode === 'admin' ? 'Administrador' : 'Invitado'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
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

        <p className="pl-7 pb-1 text-stone-300 text-[10px] italic font-light">versión 1.0.0</p>
        {installPrompt && (
          <div className="px-3">
            <button
              onClick={onInstalar}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-400 text-sm hover:bg-stone-50 transition-colors active:scale-95"
            >
              <span className="w-6 text-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                  <path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/>
                </svg>
              </span>
              <span>Agregar a inicio</span>
            </button>
          </div>
        )}
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
