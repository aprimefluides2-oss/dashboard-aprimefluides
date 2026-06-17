-- =====================================================================
-- LTDB — Migration 005 — Module « Accord d'Intervention »
-- =====================================================================
-- Sécurise chaque dépannage en urgence par un accord signé AVANT travaux
-- (devis détaillé + demande expresse + information rétractation), archivé
-- comme preuve horodatée et opposable en cas de litige.
--
-- Ajoute :
--   - table tarifs              : prix des prestations (R2 — jamais hardcodés)
--   - table accords_intervention: l'accord lui-même (devis gelé + consentement + preuve)
--   - table lignes_devis        : lignes du devis, valeurs gelées au moment de l'accord
--   - bucket Storage accords-pdfs : PDF horodaté de chaque accord
--   - paramètres TVA / validité  : dans la table parametres existante
--
-- TVA : LTDB est en franchise en base de TVA (art. 293 B du CGI).
--       taux_tva = 0 par défaut, le total HT = total TTC. Les colonnes TVA
--       restent présentes pour le jour où le seuil serait dépassé.
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent : peut être ré-exécutée sans danger.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 0. Fonction updated_at partagée (déjà créée par schema.sql — on la
--    redéclare pour que cette migration soit auto-suffisante).
-- =====================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- 1. TARIFS — catalogue des prestations (source de vérité des prix)
-- =====================================================================
-- Le module Accord lit TOUJOURS cette table : aucun prix n'est écrit en
-- dur dans le code (règle R2). Pour un prix fixe : prix_min = prix_max.
create table if not exists tarifs (
  id         uuid primary key default gen_random_uuid(),
  type       text unique not null,          -- référence stable (DEBOUCHAGE_HP, CURAGE, …)
  label      text not null,                 -- libellé affiché / repris sur le devis
  prix_min   numeric not null default 0,
  prix_max   numeric not null default 0,
  unite      text not null default 'intervention',  -- 'intervention' | 'metre' | …
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tarifs_type_idx  on tarifs (type);
create index if not exists tarifs_actif_idx on tarifs (actif);

drop trigger if exists tarifs_set_updated_at on tarifs;
create trigger tarifs_set_updated_at before update on tarifs
  for each row execute function set_updated_at();

-- Seed des 5 prestations (idempotent : on n'écrase pas un prix déjà ajusté
-- en base — pour corriger un prix, éditer directement la ligne).
insert into tarifs (type, label, prix_min, prix_max, unite) values
  ('DEBOUCHAGE_MANUEL', 'Débouchage manuel',            99,  99,  'intervention'),
  ('DEBOUCHAGE_FURET',  'Débouchage furet électrique',  119, 119, 'intervention'),
  ('DEBOUCHAGE_HP',     'Débouchage haute pression',    199, 199, 'intervention'),
  ('CAMERA',            'Passage caméra',               110, 110, 'intervention'),
  ('CURAGE',            'Curage',                       25,  25,  'metre')
on conflict (type) do nothing;

-- =====================================================================
-- 2. ACCORDS_INTERVENTION — l'accord signé (devis + consentement + preuve)
-- =====================================================================
create table if not exists accords_intervention (
  id              uuid primary key default gen_random_uuid(),
  reference       text unique,              -- ACC-YYYYMMDD-HHMM (généré à la création)

  -- Rattachement : optionnel — un accord peut être créé seul sur le terrain.
  -- unique => un seul accord par intervention (les NULL ne se gênent pas).
  intervention_id uuid unique references interventions(id) on delete set null,
  client_id       uuid references clients(id) on delete set null,

  -- Client : recopié depuis la fiche au moment de l'accord (gel des données,
  -- exigence de preuve — l'accord reste intact si la fiche change après coup).
  client_nom          text not null default '',
  client_adresse      text,
  client_ville        text,
  client_code_postal  text,
  client_telephone    text,
  client_email        text,

  -- Devis (montants gelés). TVA non applicable en franchise en base :
  -- total_ht = total_ttc, taux_tva = 0.
  frais_deplacement numeric not null default 0,
  total_ht          numeric not null default 0,
  taux_tva          numeric not null default 0,
  total_tva         numeric not null default 0,
  total_ttc         numeric not null default 0,
  devis_gratuit     boolean not null default true,
  validite_jours    integer not null default 30,

  -- Caractère urgent / consentement
  intervention_urgente      boolean not null default true,
  demande_expresse          boolean not null default false, -- client sollicite expressément
  renonciation_retractation boolean not null default false, -- renonce (travaux urgents)
  a_travaux_non_urgents     boolean not null default false, -- ≥ 1 ligne non urgente

  -- Validation
  canal_validation text check (canal_validation in ('SIGNATURE','SMS')),
  signature_image  text,                    -- URL Storage du PNG du tracé
  sms_token        text unique,             -- réservé pour le canal SMS (sprint ultérieur)
  sms_envoye_at    timestamptz,
  valide_at        timestamptz,             -- horodatage de la validation client
  statut           text not null default 'BROUILLON'
    check (statut in ('BROUILLON','EN_ATTENTE_SMS','VALIDE','REFUSE','ANNULE')),
  motif_refus      text,

  -- Preuve
  pdf_url    text,
  ip_client  text,
  user_agent text,

  -- Sync hors-ligne (UUID généré côté device, déduplication à la sync)
  local_id  text unique,
  synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accords_intervention_idx     on accords_intervention (intervention_id);
create index if not exists accords_client_idx           on accords_intervention (client_id);
create index if not exists accords_statut_idx           on accords_intervention (statut);
create index if not exists accords_created_idx          on accords_intervention (created_at);
create index if not exists accords_reference_idx        on accords_intervention (reference);

drop trigger if exists accords_set_updated_at on accords_intervention;
create trigger accords_set_updated_at before update on accords_intervention
  for each row execute function set_updated_at();

-- =====================================================================
-- 3. LIGNES_DEVIS — lignes du devis (valeurs gelées au moment de l'accord)
-- =====================================================================
create table if not exists lignes_devis (
  id            uuid primary key default gen_random_uuid(),
  accord_id     uuid not null references accords_intervention(id) on delete cascade,

  tarif_type    text,                       -- référence tarifs.type (ou NULL si ligne libre)
  label         text not null,              -- recopié depuis tarifs.label (gel)
  prix_unitaire numeric not null default 0, -- recopié depuis tarifs au moment du devis (gel)
  unite         text not null default 'intervention',
  quantite      numeric not null default 1, -- ex. mètres de curage
  total_ligne   numeric not null default 0,
  urgent        boolean not null default true,  -- travail strictement nécessaire à l'urgence ?
  position      integer not null default 0,     -- ordre d'affichage

  created_at    timestamptz not null default now()
);
create index if not exists lignes_devis_accord_idx on lignes_devis (accord_id);

-- =====================================================================
-- 4. PARAMETRES — TVA & validité (table key/value existante, migration 003)
-- =====================================================================
insert into parametres (cle, valeur, description) values
  ('TVA_TRAVAUX', '0',
   'Taux de TVA appliqué aux accords/devis (%). 0 = franchise en base de TVA, art. 293 B du CGI.'),
  ('ACCORD_VALIDITE_JOURS', '30',
   'Durée de validité par défaut d''un devis d''accord d''intervention (jours).')
on conflict (cle) do nothing;

-- =====================================================================
-- 5. STORAGE — bucket des PDF d'accords (preuve archivée)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('accords-pdfs', 'accords-pdfs', true)
on conflict (id) do nothing;

-- =====================================================================
-- 6. RLS — désactivé (l'app accède en service_role côté serveur uniquement,
--    comme clients / interventions / documents dans schema.sql)
-- =====================================================================
alter table tarifs               disable row level security;
alter table accords_intervention disable row level security;
alter table lignes_devis         disable row level security;

-- =====================================================================
-- 7. Commentaires (documentation inline pour Supabase Studio)
-- =====================================================================
comment on table  tarifs is
  'Catalogue des prix des prestations. Source de vérité unique — le code ne hardcode jamais de prix (règle R2).';
comment on table  accords_intervention is
  'Accord d''intervention signé avant travaux : devis gelé + demande expresse + info rétractation + preuve horodatée.';
comment on table  lignes_devis is
  'Lignes du devis d''un accord. label / prix_unitaire / unite recopiés (gelés) depuis tarifs au moment de l''accord.';
comment on column accords_intervention.intervention_id is
  'Intervention rattachée (optionnelle). Un accord peut être créé seul sur le terrain ; au plus un accord par intervention.';
comment on column accords_intervention.taux_tva is
  'Taux de TVA (%). 0 par défaut — LTDB en franchise en base de TVA (art. 293 B du CGI).';
comment on column accords_intervention.a_travaux_non_urgents is
  'true si au moins une ligne est non urgente → le bloc rétractation affiche le maintien du délai de 14 jours.';
comment on column accords_intervention.local_id is
  'UUID généré côté device en mode hors-ligne. Sert de clé de déduplication à la synchronisation.';
