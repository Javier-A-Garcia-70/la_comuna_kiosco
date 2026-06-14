# Keep-Alive de Supabase (evitar suspensión por inactividad)

Documentación de la solución para que la base de datos de Supabase en **free tier**
no se suspenda por inactividad. Portable a otros proyectos.

## El problema

Supabase free tier **suspende (pausa) el proyecto tras 7 días consecutivos sin
actividad real de base de datos**. Visitar el dashboard NO cuenta — solo cuentan
queries reales (REST, SQL, etc.). Cuando se pausa:

- El compute se apaga; los datos, schema y backups se preservan.
- Reactivar tarda ~30 s y, hasta entonces, la app no responde.
- **Efecto secundario**: al pausarse, los refresh tokens de Supabase Auth quedan
  invalidados. Al volver, la app que intente refrescar la sesión guardada en
  localStorage tira `AuthApiError: Invalid Refresh Token`.

## La solución: GitHub Actions cron job

Un workflow que hace un GET real a la API REST de Supabase **dos veces por semana**
(lunes y viernes), reseteando el contador de 7 días. Gratis, sin servicios
externos, vive en el propio repo.

Archivo: [.github/workflows/supabase-keepalive.yml](.github/workflows/supabase-keepalive.yml)

### Por qué GitHub Actions y no otra cosa

- **cron-job.org / UptimeRobot**: requieren un endpoint HTTP propio que toque la DB.
  Una SPA estática en Vercel (sin backend) no lo tiene. Hacer ping al sitio de
  Vercel NO toca la DB → no sirve.
- **Vercel Cron**: requiere agregar una API Route al proyecto (más complejidad).
- **GitHub Actions**: el repo ya existe, es gratis (2000 min/mes; este job usa
  ~30 s por corrida), cero infra extra.

### Cómo funciona técnicamente

- Hace `GET https://<proyecto>.supabase.co/rest/v1/ventas?select=id&limit=1` con
  los headers `apikey` y `Authorization: Bearer <anon_key>`.
- Es una query REAL contra una tabla (`ventas`) → cuenta como actividad de DB.
- Usa el módulo `https` nativo de Node (ya viene en `ubuntu-latest`), **sin
  `npm install`**, para que sea instantáneo y sin dependencias.
- Sale con código 0 si el status HTTP < 400, o 1 si falla (así el workflow queda
  en rojo si algo anda mal).

### Qué necesita para funcionar

**1. Los dos secrets en GitHub** (repo → Settings → Secrets and variables →
Actions → New repository secret):

| Nombre                   | Valor                                       |
|--------------------------|---------------------------------------------|
| `VITE_SUPABASE_URL`      | la URL del proyecto, ej. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | la anon/public key del proyecto             |

> Los nombres de los secrets son arbitrarios; acá coinciden con las vars del
> `.env`. Si cambiás los nombres, ajustá las 3 referencias en el bloque `env:` y
> en `secrets.*` del workflow.

**2. Para adaptarlo a otro proyecto** — solo dos cosas:

- Cambiar `ventas` en la URL del workflow por **cualquier tabla que exista** en
  ese proyecto y que la anon key pueda leer. Si la tabla devuelve 401/403 por RLS
  igual sirve para mantener viva la DB (la query llega al motor), pero conviene
  una que dé 200 para que el log sea claro y el workflow no quede en rojo.
- Verificar que los nombres de los secrets coincidan con lo que espera el `env:`.

### Cómo probarlo

1. Pushear el archivo del workflow.
2. Cargar los dos secrets.
3. GitHub → pestaña **Actions** → "Supabase Keep-Alive" → **Run workflow**
   (botón manual, gracias a `workflow_dispatch`).
4. En los logs debe aparecer `Status: 200`.
5. Después corre solo cada lunes y viernes 9:00 UTC.

### Detalles y limitaciones

- **Cadencia**: lunes+viernes = máximo ~3-4 días entre pings, holgado dentro del
  límite de 7. Se puede ajustar el `cron`.
- **No es 100% garantizado**: algunos usuarios reportan que Supabase pausa igual
  ocasionalmente. Si pasa, el proyecto se reactiva solo con el siguiente ping
  (o manualmente desde el dashboard).
- **Si el proyecto YA está pausado**, hay que reactivarlo una vez a mano desde el
  dashboard; de ahí en más el workflow lo mantiene vivo.
- **Plan pago**: el Pro Plan de Supabase ($25/mes) elimina la pausa por
  inactividad y vuelve innecesario el workflow.

## Fix complementario en el frontend

Por el tema de los refresh tokens invalidados, en el arranque de la app conviene
limpiar el token si `getSession()` devuelve error, **sin** llamar a `signOut()`
(que dispararía una request y puede dar "No API key found" si la sesión ya no
existe en el server). Borrar directo del localStorage:

```js
supabase.auth.getSession().then(({ data, error }) => {
  if (error) localStorage.removeItem('<storageKey-del-cliente>'); // ej: 'pos-cultural-auth'
  else if (data.session) { /* sesión válida */ }
});
```

El `storageKey` es el que se define en
`createClient(url, key, { auth: { storageKey: '...' } })`.
En este proyecto está en [src/lib/supabase.js](src/lib/supabase.js) y el fix en
[src/App.jsx](src/App.jsx).
