# POS Centro Cultural — Blueprint para Claude Code

## Stack
- Vite + React + Tailwind CSS
- Supabase (Postgres + Realtime + Auth)
- Sin backend propio, sin router externo (navegación manual con pushState)

## Estructura de carpetas

```
src/
├── lib/
│   ├── supabase.js          # createClient con persistSession: true, autoRefreshToken: true
│   └── errores.js           # traducirError(error) → string en español llano, sin códigos HTTP
├── components/
│   ├── Toast.jsx            # Notificación flotante bottom-right, tipo ok/error/info, auto-cierre 4s
│   └── IconoFallback.jsx    # Emoji por categoría: bebida=🍺, comida=🍕, otro=📦
├── views/
│   ├── Taquilla.jsx         # Vista pública
│   ├── Barra.jsx            # Vista pública
│   ├── AdminDashboard.jsx   # Vista protegida (requiere sesión)
│   ├── Stock.jsx            # Vista protegida (requiere sesión)
│   └── Login.jsx            # Email + contraseña, sin registro público
└── App.jsx                  # Enrutador, estado global, procesarTransaccion
```

---

## Supabase — tablas

```sql
-- Productos
CREATE TABLE productos (
  id           bigserial PRIMARY KEY,
  nombre       text    NOT NULL,
  precio       numeric NOT NULL DEFAULT 0,
  stock        integer NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 2,
  categoria    text    NOT NULL DEFAULT 'bebida'  -- 'bebida' | 'comida' | 'otro'
);

-- Ventas (historial persistente)
CREATE TABLE ventas (
  id          bigserial PRIMARY KEY,
  items       jsonb     NOT NULL,
  total       numeric   NOT NULL DEFAULT 0,
  metodo_pago text,                              -- 'efectivo' | 'transferencia' | 'invitado'
  origen      text,                              -- 'taquilla' | 'barra'
  fecha       timestamptz NOT NULL DEFAULT now()
);
```

## Supabase — RPCs

```sql
-- Decremento atómico: evita vender sin stock
-- Retorna TRUE si ok, FALSE si no hay stock suficiente
CREATE OR REPLACE FUNCTION decrementar_stock(producto_id bigint, cantidad integer)
RETURNS boolean AS $$
DECLARE filas int;
BEGIN
  UPDATE productos SET stock = stock - cantidad
  WHERE id = producto_id AND stock >= cantidad;
  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas > 0;
END;
$$ LANGUAGE plpgsql;

-- Contador de entradas del día (acceso público sin exponer tabla ventas)
CREATE OR REPLACE FUNCTION contar_entradas_hoy()
RETURNS integer AS $$
  SELECT COUNT(*)::integer FROM ventas
  WHERE origen = 'taquilla' AND fecha >= CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER;
```

## Supabase — RLS

```sql
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas    ENABLE ROW LEVEL SECURITY;

-- Productos: lectura pública, escritura solo autenticados
CREATE POLICY "lectura_publica_productos"     ON productos FOR SELECT USING (true);
CREATE POLICY "escritura_autenticada_productos" ON productos FOR ALL    USING (auth.role() = 'authenticated');

-- Ventas: insert público (barra y taquilla no tienen login), select solo autenticados
CREATE POLICY "insertar_venta_publica"        ON ventas FOR INSERT WITH CHECK (true);
CREATE POLICY "lectura_autenticada_ventas"    ON ventas FOR SELECT USING (auth.role() = 'authenticated');

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE productos;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas;
```

---

## App.jsx — responsabilidades

1. **Estado global**: `productos`, `ventasEnVivo` (solo hoy), `session`, `notif`
2. **Init**: carga productos y ventas del día (`gte fecha hoy`) desde Supabase
3. **Realtime**: dos canales — `cambios-productos` (INSERT/UPDATE/DELETE) y `cambios-ventas` (INSERT)
4. **Auth**: `getSession()` al montar + `onAuthStateChange` para mantener sesión viva
5. **`procesarTransaccion(items, metodoPago, origen)`**:
   - Por cada item que no sea ENTRADA: llama RPC `decrementar_stock` → si retorna false, muestra error y aborta
   - Inserta en tabla `ventas` con **retry automático** (3 intentos, backoff 800ms×intento)
   - Si falla tras reintentos: toast de error con mensaje "La venta se procesó pero no pudo guardarse. Anotala manualmente."
   - Retorna `true/false` para que la vista sepa si limpiar el carrito
6. **`mostrarNotif(tipo, texto)`**: setea estado que Toast consume
7. **Rutas por pushState**: `/entrada`, `/barra`, `/admin`, `/stock`. Admin y Stock renderizan Login si no hay sesión.

---

## Vistas — comportamiento clave

### Taquilla.jsx (pública)
- Al montar: llama RPC `contar_entradas_hoy()` para cargar el contador desde DB (persiste recargas)
- Tres botones: **Efectivo** ($1500), **Transferencia** ($1500), **Invitado** ($0)
- Contador grande arriba, solo muestra total de personas, sin desglose
- Deshabilita botones mientras `procesando`

### Barra.jsx (pública)
- Grilla de productos filtrada por `stock > 0` (productos agotados no aparecen)
- Alerta visual si `stock <= stock_minimo`: borde rojo + badge "ÚLTIMAS N!"
- Carrito con botón `+` (click en producto) y `−` (en el pedido)
- No permite agregar más unidades de las que hay en stock
- Dos botones de cobro: Efectivo / Transferencia
- Botones deshabilitados si carrito vacío o `procesando`

### AdminDashboard.jsx (protegida)
- **Pestaña "En vivo — hoy"**: caja total del día, desglose por método de pago, estado de stock (verde/naranja/rojo)
- **Pestaña "Historial"**: dos inputs date (desde/hasta) + botón consultar → query directa a Supabase con `.gte` y `.lte`. Muestra total, cantidad de operaciones, entradas y desglose por método.

### Stock.jsx (protegida)
- Lista de productos ordenados por categoría → nombre
- Badge de estado de stock por producto (verde/naranja/rojo)
- **Refill rápido inline**: input numérico + botón "Agregar" → hace `update stock = stock + N` → el realtime distribuye a todos los dispositivos
- Botón editar → modal con todos los campos (nombre, precio, stock, stock_minimo, categoría)
- Botón × → eliminar con confirm()
- Botón "+ Nuevo" → mismo modal vacío

### Login.jsx (pública, guardia de rutas protegidas)
- Email + contraseña, Enter dispara login
- `supabase.auth.signInWithPassword()` — no hay registro público
- Error: "Credenciales incorrectas." sin más detalle

---

## Manejo de errores — regla global

Importar `traducirError(error)` de `lib/errores.js` en cualquier componente que haga llamadas a Supabase.
La función mapea mensajes técnicos y status codes a frases en español sin jerga.
Nunca mostrar el error crudo al usuario.

---

## Variables de entorno (.env)

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

## Dependencias

```bash
npm create vite@latest . -- --template react
npm install @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## Lo que NO hay

- No hay router externo (react-router, etc.) — navegación con pushState nativo
- No hay Redux ni Context — estado global en App.jsx bajado por props
- No hay imágenes de productos — solo IconoFallback por categoría
- No hay registro de usuarios — admin se crea manualmente desde Supabase Dashboard → Authentication → Users
- No hay tope de entradas por aforo (decisión de negocio: sin límite)
- No hay backend propio — todo directo a Supabase
