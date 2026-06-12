export const fechaLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// Un evento pertenece a la fecha en que empieza; si hora_fin < hora_inicio
// se entiende que termina al día siguiente (ej: 22:00 → 04:00).
export const eventoEstaActivo = (ev, ahora = new Date()) => {
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const [h1, m1] = ev.hora_inicio.split(':').map(Number);
  const [h2, m2] = ev.hora_fin.split(':').map(Number);
  const ini = h1 * 60 + m1;
  const fin = h2 * 60 + m2;
  const cruzaMedianoche = fin < ini;
  const hoy  = fechaLocal(ahora);
  const ayer = fechaLocal(new Date(ahora.getTime() - 86400000));
  if (ev.fecha === hoy)  return cruzaMedianoche ? min >= ini : min >= ini && min <= fin;
  if (ev.fecha === ayer) return cruzaMedianoche && min <= fin;
  return false;
};
