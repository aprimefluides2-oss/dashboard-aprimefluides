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
