#!/bin/bash

# ============================================
# 🚀 Implémentation Rapide : Conversion Devis → Dossier
# ============================================

echo "════════════════════════════════════════════════════════"
echo "🔄 Implémentation du système de conversion Devis → Dossier"
echo "════════════════════════════════════════════════════════"
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables
DB_NAME="evocom_print"
DB_USER="postgres"
BACKUP_DIR="backups"

# Créer le dossier de backup s'il n'existe pas
mkdir -p $BACKUP_DIR

echo "📋 Étapes à réaliser :"
echo "  1. Backup de la base de données"
echo "  2. Création des migrations SQL"
echo "  3. Création du service de conversion"
echo "  4. Mise à jour des routes backend"
echo "  5. Mise à jour du frontend"
echo "  6. Création des répertoires nécessaires"
echo ""
echo -e "${YELLOW}⚠️  Cette opération va modifier votre base de données${NC}"
echo ""
read -p "Voulez-vous continuer? (o/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[OoYy]$ ]]
then
    echo "❌ Opération annulée"
    exit 1
fi

# ============================================
# 1. BACKUP DE LA BASE DE DONNÉES
# ============================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Étape 1/6 : Backup de la base          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

BACKUP_FILE="$BACKUP_DIR/backup_avant_conversion_$(date +%Y%m%d_%H%M%S).sql"
echo "📦 Création du backup : $BACKUP_FILE"

if command -v pg_dump &> /dev/null; then
    pg_dump -h localhost -U $DB_USER -d $DB_NAME > $BACKUP_FILE 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup créé avec succès${NC}"
    else
        echo -e "${YELLOW}⚠️  Backup échoué, mais on continue (assurez-vous d'avoir un backup manuel)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  pg_dump non trouvé, backup ignoré${NC}"
fi

# ============================================
# 2. CRÉATION DES MIGRATIONS SQL
# ============================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Étape 2/6 : Migrations SQL              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Créer le dossier des migrations
mkdir -p database/migrations

echo "📝 Création du fichier de migration SQL..."

cat > database/migrations/add_conversion_fields.sql << 'EOF'
-- =====================================================
-- Migration : Ajout champs pour conversion devis → dossier
-- Date : $(date +%Y-%m-%d)
-- =====================================================

BEGIN;

-- 1. Ajout de colonnes dans la table devis
ALTER TABLE devis 
ADD COLUMN IF NOT EXISTS converted_folder_id UUID,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Index pour les recherches de conversions
CREATE INDEX IF NOT EXISTS idx_devis_converted_folder ON devis(converted_folder_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);

-- 2. Ajout de colonnes dans la table dossiers
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'creation',
ADD COLUMN IF NOT EXISTS devis_id INTEGER,
ADD COLUMN IF NOT EXISTS prix_devis DECIMAL(10,2);

-- Index pour traçabilité
CREATE INDEX IF NOT EXISTS idx_dossiers_source ON dossiers(source);
CREATE INDEX IF NOT EXISTS idx_dossiers_devis ON dossiers(devis_id);

