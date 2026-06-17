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
