-- =====================================================================
-- LTDB Mode Terrain — Migration 003
-- Wizard intervention linéaire : photo avant → travaux → photo après →
-- dictée rapport → facture → envoi groupé (rapport + facture + avis Google)
-- → publication optionnelle.
--
-- Ajoute :
--   - colonnes "terrain" sur interventions (étape courante, timings, suivi mail/avis)
--   - table parametres (key/value) pour stocker google_review_url et autres
--     configurations modifiables sans déploiement
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent : peut être ré-exécutée sans danger.
-- =====================================================================

-- =====================================================================
-- 1. INTERVENTIONS — colonnes Mode Terrain
-- =====================================================================
alter table interventions
  -- Étape courante du wizard (0 = pas commencé, 7 = terminé)
  -- 1 = photo avant, 2 = en cours, 3 = photo après, 4 = dictée rapport,
  -- 5 = facture, 6 = envoi groupé, 7 = publication (ou skip)
  add column if not exists terrain_step smallint not null default 0,

  -- Timings réels (le statut existant donne planifiee/en_cours/terminee, mais
  -- on veut les horodatages précis pour mesurer durée réelle vs estimée)
  add column if not exists heure_debut_reelle timestamptz,
  add column if not exists heure_fin_reelle timestamptz,

  -- Suivi envoi mail groupé (rapport + facture + avis Google)
  add column if not exists mail_envoye_at timestamptz,

  -- Suivi relance avis Google J+3
  add column if not exists avis_relance_at timestamptz,
  add column if not exists avis_recu boolean not null default false,

  -- Légendes des photos (parallèle à photos_urls)
  -- ['avant', 'apres', 'autre', ...] ou texte libre côté UI
  add column if not exists photos_legendes text[];

-- Contrainte sur terrain_step : entre 0 et 7
do $$ begin
  alter table interventions
    add constraint interventions_terrain_step_chk
    check (terrain_step between 0 and 7);
exception when duplicate_object then null;
end $$;

-- Index pour requêter rapidement "interventions en cours sur le terrain"
create index if not exists interventions_terrain_step_idx
  on interventions (terrain_step)
  where terrain_step between 1 and 6;

-- Index pour le cron de relance avis J+3
create index if not exists interventions_avis_relance_idx
  on interventions (mail_envoye_at)
  where avis_recu = false and avis_relance_at is null;

-- =====================================================================
-- 2. PARAMETRES — table key/value pour configs modifiables
-- =====================================================================
-- Permet de configurer google_review_url, et plus largement n'importe
-- quelle config sans déploiement. Une seule ligne par clé.
create table if not exists parametres (
  cle text primary key,
  valeur text,
  description text,
  updated_at timestamptz not null default now()
);

-- Trigger pour mettre à jour updated_at
create or replace function parametres_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists parametres_updated_at_trg on parametres;
create trigger parametres_updated_at_trg
  before update on parametres
  for each row execute function parametres_set_updated_at();

-- Seed des paramètres connus (idempotent : on n'écrase pas si déjà défini)
insert into parametres (cle, valeur, description) values
  ('google_review_url', null, 'URL de la fiche Google Business pour laisser un avis (ex: https://g.page/r/...)'),
  ('mail_relance_avis_delai_jours', '3', 'Nombre de jours avant relance auto demande d''avis Google')
on conflict (cle) do nothing;

-- =====================================================================
-- 3. RLS — parametres lisible par les utilisateurs authentifiés,
--    modifiable uniquement via service role (admin)
-- =====================================================================
alter table parametres enable row level security;

drop policy if exists "parametres_read_authenticated" on parametres;
create policy "parametres_read_authenticated"
  on parametres for select
  to authenticated
  using (true);

-- Pas de policy d'écriture : seul le service_role peut modifier
-- (les API routes Next.js qui utilisent SUPABASE_SERVICE_ROLE_KEY).

-- =====================================================================
-- 4. Commentaires (documentation inline pour Supabase Studio)
-- =====================================================================
comment on column interventions.terrain_step is
  'Étape courante du wizard Mode Terrain. 0=non démarré, 1=photo avant, 2=en cours, 3=photo après, 4=rapport, 5=facture, 6=envoi mail, 7=publication/terminé';
comment on column interventions.heure_debut_reelle is
  'Horodatage du tap "Démarrer" sur le terrain (≠ heure_prevue qui est planifiée)';
comment on column interventions.heure_fin_reelle is
  'Horodatage du tap "Terminer" sur le terrain';
comment on column interventions.mail_envoye_at is
  'Date d''envoi du mail groupé (rapport + facture + lien avis Google) au client';
comment on column interventions.avis_relance_at is
  'Date d''envoi de la relance auto demande d''avis Google (J+3 par défaut)';
comment on column interventions.avis_recu is
  'true si on a détecté un avis Google du client (à mettre à jour manuellement ou via API Google)';
comment on column interventions.photos_legendes is
  'Légendes des photos (parallèle à photos_urls). Index 0 = légende de photos_urls[0]';

comment on table parametres is
  'Configurations key/value modifiables sans déploiement (google_review_url, etc.)';
