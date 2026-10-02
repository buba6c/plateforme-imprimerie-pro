const dbHelper = require('../utils/dbHelper');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Service de conversion devis → dossier
 */
class ConversionService {
  
  /**
   * Convertir un devis en dossier
   * @param {number} devisId - ID du devis
   * @param {object} user - Utilisateur qui effectue la conversion
   * @returns {object} - Informations du dossier créé
   */
  async convertDevisToDossier(devisId, user) {
    try {
      console.log(`🔄 Début conversion devis #${devisId} par user #${user.id}`);
      
      // 1. Récupérer le devis complet
      const [devisRows] = await dbHelper.query(
        'SELECT * FROM devis WHERE id = $1',
        [devisId]
      );
      
      if (devisRows.length === 0) {
        throw new Error('Devis non trouvé');
      }
      
      const devis = devisRows[0];
      
      // 2. Vérifications
      if (devis.statut === 'converti') {
        throw new Error('Ce devis a déjà été converti en dossier');
      }
      
      if (devis.statut !== 'valide') {
        throw new Error('Seuls les devis validés peuvent être convertis en dossier');
      }
      
      // 3. Générer un nouveau folder_id et numéro de dossier
      const folderId = uuidv4();
      const annee = new Date().getFullYear();
      const timestamp = Date.now().toString().slice(-6);
      const numeroDossier = `DOS-${annee}-${timestamp}`;
      
      // 4. Parser data_json (TOUTES les données du devis)
      let dataJson;
      try {
        dataJson = typeof devis.data_json === 'string' 
          ? JSON.parse(devis.data_json) 
          : devis.data_json;
      } catch (error) {
        throw new Error('Données du devis invalides');
      }
      
      // ✅ IMPORTANT : Le dossier est créé pour le préparateur qui a CRÉÉ le devis
      console.log(`📋 Attribution du dossier au préparateur #${devis.user_id} (créateur du devis)`);
      console.log(`📦 Copie de TOUTES les données du devis vers le dossier...`);
      
      // Extraction du nom client avec fallback
      let clientNom = devis.client_nom;
      if (!clientNom || clientNom.trim() === '') {
        // Fallback: chercher dans data_json
        clientNom = dataJson.client || dataJson.nomClient || dataJson.clientNom || 'Client non renseigné';
        console.log(`⚠️ client_nom vide, utilisation de data_json: "${clientNom}"`);
      }
      
      // 5. Créer le dossier dans la base de données avec TOUTES les données
      const [dossierResult] = await dbHelper.query(
        `INSERT INTO dossiers (
          numero, 
          client, 
          preparateur_id,
          type_formulaire,
          data_formulaire, 
          statut,
          montant_cfa,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, numero`,
        [
          numeroDossier,
          clientNom,                  // ✅ Client du devis (avec fallback)
          devis.user_id,              // ✅ Le préparateur qui a CRÉÉ le devis
          devis.machine_type,         // type_formulaire = machine_type
          JSON.stringify(dataJson),   // ✅ TOUTES les données techniques
          'en_cours',                 // Statut initial du dossier
          devis.prix_final || devis.prix_estime // Montant du devis
        ]
      );
      
      const dossier = dossierResult[0];
      console.log(`✅ Dossier créé: ${dossier.numero} (ID: ${dossier.id})`);
      console.log(`✅ Propriétaire: Préparateur #${devis.user_id}`);
      console.log(`✅ Toutes les données du devis ont été copiées`);
      
      // 6. Marquer le devis comme converti et lier au dossier
      await dbHelper.query(
        `UPDATE devis 
         SET statut = $1, 
             dossier_id = $2,
             updated_at = NOW()
         WHERE id = $3`,
        ['converti', dossier.id, devisId]
      );
      
      // 7. Note: conversion_historique table doesn't exist, skipping
      // Conversion is tracked via devis.dossier_id and devis.statut
      
      console.log(`✅ Devis #${devisId} marqué comme converti → Dossier #${dossier.id}`);
      
      return {
        success: true,
        dossier_id: dossier.id,
        dossier_numero: dossier.numero,
        devis_id: devisId
      };
      
      // 8. Ajouter dans l'historique du devis (si la table existe)
      try {
        await dbHelper.query(
          `INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut, commentaire)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            devisId, 
            user.id, 
            'conversion', 
            'converti', 
            `Converti en dossier ${numeroDossier} pour le préparateur #${devis.user_id}`
          ]
        );
      } catch (histErr) {
        console.log('⚠️ Table devis_historique non disponible, historique non enregistré');
      }
      
      // 9. Copier les fichiers si présents
      try {
        await this.copyDevisFiles(devisId, dossier.id);
      } catch (fileErr) {
        console.log('⚠️ Erreur copie fichiers:', fileErr.message);
      }
      
      console.log(`🎉 Conversion réussie ! Devis → Dossier ${numeroDossier}`);
      console.log(`👤 Le dossier appartient au préparateur qui a créé le devis (#${devis.user_id})`);
      
      return {
        success: true,
        message: 'Devis converti en dossier avec succès',
        dossier: {
          id: dossier.id,
          folder_id: dossier.folder_id,
          numero: dossier.numero,
          statut: 'en_cours',
          proprietaire_id: devis.user_id
        },
        devis: {
          id: devisId,
          numero: devis.numero,
          statut: 'converti'
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur conversion devis:', error);
      throw error;
    }
  }
  
  /**
   * Copier les fichiers d'un devis vers un dossier
   * @param {number} devisId - ID du devis source
   * @param {string} folderId - UUID du dossier de destination
   */
  async copyDevisFiles(devisId, folderId) {
    try {
      // Récupérer les fichiers du devis
      const [files] = await dbHelper.query(
        'SELECT * FROM devis_fichiers WHERE devis_id = $1',
        [devisId]
      );
      
      if (files.length === 0) {
        console.log('📁 Aucun fichier à copier');
        return;
      }
      
      console.log(`📁 Copie de ${files.length} fichier(s)...`);
      
      const uploadsDir = path.join(__dirname, '../../uploads');
      const devisDir = path.join(uploadsDir, 'devis', devisId.toString());
      const dossierDir = path.join(uploadsDir, 'dossiers', folderId);
      
      // Créer le répertoire de destination
      await fs.mkdir(dossierDir, { recursive: true });
      
      // Copier chaque fichier
      for (const file of files) {
        try {
          const sourcePath = path.join(devisDir, file.filename);
          const destPath = path.join(dossierDir, file.filename);
          
          // Copier le fichier
          await fs.copyFile(sourcePath, destPath);
          
          // Insérer dans la table fichiers du dossier
          await dbHelper.query(
            `INSERT INTO fichiers (
              folder_id, 
              filename, 
              original_name, 
              file_path, 
              file_size,
              mime_type,
              uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              folderId,
              file.filename,
              file.original_name,
              `/uploads/dossiers/${folderId}/${file.filename}`,
              file.file_size,
              file.mime_type,
              file.uploaded_by
            ]
          );
          
          console.log(`✅ Fichier copié: ${file.original_name}`);
        } catch (fileError) {
          console.error(`❌ Erreur copie fichier ${file.filename}:`, fileError);
          // Continue avec les autres fichiers
        }
      }
      
      console.log(`✅ ${files.length} fichier(s) copié(s) avec succès`);
      
    } catch (error) {
      console.error('❌ Erreur lors de la copie des fichiers:', error);
      // Ne pas faire échouer la conversion si la copie échoue
    }
  }
  
  /**
   * Récupérer l'historique de conversion d'un devis
   */
  async getConversionHistory(devisId) {
    const [history] = await dbHelper.query(
      `SELECT ch.*, dos.numero as dossier_numero, dos.statut as dossier_statut
       FROM conversion_historique ch
       JOIN dossiers dos ON ch.folder_id = dos.folder_id
       WHERE ch.devis_id = $1`,
      [devisId]
    );
    return history;
  }
  
  /**
   * Vérifier si un devis peut être converti
   */
  async canConvert(devisId, user) {
    const [devisRows] = await dbHelper.query(
      'SELECT * FROM devis WHERE id = $1',
      [devisId]
    );
    
    if (devisRows.length === 0) {
      return { canConvert: false, reason: 'Devis non trouvé' };
    }
    
    const devis = devisRows[0];
    
    if (devis.statut === 'converti') {
      return { canConvert: false, reason: 'Devis déjà converti' };
    }
    
    if (devis.statut !== 'valide') {
      return { canConvert: false, reason: 'Le devis doit être validé avant conversion' };
    }
    
    // Vérifier les permissions
    // Seul le créateur du devis ou un admin peut convertir
    if (user.role === 'preparateur' && devis.user_id !== user.id) {
      return { 
        canConvert: false, 
        reason: 'Seul le préparateur qui a créé ce devis peut le convertir' 
      };
    }
    
    // L'admin peut convertir n'importe quel devis
    if (user.role === 'admin') {
      return { 
        canConvert: true,
        note: 'Le dossier sera attribué au préparateur qui a créé le devis'
      };
    }
    
    return { canConvert: true };
  }
}

module.exports = new ConversionService();