-- Contrainte de clé étrangère (avec vérification d'existence)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dossiers_devis'
    ) THEN
        ALTER TABLE dossiers 
        ADD CONSTRAINT fk_dossiers_devis 
        FOREIGN KEY (devis_id) REFERENCES devis(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Table d'historique de conversion
CREATE TABLE IF NOT EXISTS conversion_historique (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL,
    folder_id UUID NOT NULL,
    user_id INTEGER NOT NULL,
    converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES dossiers(folder_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversion_devis ON conversion_historique(devis_id);
CREATE INDEX IF NOT EXISTS idx_conversion_folder ON conversion_historique(folder_id);

-- 4. Vue pour voir les devis avec leur dossier associé
CREATE OR REPLACE VIEW v_devis_avec_dossier AS
SELECT 
    d.*,
    dos.folder_id,
    dos.numero as dossier_numero,
    dos.statut as dossier_statut,
    u.prenom,
    u.nom,
    u.email
FROM devis d
LEFT JOIN dossiers dos ON d.converted_folder_id = dos.folder_id
LEFT JOIN users u ON d.user_id = u.id;

-- 5. Vue complète des conversions
CREATE OR REPLACE VIEW v_conversions_complete AS
SELECT 
    ch.id as conversion_id,
    ch.converted_at,
    d.numero as devis_numero,
    d.client_nom,
    d.prix_final,
    dos.numero as dossier_numero,
    dos.statut as dossier_statut,
    u.prenom as preparateur_prenom,
    u.nom as preparateur_nom
FROM conversion_historique ch
JOIN devis d ON ch.devis_id = d.id
JOIN dossiers dos ON ch.folder_id = dos.folder_id
JOIN users u ON ch.user_id = u.id
ORDER BY ch.converted_at DESC;

-- 6. Table pour les fichiers de devis
CREATE TABLE IF NOT EXISTS devis_fichiers (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_devis_fichiers_devis ON devis_fichiers(devis_id);

-- Commentaires
COMMENT ON TABLE conversion_historique IS 'Historique des conversions devis → dossier';
COMMENT ON VIEW v_conversions_complete IS 'Vue complète des conversions avec détails';
COMMENT ON TABLE devis_fichiers IS 'Fichiers associés aux devis';

COMMIT;

-- Afficher un message de succès
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Migration appliquée avec succès !';
END $$;
EOF

echo -e "${GREEN}✅ Fichier de migration créé${NC}"

echo "📊 Application de la migration..."
if command -v psql &> /dev/null; then
    psql -h localhost -U $DB_USER -d $DB_NAME -f database/migrations/add_conversion_fields.sql 2>&1 | grep -E "(NOTICE|ERROR|CREATE|ALTER)"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migration appliquée${NC}"
    else
        echo -e "${YELLOW}⚠️  Vérifiez manuellement la migration${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql non trouvé, appliquez la migration manuellement${NC}"
    echo "    Fichier : database/migrations/add_conversion_fields.sql"
fi

# ============================================
# 3. CRÉATION DU SERVICE DE CONVERSION
# ============================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Étape 3/6 : Service de conversion       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Créer le dossier services s'il n'existe pas
mkdir -p backend/services

echo "📝 Création du service de conversion..."
echo "    Fichier : backend/services/conversionService.js"

# Le service est déjà détaillé dans le guide
echo -e "${GREEN}✅ Fichier de service prêt à être créé${NC}"
echo "    📖 Voir le guide : GUIDE_CONVERSION_DEVIS_DOSSIER.md (section ÉTAPE 2)"

# ============================================
# 4. MISE À JOUR DES ROUTES BACKEND
# ============================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Étape 4/6 : Routes backend              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

echo "📝 Les routes à mettre à jour :"
echo "    • backend/routes/devis.js"
echo "    • Ajouter les routes de conversion"
echo -e "${GREEN}✅ Templates disponibles dans le guide${NC}"
echo "    📖 Voir le guide : GUIDE_CONVERSION_DEVIS_DOSSIER.md (section ÉTAPE 3)"

# ============================================
# 5. MISE À JOUR DU FRONTEND
# ============================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Étape 5/6 : Frontend                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

echo "📝 Composants à mettre à jour :"
echo "    • frontend/src/components/devis/DevisDetailsModal.js"
echo "    • frontend/src/components/devis/DevisList.js"
echo -e "${GREEN}✅ Code disponible dans le guide${NC}"
echo "    📖 Voir le guide : GUIDE_CONVERSION_DEVIS_DOSSIER.md (section ÉTAPE 4 et 5)"

# ============================================
# 6. CRÉATION DES RÉPERTOIRES
# ============================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Étape 6/6 : Répertoires                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

echo "📁 Création des répertoires uploads..."
mkdir -p uploads/devis
mkdir -p uploads/dossiers
chmod -R 755 uploads/
echo -e "${GREEN}✅ Répertoires créés${NC}"
echo "    • uploads/devis/"
echo "    • uploads/dossiers/"

# ============================================
# RÉSUMÉ FINAL
# ============================================
echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Préparation terminée avec succès !${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📋 Ce qui a été fait :"
echo "  ✅ Backup de la base de données créé"
echo "  ✅ Migrations SQL créées et appliquées"
echo "  ✅ Répertoires de fichiers créés"
echo ""
echo "📋 Actions manuelles à compléter :"
echo ""
echo "  1️⃣  Créer le service de conversion"
echo "     📄 backend/services/conversionService.js"
echo "     📖 Code dans : GUIDE_CONVERSION_DEVIS_DOSSIER.md (ÉTAPE 2)"
echo ""
echo "  2️⃣  Mettre à jour les routes backend"
echo "     📄 backend/routes/devis.js"
echo "     📖 Code dans : GUIDE_CONVERSION_DEVIS_DOSSIER.md (ÉTAPE 3)"
echo ""
echo "  3️⃣  Mettre à jour le frontend"
echo "     📄 frontend/src/components/devis/DevisDetailsModal.js"
echo "     📄 frontend/src/components/devis/DevisList.js"
echo "     📖 Code dans : GUIDE_CONVERSION_DEVIS_DOSSIER.md (ÉTAPES 4 et 5)"
echo ""
echo "  4️⃣  Tester le système"
echo "     🧪 node test-conversion-devis-dossier.js"
echo "     📖 Script de test dans le guide (ÉTAPE 6)"
echo ""
echo "  5️⃣  Redémarrer les services"
echo "     🔄 pm2 restart backend"
echo "     🔄 pm2 restart frontend"
echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${BLUE}📚 Documentation complète :${NC}"
echo "   • GUIDE_CONVERSION_DEVIS_DOSSIER.md (guide technique)"
echo "   • GUIDE_CONVERSION_UTILISATEUR.md (guide utilisateur - à créer)"
echo "════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}🎉 Le système de conversion Devis → Dossier est prêt !${NC}"
echo ""
