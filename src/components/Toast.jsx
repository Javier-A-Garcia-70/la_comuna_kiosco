import React, { useEffect } from 'react';

/**
 * Notificación flotante en la esquina inferior derecha.
 * Props:
 *   notif: { tipo: 'ok' | 'error' | 'info', texto: string } | null
 *   onClose: () => void
 */
export default function Toast({ notif, onClose }) {
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [notif]);

  if (!notif) return null;

  const colores = {
    ok:    'bg-green-400 text-black border-black',
    error: 'bg-red-500 text-white border-white',
    info:  'bg-yellow-400 text-black border-black',
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 border-4 px-4 py-3 font-mono font-black uppercase text-sm max-w-xs shadow-lg ${colores[notif.tipo]}`}
      style={{ animation: 'slideUp 0.2s ease-out' }}
    >
      <div className="flex items-start justify-between gap-3">
        <span>{notif.texto}</span>
        <button onClick={onClose} className="font-black text-lg leading-none opacity-60 hover:opacity-100">×</button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
