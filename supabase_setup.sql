-- ═══════════════════════════════════════
-- KALORYX by ABG — Supabase Database Setup
-- Ejecuta este script en Supabase → SQL Editor
-- ═══════════════════════════════════════

-- ── Perfiles de usuario
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  age integer,
  sex text check (sex in ('M', 'F')),
  weight numeric(5,1),
  height numeric(5,1),
  goal text,
  activity numeric(3,2) default 1.55,
  cal_meta integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Comidas
create table if not exists foods (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  calories integer not null,
  moment text default 'Almuerzo',
  source text default 'manual',
  logged_at date default current_date,
  created_at timestamptz default now()
);

-- ── Entrenamientos
create table if not exists workouts (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null,
  intensity text default 'med',
  duration_mins integer not null,
  calories integer default 0,
  notes text,
  logged_at date default current_date,
  created_at timestamptz default now()
);

-- ── Historial de peso
create table if not exists weight_log (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade not null,
  weight numeric(5,1) not null,
  logged_at date default current_date,
  created_at timestamptz default now(),
  unique(user_id, logged_at)
);

-- ═══════════════════════════════════════
-- Row Level Security (RLS)
-- Cada usuario solo ve sus propios datos
-- ═══════════════════════════════════════

alter table profiles   enable row level security;
alter table foods      enable row level security;
alter table workouts   enable row level security;
alter table weight_log enable row level security;

-- Profiles
create policy "Users manage own profile"
  on profiles for all using (auth.uid() = id);

-- Foods
create policy "Users manage own foods"
  on foods for all using (auth.uid() = user_id);

-- Workouts
create policy "Users manage own workouts"
  on workouts for all using (auth.uid() = user_id);

-- Weight log
create policy "Users manage own weight"
  on weight_log for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- Auto-crear perfil al registrarse
-- ═══════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
