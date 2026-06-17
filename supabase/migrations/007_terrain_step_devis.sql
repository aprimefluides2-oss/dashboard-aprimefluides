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
