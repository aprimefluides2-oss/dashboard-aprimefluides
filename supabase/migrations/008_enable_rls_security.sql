-- 008_enable_rls_security.sql
-- =====================================================================
-- SÉCURITÉ — Active la Row Level Security (RLS) sur TOUTES les tables du
-- schéma public (corrige les alertes Supabase « rls_desactive_en_public »
-- et « colonnes_sensibles_exposees », notamment sur social_tokens).
--
-- POURQUOI C'EST SANS RISQUE POUR L'APP :
-- Le dashboard accède à Supabase EXCLUSIVEMENT côté serveur avec la
-- service_role key (cf. lib/supabase.ts). La service_role a l'attribut
-- BYPASSRLS → elle ignore la RLS. Activer la RLS ne change donc RIEN au
-- fonctionnement de l'app ; elle bloque uniquement l'API publique
-- (rôles anon / authenticated), qui n'est pas utilisée ici.
--
-- => Aucune policy anon/authenticated n'est créée : accès public = refusé.
-- Idempotent (ENABLE ROW LEVEL SECURITY est sans effet si déjà activée).
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- Durcissement complémentaire sur la table la plus sensible (jetons OAuth) :
-- on retire aussi les privilèges des rôles publics, en plus de la RLS.
revoke all on table public.social_tokens from anon, authenticated;
