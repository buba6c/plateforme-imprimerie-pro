-- Journal d'usage de l'assistant IA : nouveau type « imposition » (proposition de plan d'imposition).
ALTER TABLE ia_usage DROP CONSTRAINT IF EXISTS ia_usage_type_check;
ALTER TABLE ia_usage ADD CONSTRAINT ia_usage_type_check CHECK (type IN ('suggestion', 'test', 'imposition'));
