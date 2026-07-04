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

> **Actualización (julio 2026)**: la primera versión de esta solución (un GET de
> lectura lunes y viernes) NO alcanzó. Con 8 corridas verdes consecutivas,
> Supabase mandó igual el mail de pausa inminente, con el texto *"identified
> those which have not seen **sufficient activity** for more than 7 days"*.
> La palabra clave es "sufficient": no miden presencia/ausencia de queries sino
> un umbral mínimo de actividad, y 2 lecturas semanales de una fila quedan por
> debajo. La solución actual usa una **escritura real diaria**.

## La solución: GitHub Actions cron job con escritura diaria

Un workflow que **todos los días** hace dos requests reales a la API REST de
Supabase: un `UPDATE` vía RPC (la señal fuerte) y un `SELECT` (señal
secundaria). Gratis, sin servicios externos, vive en el propio repo.

Archivos:
- [.github/workflows/supabase-keepalive.yml](.github/workflows/supabase-keepalive.yml) — el cron job
- [supabase/keepalive.sql](supabase/keepalive.sql) — tabla + función (se pega una vez en el SQL Editor)

### La tabla "fantasma" y su función RPC

Para no ensuciar los datos reales del negocio, la escritura va a una tabla
dedicada `keepalive` de **una sola fila**, que cada día pisa su propio
timestamp — nunca crece y no interfiere con nada:

- Tabla `public.keepalive (id int pk, pinged_at timestamptz)` con una fila fija.
- RLS activado **sin políticas**: nadie puede tocarla directo, ni con la anon key.
- Función `keepalive_ping()` con `security definer`: la única puerta de entrada;
  hace `UPDATE keepalive SET pinged_at = now() WHERE id = 1` y devuelve el
  timestamp. Tiene `GRANT EXECUTE` para `anon`.

Un `UPDATE` real pasa por el motor de Postgres y genera WAL: es el tipo de
actividad que el detector de Supabase no puede ignorar, a diferencia de las
lecturas mínimas espaciadas.

### Por qué GitHub Actions y no otra cosa

- **cron-job.org / UptimeRobot**: requieren un endpoint HTTP propio que toque la DB.
  Una SPA estática en Vercel (sin backend) no lo tiene. Hacer ping al sitio de
  Vercel NO toca la DB → no sirve.
- **Vercel Cron**: requiere agregar una API Route al proyecto (más complejidad).
- **GitHub Actions**: el repo ya existe, es gratis (2000 min/mes; este job usa
  ~30 s por corrida), cero infra extra.

### Cómo funciona técnicamente

- Corre todos los días a las 9:17 UTC (minuto 17 a propósito: los crons "en
  punto" son los más congestionados y GitHub los demora).
- Request 1: `POST https://<proyecto>.supabase.co/rest/v1/rpc/keepalive_ping`
  → la escritura. Si falla, el workflow queda en rojo.
- Request 2: `GET .../rest/v1/ventas?select=id&limit=1` → la lectura que usaba
  la versión original, como segunda señal de actividad.
- Ambas con headers `apikey` y `Authorization: Bearer <anon_key>`.
- **Log de diagnóstico**: imprime `Host: <proyecto>.supabase.co` en cada
  corrida. GitHub enmascara el valor exacto de los secrets pero no substrings,
  así que el log muestra a qué proyecto le está pegando el ping de verdad —
  sirve para detectar secrets que apuntan a otro proyecto (el workflow saldría
  verde igual y nunca te enterarías). No es dato sensible: la URL y la anon key
  ya viajan en el bundle público de la app.
- Usa el módulo `https` nativo de Node (ya viene en `ubuntu-latest`), **sin
  `npm install`**, para que sea instantáneo y sin dependencias.
- Sale con código 0 si ambas requests dan status < 400, o 1 si alguna falla.

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

**2. La tabla y la función en Supabase** (una sola vez): pegar el contenido de
[supabase/keepalive.sql](supabase/keepalive.sql) en el dashboard → SQL Editor →
Run.

**3. Para adaptarlo a otro proyecto** — tres cosas:

- Pegar el mismo `keepalive.sql` en el SQL Editor de ese proyecto (es genérico,
  no depende de nada de la app).
- Cambiar `ventas` en el GET del workflow por **cualquier tabla que exista** en
  ese proyecto y que la anon key pueda leer. Si la tabla devuelve 401/403 por RLS
  igual sirve para mantener viva la DB (la query llega al motor), pero conviene
  una que dé 200 para que el log sea claro y el workflow no quede en rojo.
- Verificar que los nombres de los secrets coincidan con lo que espera el `env:`.

### Cómo probarlo

1. Pegar `keepalive.sql` en el SQL Editor del proyecto.
2. Pushear el archivo del workflow y cargar los dos secrets.
3. GitHub → pestaña **Actions** → "Supabase Keep-Alive" → **Run workflow**
   (botón manual, gracias a `workflow_dispatch`).
4. En los logs debe aparecer el `Host:` del proyecto correcto y `Status: 200`
   en las dos requests (el POST devuelve el timestamp recién escrito).
5. Verificar en el dashboard (Table Editor → `keepalive`) que `pinged_at`
   coincida con la hora de la corrida.
6. Después corre solo todos los días a las 9:17 UTC.

### Detalles y limitaciones

- **Cadencia**: diaria. La versión original (lunes+viernes) respetaba el límite
  de 7 días pero no superó el umbral de "sufficient activity" — ver la nota al
  inicio. Si Supabase endurece el criterio de nuevo, lo próximo sería sumar más
  requests por corrida.
- **GitHub desactiva los crons tras ~60 días sin actividad en el repo** — pero
  este workflow lo tiene resuelto: su último paso llama a la API de GitHub para
  re-habilitarse a sí mismo (`gh workflow enable`), lo que resetea el contador
  de 60 días en cada corrida diaria. No hace falta commitear nunca. Requiere el
  permiso `actions: write` declarado en el workflow. Si igual llegara un mail
  "scheduled workflow disabled" (p. ej. porque el workflow estuvo fallando
  mucho tiempo), se reactiva con un click en la pestaña Actions.
- **No es 100% garantizado**: si Supabase pausa igual, el proyecto NO se
  reactiva solo — hay que hacerlo a mano desde el dashboard.
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
