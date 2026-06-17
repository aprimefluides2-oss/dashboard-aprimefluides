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
