-- FilmDeck migrations — safe to re-run
-- All ALTER TABLE statements are wrapped so existing columns are skipped

-- v1: project metadata columns
ALTER TABLE projects ADD COLUMN director TEXT NOT NULL DEFAULT '' ;
ALTER TABLE projects ADD COLUMN writer TEXT NOT NULL DEFAULT '' ;
ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'Development' ;
ALTER TABLE projects ADD COLUMN format TEXT NOT NULL DEFAULT 'Short Film' ;
ALTER TABLE projects ADD COLUMN logline TEXT NOT NULL DEFAULT '' ;
ALTER TABLE projects ADD COLUMN quotation_data TEXT ;
ALTER TABLE projects ADD COLUMN budget_data TEXT ;
ALTER TABLE projects ADD COLUMN print_records TEXT ;

-- v2: module data columns
ALTER TABLE projects ADD COLUMN moodboard_data TEXT ;
ALTER TABLE projects ADD COLUMN todo_data TEXT ;

-- v3: app-wide settings (admin-managed key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
