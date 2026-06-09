import React from 'react';

export default function IconoFallback({ categoria }) {
  const emoji = categoria === 'comida' ? '🍕' : '🥤';
  return (
    <span className="text-4xl" role="img" aria-label={categoria}>
      {emoji}
    </span>
  );
}
