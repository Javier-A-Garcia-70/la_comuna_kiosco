-- ============================================================
-- SETUP COMPLETO DE BASE DE DATOS SUPABASE
-- Correr una sola vez en el SQL Editor de Supabase
-- ============================================================

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id          bigserial PRIMARY KEY,
  nombre      text      NOT NULL,
  precio      numeric   NOT NULL DEFAULT 0,
  stock       integer   NOT NULL DEFAULT 0,
  stock_minimo integer  NOT NULL DEFAULT 2,
  categoria   text      NOT NULL DEFAULT 'bebida',
  imagen_url  text
);

-- Tabla de ventas (persiste entre recargas y dispositivos)
CREATE TABLE IF NOT EXISTS ventas (
  id          bigserial PRIMARY KEY,
  items       jsonb     NOT NULL,
  total       numeric   NOT NULL DEFAULT 0,
  metodo_pago text,
  origen      text,
  fecha       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RPC: Decremento atómico de stock
-- Previene vender sin stock en caso de race condition
-- Retorna TRUE si el descuento fue exitoso, FALSE si no hay stock
-- ============================================================
CREATE OR REPLACE FUNCTION decrementar_stock(producto_id bigint, cantidad integer)
RETURNS boolean AS $$
DECLARE
  filas_afectadas integer;
BEGIN
  UPDATE productos
  SET stock = stock - cantidad
  WHERE id = producto_id AND stock >= cantidad;

  GET DIAGNOSTICS filas_afectadas = ROW_COUNT;
  RETURN filas_afectadas > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Habilitar Realtime en ambas tablas
-- (También se puede hacer desde el dashboard de Supabase)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE productos;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas;

-- ============================================================
-- Productos de ejemplo (opcional, borrar si no se necesitan)
-- ============================================================
INSERT INTO productos (nombre, precio, stock, stock_minimo, categoria)
VALUES
  ('Cerveza 1L',   800,  30, 5, 'bebida'),
  ('Cerveza 500',  500,  40, 5, 'bebida'),
  ('Agua',         300,  20, 3, 'bebida'),
  ('Gaseosa',      400,  20, 3, 'bebida'),
  ('Empanada',     600,  25, 4, 'comida');


-- ============================================================
-- AUTENTICACIÓN Y SEGURIDAD (RLS)
-- ============================================================

-- Habilitar RLS
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

-- Productos: lectura pública, escritura solo autenticados
CREATE POLICY "lectura_publica_productos" ON productos
  FOR SELECT USING (true);

CREATE POLICY "escritura_autenticada_productos" ON productos
  FOR ALL USING (auth.role() = 'authenticated');

-- Ventas: cualquiera puede insertar (barra y taquilla no tienen login)
-- Solo autenticados pueden leer el historial
CREATE POLICY "insertar_venta_publica" ON ventas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "lectura_autenticada_ventas" ON ventas
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- CREAR USUARIO ADMIN (hacer esto UNA SOLA VEZ)
-- Opción A: desde el Dashboard de Supabase
--   Authentication → Users → Add user → email + contraseña
--
-- Opción B: desde SQL (reemplazar valores)
-- ============================================================
-- SELECT supabase_admin.create_user('{"email":"admin@tuevento.com","password":"TuContraseñaSegura123","email_confirm":true}');


-- ============================================================
-- RPC: Contador de entradas del día (acceso público, sin exponer ventas)
-- ============================================================
CREATE OR REPLACE FUNCTION contar_entradas_hoy()
RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM ventas
  WHERE origen = 'taquilla'
    AND fecha >= CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER;
