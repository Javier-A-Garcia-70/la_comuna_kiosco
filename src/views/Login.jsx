import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function VistaLogin({ themeClass }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const login = async () => {
    if (!email || !password) return;
    setCargando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('Credenciales incorrectas.');
    setCargando(false);
  };

  return (
    <div className="max-w-sm mx-auto mt-20 space-y-4">
      <div className={`p-6 border-4 space-y-4 ${themeClass}`}>
        <h2 className="font-black uppercase text-xl tracking-widest border-b-4 pb-3">Acceso Admin</h2>

        <div>
          <label className="block font-black uppercase text-xs mb-1 opacity-70">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border-2 border-current bg-transparent p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <div>
          <label className="block font-black uppercase text-xs mb-1 opacity-70">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full border-2 border-current bg-transparent p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        {error && (
          <p className="text-red-500 font-black text-xs uppercase border-2 border-red-500 p-2 text-center">
            {error}
          </p>
        )}

        <button
          onClick={login}
          disabled={cargando}
          className="w-full p-3 bg-yellow-400 text-black font-black uppercase border-4 border-black active:translate-y-1 disabled:opacity-50"
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}
