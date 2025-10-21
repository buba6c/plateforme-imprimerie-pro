-- 💰 Extension pour système de paiements et notifications
-- =====================================================

-- Modifier la table dossiers pour ajouter les champs de paiement
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS statut_paiement VARCHAR(20) DEFAULT 'non_paye' 
    CHECK (statut_paiement IN ('non_paye', 'paye', 'approuve_admin'));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_paiement_due DATE;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_paiement_reelle TIMESTAMP;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS statut_livraison VARCHAR(20) DEFAULT 'non_livre' 
    CHECK (statut_livraison IN ('non_livre', 'en_preparation_livraison', 'livre'));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS approuve_par_admin INTEGER REFERENCES users(id);
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_approbation_admin TIMESTAMP;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS notes_paiement TEXT;

-- 📋 Table pour suivre les paiements détaillés
CREATE TABLE IF NOT EXISTS paiements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
    montant DECIMAL(10,2) NOT NULL,
    statut VARCHAR(20) DEFAULT 'en_attente' 
        CHECK (statut IN ('en_attente', 'paye', 'echec', 'rembourse')),
    mode_paiement VARCHAR(50), -- CB, virement, especes, cheque
    reference_paiement VARCHAR(255), -- Numéro de transaction
    date_creation TIMESTAMP DEFAULT NOW(),
    date_paiement TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    approuve_par INTEGER REFERENCES users(id),
    date_approbation TIMESTAMP,
    commentaires TEXT
);

-- 🔔 Table pour les notifications et rappels
CREATE TABLE IF NOT EXISTS notifications_rappel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
    type_notification VARCHAR(30) NOT NULL 
        CHECK (type_notification IN ('rappel_paiement', 'rappel_livraison', 'approbation_requise')),
    destinataire_id INTEGER REFERENCES users(id), -- Préparateur concerné
    expediteur_id INTEGER REFERENCES users(id), -- Admin ou livreur qui envoie
    message TEXT,
    statut VARCHAR(20) DEFAULT 'envoye' 
        CHECK (statut IN ('envoye', 'lu', 'traite')),
    date_creation TIMESTAMP DEFAULT NOW(),
    date_lecture TIMESTAMP,
    priorite VARCHAR(10) DEFAULT 'normale' 
        CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente'))
);

-- 📊 Table pour historique des actions sur les paiements
CREATE TABLE IF NOT EXISTS historique_paiements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
    paiement_id UUID REFERENCES paiements(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'marque_paye', 'approuve_admin', 'rappel_envoye'
    ancien_statut VARCHAR(20),
    nouveau_statut VARCHAR(20),
    effectue_par INTEGER REFERENCES users(id),
    date_action TIMESTAMP DEFAULT NOW(),
    commentaires TEXT
);

-- 📈 Index pour performance
CREATE INDEX IF NOT EXISTS idx_dossiers_statut_paiement ON dossiers(statut_paiement);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut_livraison ON dossiers(statut_livraison);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements(statut);
CREATE INDEX IF NOT EXISTS idx_notifications_destinataire ON notifications_rappel(destinataire_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications_rappel(type_notification);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications_rappel(date_creation DESC);

-- 🎯 Trigger pour créer automatiquement un enregistrement de paiement
CREATE OR REPLACE FUNCTION create_paiement_on_dossier()
RETURNS TRIGGER AS $$
BEGIN
    -- Créer un paiement automatique si montant défini
    IF NEW.montant_paiement IS NOT NULL AND NEW.montant_paiement > 0 THEN
        INSERT INTO paiements (dossier_id, montant, created_by)
        VALUES (NEW.id, NEW.montant_paiement, NEW.created_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_paiement_trigger
    AFTER INSERT ON dossiers
    FOR EACH ROW EXECUTE FUNCTION create_paiement_on_dossier();

-- 🎯 Trigger pour log des changements de statut paiement
CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.statut_paiement IS DISTINCT FROM NEW.statut_paiement THEN
        INSERT INTO historique_paiements (dossier_id, action, ancien_statut, nouveau_statut, effectue_par)
        VALUES (NEW.id, 'changement_statut_paiement', OLD.statut_paiement, NEW.statut_paiement, NEW.created_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_payment_status_trigger
    AFTER UPDATE ON dossiers
    FOR EACH ROW EXECUTE FUNCTION log_payment_status_change();

-- 📋 Vues utiles pour les dashboards
CREATE OR REPLACE VIEW vue_dossiers_paiement AS
SELECT 
    d.id,
    d.numero_commande,
    d.client,
    d.statut,
    d.statut_paiement,
    d.statut_livraison,
    d.montant_paiement,
    d.date_paiement_due,
    d.created_by,
    d.created_at,
    u.prenom || ' ' || u.nom as preparateur_nom,
    u.email as preparateur_email,
    p.montant as montant_paiement_detail,
    p.statut as statut_paiement_detail,
    p.date_paiement,
    (SELECT COUNT(*) FROM notifications_rappel nr WHERE nr.dossier_id = d.id) as nb_rappels_envoyes
FROM dossiers d
LEFT JOIN users u ON d.created_by = u.id
LEFT JOIN paiements p ON p.dossier_id = d.id;

CREATE OR REPLACE VIEW vue_notifications_actives AS
SELECT 
    n.*,
    d.numero_commande,
    d.client,
    dest.prenom || ' ' || dest.nom as destinataire_nom,
    dest.email as destinataire_email,
    exp.prenom || ' ' || exp.nom as expediteur_nom
FROM notifications_rappel n
JOIN dossiers d ON n.dossier_id = d.id
JOIN users dest ON n.destinataire_id = dest.id
JOIN users exp ON n.expediteur_id = exp.id
WHERE n.statut IN ('envoye', 'lu')
ORDER BY n.date_creation DESC;

-- ✅ Données d'exemple
INSERT INTO notifications_rappel (dossier_id, type_notification, destinataire_id, expediteur_id, message, priorite)
SELECT 
    d.id, 
    'rappel_paiement', 
    d.created_by, 
    1, -- ID admin
    'Rappel : Le dossier ' || d.numero_commande || ' n''est pas encore payé.',
    'normale'
FROM dossiers d 
WHERE d.statut_paiement = 'non_paye' 
AND d.id IN (SELECT id FROM dossiers LIMIT 2);

SELECT 'Système de paiements et notifications installé avec succès!' as status;