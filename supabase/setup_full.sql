-- =====================================================================
-- APRIME DASHBOARD — ALIGNEMENT SCHÉMA SUPABASE (à exécuter UNE fois)
-- Supabase → SQL Editor → New query → coller TOUT → Run
-- 100% idempotent et ADDITIF : n'efface/ne renomme aucune donnée.
-- =====================================================================

-- ---------- PART 1 : schéma de base (tables/index/triggers/RLS) ----------
-- =====================================================================
-- LTDB CRM — Schéma Supabase Phase 1
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- Extensions utiles (gen_random_uuid)
create extension if not exists "pgcrypto";

-- =====================================================================
-- CLIENTS
-- =====================================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_nom_idx on clients (nom);
create index if not exists clients_email_idx on clients (email);
create index if not exists clients_ville_idx on clients (ville);

-- =====================================================================
-- TECHNICIENS
-- =====================================================================
create table if not exists techniciens (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text,
  telephone text,
  agence text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists techniciens_actif_idx on techniciens (actif);

-- =====================================================================
-- INTERVENTIONS — table centrale (prise de rdv → réalisation → publication)
-- =====================================================================
create table if not exists interventions (
  id uuid primary key default gen_random_uuid(),
  reference text unique,                     -- LTDB-YYYYMMDD-HHMM
  client_id uuid references clients(id) on delete set null,
  technicien_id uuid references techniciens(id) on delete set null,
  agence text,

  -- Localisation chantier (dénormalisé pour rapidité de recherche)
  type_intervention text,
  adresse_chantier text,
  ville text,
  code_postal text,

  -- Planning
  date_prevue date,
  heure_prevue time,
  duree_estimee_min integer,
  date_realisee date,
  urgence boolean not null default false,

  -- Workflow
  statut text not null default 'planifiee'
    check (statut in ('planifiee','en_cours','terminee','annulee')),
  prix_prevu numeric,
  notes_internes text,

  -- Données rapport (rempli en fin d'intervention)
  transcription text,
  rapport_json jsonb,
  seo_json jsonb,
  photos_urls text[],
  pdf_rapport_url text,
  publie_slug text,

  -- Canal d'acquisition : pages_jaunes / site_internet / google_adwords / bouche_oreille / prescription
  canal_acquisition text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interventions_date_idx on interventions (date_prevue);
create index if not exists interventions_statut_idx on interventions (statut);
create index if not exists interventions_client_idx on interventions (client_id);
create index if not exists interventions_technicien_idx on interventions (technicien_id);
create index if not exists interventions_ville_idx on interventions (ville);
create index if not exists interventions_agence_idx on interventions (agence);
create index if not exists interventions_reference_idx on interventions (reference);
create index if not exists interventions_canal_idx on interventions (canal_acquisition);

-- Migration en place : ajoute la colonne si elle n'existe pas (idempotent)
alter table interventions
  add column if not exists canal_acquisition text;
create index if not exists interventions_canal_idx on interventions (canal_acquisition);

-- =====================================================================
-- DOCUMENTS — factures, devis, attestations émis aux clients
-- =====================================================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid references interventions(id) on delete set null,
  client_id uuid references clients(id) on delete set null,

  type text not null check (type in ('facture','devis','attestation','rapport')),
  numero text,                               -- FA-..., DV-..., AT-...
  agence text,
  date_emission date not null default current_date,
  echeance text,

  statut text not null default 'brouillon'
    check (statut in ('brouillon','envoye','paye','annule','accepte','refuse','expire')),

  -- Montants (null pour attestation/rapport)
  montant_ht numeric,
  montant_ttc numeric,
  tva_taux numeric,

  payload jsonb not null,                    -- la facture/devis complet
  pdf_url text,
  envoye_email text,
  envoye_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_type_idx on documents (type);
create index if not exists documents_intervention_idx on documents (intervention_id);
create index if not exists documents_client_idx on documents (client_id);
create index if not exists documents_date_idx on documents (date_emission);
create index if not exists documents_statut_idx on documents (statut);
create index if not exists documents_numero_idx on documents (numero);

-- =====================================================================
-- FACTURES FOURNISSEURS — pour bilan comptable provisoire (Phase 4)
-- (créé maintenant pour ne pas avoir à migrer plus tard)
-- =====================================================================
create table if not exists factures_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  fournisseur text not null,
  numero text,
  date_facture date not null,
  montant_ht numeric not null default 0,
  tva numeric not null default 0,
  montant_ttc numeric not null default 0,
  categorie text check (categorie in ('carburant','materiel','sous_traitance','assurance','telecom','locaux','autre')),
  description text,
  pdf_url text,
  agence text,
  created_at timestamptz not null default now()
);
create index if not exists fournisseurs_date_idx on factures_fournisseurs (date_facture);
create index if not exists fournisseurs_categorie_idx on factures_fournisseurs (categorie);

-- =====================================================================
-- TRIGGERS — updated_at auto
-- =====================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

drop trigger if exists interventions_set_updated_at on interventions;
create trigger interventions_set_updated_at before update on interventions
  for each row execute function set_updated_at();

drop trigger if exists documents_set_updated_at on documents;
create trigger documents_set_updated_at before update on documents
  for each row execute function set_updated_at();

-- =====================================================================
-- RLS — désactivé (l'app utilise la service role key côté serveur uniquement)
-- =====================================================================
alter table clients              disable row level security;
alter table techniciens          disable row level security;
alter table interventions        disable row level security;
alter table documents            disable row level security;
alter table factures_fournisseurs disable row level security;

-- ---------- PART 1.5 : BACKFILL colonnes de base sur tables PRÉ-EXISTANTES ----------
-- (un CREATE TABLE IF NOT EXISTS n'ajoute PAS les colonnes manquantes à une table
--  déjà créée par l'ancienne app — d'où ce backfill explicite. C'est ce qui corrige
--  l'erreur « column interventions.reference does not exist ».)

alter table interventions
  add column if not exists reference text,
  add column if not exists client_id uuid,
  add column if not exists technicien_id uuid,
  add column if not exists agence text,
  add column if not exists type_intervention text,
  add column if not exists adresse_chantier text,
  add column if not exists ville text,
  add column if not exists code_postal text,
  add column if not exists date_prevue date,
  add column if not exists heure_prevue time,
  add column if not exists duree_estimee_min integer,
  add column if not exists date_realisee date,
  add column if not exists urgence boolean not null default false,
  add column if not exists statut text not null default 'planifiee',
  add column if not exists prix_prevu numeric,
  add column if not exists notes_internes text,
  add column if not exists transcription text,
  add column if not exists rapport_json jsonb,
  add column if not exists seo_json jsonb,
  add column if not exists photos_urls text[],
  add column if not exists pdf_rapport_url text,
  add column if not exists publie_slug text,
  add column if not exists canal_acquisition text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists interventions_reference_uniq on interventions (reference);

alter table clients
  add column if not exists nom text,
  add column if not exists email text,
  add column if not exists telephone text,
  add column if not exists adresse text,
  add column if not exists code_postal text,
  add column if not exists ville text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table techniciens
  add column if not exists nom text,
  add column if not exists email text,
  add column if not exists telephone text,
  add column if not exists agence text,
  add column if not exists actif boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

-- ---------- 001_compta_pro.sql ----------
-- =====================================================================
-- LTDB Compta Pro — Migration 001
-- Ajoute : clients pro (SIRET), comptes & opérations bancaires, lettrage
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent : peut être ré-exécutée sans danger.
-- =====================================================================

-- =====================================================================
-- 1. CLIENTS — extension pour distinguer particuliers / pros
-- =====================================================================
alter table clients add column if not exists type_client text
  default 'particulier';

-- Contrainte ajoutée séparément (alter add constraint n'a pas de "if not exists" partout)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_type_client_check'
  ) then
    alter table clients add constraint clients_type_client_check
      check (type_client in ('particulier','pro'));
  end if;
end $$;

alter table clients add column if not exists siret text;
alter table clients add column if not exists siren text;
alter table clients add column if not exists forme_juridique text;
alter table clients add column if not exists contact_nom text;
alter table clients add column if not exists naf_code text;
alter table clients add column if not exists naf_libelle text;
alter table clients add column if not exists etat_administratif text; -- 'A' actif, 'F' fermé

create index if not exists clients_siret_idx on clients (siret);
create index if not exists clients_siren_idx on clients (siren);
create index if not exists clients_type_idx  on clients (type_client);

-- =====================================================================
-- 2. COMPTES BANCAIRES
-- =====================================================================
create table if not exists comptes_bancaires (
  id uuid primary key default gen_random_uuid(),
  banque text not null,
  iban text,
  libelle text,
  agence text,
  solde_initial numeric not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists comptes_bancaires_actif_idx on comptes_bancaires (actif);

-- =====================================================================
-- 3. OPÉRATIONS BANCAIRES — relevés importés (CSV / OCR PDF)
-- =====================================================================
create table if not exists operations_bancaires (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references comptes_bancaires(id) on delete cascade,

  -- Données du relevé
  date_operation date not null,
  date_valeur date,
  libelle text not null,
  reference_brute text,                    -- ligne brute du relevé pour debug
  debit numeric not null default 0,
  credit numeric not null default 0,

  -- Lettrage / rapprochement
  lettre boolean not null default false,
  lettre_at timestamptz,
  document_id uuid references documents(id) on delete set null,
  facture_fournisseur_id uuid references factures_fournisseurs(id) on delete set null,

  -- Classification comptable
  categorie text,                          -- carburant, urssaf, telecom, etc.
  notes text,

  -- Provenance
  source_import text not null default 'manuel'
    check (source_import in ('csv','pdf_ocr','manuel','api')),
  import_batch_id uuid,                    -- regroupe les lignes d'un même import

  created_at timestamptz not null default now()
);
create index if not exists ops_bancaires_compte_idx   on operations_bancaires (compte_id);
create index if not exists ops_bancaires_date_idx     on operations_bancaires (date_operation);
create index if not exists ops_bancaires_lettre_idx   on operations_bancaires (lettre);
create index if not exists ops_bancaires_document_idx on operations_bancaires (document_id);
create index if not exists ops_bancaires_batch_idx    on operations_bancaires (import_batch_id);

-- Garde-fou : un débit XOR un crédit (jamais les deux non nuls)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'ops_bancaires_debit_xor_credit'
  ) then
    alter table operations_bancaires add constraint ops_bancaires_debit_xor_credit
      check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0) or (debit = 0 and credit = 0));
  end if;
end $$;

-- =====================================================================
-- 4. RLS désactivé (cohérent avec le schéma existant)
-- =====================================================================
alter table comptes_bancaires      disable row level security;
alter table operations_bancaires   disable row level security;

-- ---------- 002_video_generation.sql ----------
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

-- ---------- 003_mode_terrain.sql ----------
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

-- ---------- 004_intervention_pdfs.sql ----------
-- =====================================================================
-- Migration 004 — Bucket Storage pour les PDFs d'intervention pré-générés
-- =====================================================================
-- Stocke les PDFs rapport + facture générés à la fin du Mode Terrain,
-- avant l'envoi mail. Permet :
--   - body léger sur /api/notify-rapport-facture (plus de "Load failed")
--   - retry idempotent (PDFs déjà en place, on ne les régénère pas)
--   - téléchargement direct depuis l'historique
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('intervention-pdfs', 'intervention-pdfs', true)
on conflict (id) do nothing;

-- Note: les colonnes existent déjà
--   interventions.pdf_rapport_url (text)
--   documents.pdf_url             (text)
-- Pas de modif de schéma nécessaire ici.

-- ---------- 005_accord_intervention.sql ----------
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

-- ---------- 006_accord_copie_client.sql ----------
-- =====================================================================
-- LTDB — Migration 006 — Accord d'Intervention : suivi de la copie client
-- =====================================================================
-- Ajoute le suivi de l'envoi de la copie de l'accord au client par email.
-- À exécuter dans : Supabase Dashboard → SQL Editor. Idempotent.
-- =====================================================================

alter table accords_intervention
  add column if not exists copie_envoyee_at timestamptz;

comment on column accords_intervention.copie_envoyee_at is
  'Date d''envoi de la copie de l''accord au client par email (Resend). NULL = jamais envoyée.';

-- ---------- 007_terrain_step_devis.sql ----------
-- Étape « Devis optionnel » insérée entre Facture (4) et Diffusion (6→6, ancien 5→6, 6→7, 7→8)
alter table interventions drop constraint if exists interventions_terrain_step_chk;

alter table interventions
  add constraint interventions_terrain_step_chk
  check (terrain_step between 0 and 8);

-- Décale les interventions déjà en cours (diffusion / réseaux / terminé)
update interventions
set terrain_step = terrain_step + 1
where terrain_step >= 5;

comment on column interventions.terrain_step is
  '0=photo avant, 1=démarrer, 2=photo après, 3=rapport, 4=facture, 5=devis optionnel, 6=diffusion, 7=réseaux, 8=terminé';

