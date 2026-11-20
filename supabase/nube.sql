-- ============================================================
--  Nube Gung Ho: tablas y carpeta de fotos en Supabase
--  Pégalo completo en Supabase → SQL Editor → Run (una sola vez).
-- ============================================================

create extension if not exists pgcrypto;

-- Empresas o instituciones (cada una es una carpeta de la nube)
create table if not exists nube_empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,          -- enlace: tunube.com/<slug>
  logo_path  text,
  visible    boolean not null default true, -- false = no sale en la portada (solo con el enlace)
  orden      integer not null default 0,
  creado     timestamptz not null default now()
);

-- Fotos y videos de cada empresa (el archivo original, en HD)
create table if not exists nube_fotos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references nube_empresas(id) on delete cascade,
  tipo        text not null default 'foto' check (tipo in ('foto', 'video')),
  path        text not null,      -- archivo original
  mini_path   text,               -- miniatura JPG para la cuadrícula
  ancho       integer not null default 0,
  alto        integer not null default 0,
  bytes       bigint  not null default 0,
  nombre      text    not null default '',
  orden       integer not null default 0,
  creado      timestamptz not null default now()
);
alter table nube_fotos add column if not exists tipo text not null default 'foto';
create index if not exists nube_fotos_empresa on nube_fotos (empresa_id, orden, creado);

-- Logo de arriba, título, fondo y qué tanto se oscurece
create table if not exists nube_ajustes (
  id            integer primary key default 1 check (id = 1),
  logo_path     text,             -- vacío = el logo de Gung Ho que trae la página
  titulo        text not null default 'Nube de fotos',
  subtitulo     text not null default 'Busca tu empresa o institución y abre sus fotos.',
  fondo_path    text,
  fondo_modo    text not null default 'cubrir' check (fondo_modo in ('cubrir', 'centrado')),
  fondo_oscuro  integer not null default 75 check (fondo_oscuro between 0 and 95)
);
alter table nube_ajustes add column if not exists logo_path text;
insert into nube_ajustes (id) values (1) on conflict do nothing;

-- Resumen para la portada: cuántos archivos tiene cada empresa (y cuántos son videos)
drop view if exists nube_resumen;
create view nube_resumen with (security_invoker = true) as
select e.*,
       coalesce(c.total, 0)      as total,
       coalesce(c.videos, 0)     as videos,
       coalesce(c.muestras, '{}') as muestras
  from nube_empresas e
  left join lateral (
    select count(*)::int as total,
           (count(*) filter (where f.tipo = 'video'))::int as videos,
           (array_agg(f.mini_path order by f.orden, f.creado) filter (where f.mini_path is not null))[1:3] as muestras
      from nube_fotos f
     where f.empresa_id = e.id
  ) c on true;

-- Seguridad: nadie lee ni escribe directo; solo el servidor de la nube (con la clave secreta)
alter table nube_empresas enable row level security;
alter table nube_fotos    enable row level security;
alter table nube_ajustes  enable row level security;

-- Carpeta pública de archivos "nube" (máx. 50 MB por archivo: fotos y videos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nube', 'nube', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
