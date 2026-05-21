import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Landing({ onGuest }) {
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const login = async () => {
    if (!email || !password) return;
    setCargando(true);
    setError(null);
    // Si no tiene @, lo convierte a usuario@lacomuna.com para Supabase
    const emailReal = email.includes('@') ? email : `${email}@lacomuna.com`;
    const { error } = await supabase.auth.signInWithPassword({ email: emailReal, password });
    if (error) setError('Credenciales incorrectas.');
    setCargando(false);
  };

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-5">

        <div className="space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl">
            🎪
          </div>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Centro Cultural</h1>
          <p className="text-stone-400 text-sm">Sistema de ventas</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-100 space-y-3">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Acceso administrador</p>
          <input
            type="text"
            placeholder="Usuario"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
          <button
            onClick={login}
            disabled={cargando}
            className="w-full bg-brand-400 text-white font-medium rounded-xl py-2.5 text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-xs text-stone-300">o</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <button
          onClick={onGuest}
          className="w-full bg-white text-stone-500 font-medium rounded-xl py-2.5 text-sm border border-stone-100 active:scale-95 transition-transform"
        >
          Continuar como invitado
        </button>

        <p className="text-center text-xs text-stone-300">Invitado: Barra y Taquilla únicamente</p>
      </div>
    </div>
  );
}
