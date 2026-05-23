-- Migration 009 - adiciona patch_version em champion_guides

alter table champion_guides
  add column if not exists patch_version varchar(10);
