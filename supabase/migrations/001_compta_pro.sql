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
