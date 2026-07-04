-- Keep-alive de Supabase: tabla dedicada de 1 fila + función RPC de escritura.
-- Pegar UNA VEZ en el SQL Editor del dashboard de Supabase (proyecto ckslmeyhyuiroytkbyti).
-- Ver KEEPALIVE.md para el contexto completo.

create table if not exists public.keepalive (
  id int primary key,
  pinged_at timestamptz not null default now()
);

insert into public.keepalive (id) values (1) on conflict do nothing;

-- RLS activado SIN políticas: nadie puede leer/escribir la tabla directo.
-- La única puerta de entrada es la función de abajo (security definer).
alter table public.keepalive enable row level security;

create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update keepalive set pinged_at = now() where id = 1
  returning pinged_at;
$$;

grant execute on function public.keepalive_ping() to anon;
