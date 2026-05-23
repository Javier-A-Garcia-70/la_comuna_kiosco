import React from 'react';

export default function IconoFallback({ categoria }) {
  const iconos = {
    cerveza: '🍺',
    vino:    '🍷',
    bebida:  '🥤',
    fernet:  '🥃',
    comida:  '🍕',
    otro:    '📦',
  };
  const emoji = iconos[categoria] || iconos.otro;
  return (
    <span className="text-4xl" role="img" aria-label={categoria}>
      {emoji}
    </span>
  );
}
