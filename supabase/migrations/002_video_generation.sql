-- =====================================================================
-- LTDB Vidéo génération — Migration 002
-- Ajoute : colonnes vidéo sur interventions, bucket Storage, table social_tokens
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent : peut être ré-exécutée sans danger.
-- =====================================================================

-- =====================================================================
-- 1. INTERVENTIONS — colonnes vidéo
-- =====================================================================
alter table interventions
  add column if not exists video_urls jsonb,
  add column if not exists video_youtube_id text,
  add column if not exists video_youtube_url text,
  add column if not exists video_status text not null default 'idle',
  add column if not exists video_error text,
  add column if not exists video_rendered_at timestamptz,
  add column if not exists video_published_at timestamptz;

-- video_status valeurs : idle | rendering | ready | failed | uploading | published
do $$ begin
  alter table interventions
    add constraint interventions_video_status_chk
    check (video_status in ('idle','rendering','ready','failed','uploading','published'));
exception when duplicate_object then null;
end $$;

create index if not exists interventions_video_status_idx on interventions (video_status);

-- =====================================================================
-- 2. STORAGE — bucket public pour les vidéos rendues
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('intervention-videos', 'intervention-videos', true)
on conflict (id) do nothing;

-- =====================================================================
-- 3. SOCIAL TOKENS — refresh tokens OAuth (YouTube en v1, extensible)
-- =====================================================================
create table if not exists social_tokens (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  account_email text,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform)
);

create index if not exists social_tokens_platform_idx on social_tokens (platform);
