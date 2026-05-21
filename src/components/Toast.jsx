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
    ok:    'bg-emerald-50 text-emerald-700 border-emerald-100',
    error: 'bg-red-50 text-red-500 border-red-100',
    info:  'bg-brand-50 text-brand-500 border-brand-100',
  };

  return (
    <div
      className={`fixed bottom-6 right-4 left-4 max-w-sm mx-auto z-50 border rounded-2xl px-4 py-3 text-sm font-medium shadow-md ${colores[notif.tipo]}`}
      style={{ animation: 'slideUp 0.2s ease-out' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{notif.texto}</span>
        <button onClick={onClose} className="text-lg leading-none opacity-40 hover:opacity-70">×</button>
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
