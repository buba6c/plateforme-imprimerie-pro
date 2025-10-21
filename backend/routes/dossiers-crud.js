// 🏗️ ROUTES DOSSIERS - PARTIE 2 : CRUD et Actions
// =================================================

// Cette partie s'ajoute au fichier dossiers-new.js après les routes GET

// Logger serveur (n'utilise console qu'en développement)
const serverLog = (level, ...args) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console[level](...args);
  }
};

// 🆕 POST /dossiers - Créer un nouveau dossier (Préparateur uniquement)
router.post('/', auth, checkRole(['preparateur']), async (req, res) => {
  try {
    // Log complet des données reçues pour debug
    serverLog('log', '[POST /dossiers] Données reçues:', JSON.stringify(req.body));

    // Support du format frontend : type_formulaire, data_formulaire
    let client = req.body.client;
    let type_formulaire = req.body.type_formulaire;
    let description = req.body.description || '';
    let quantite = req.body.quantite || 1;
    let client_email = req.body.client_email || '';
    let client_telephone = req.body.client_telephone || '';
    let date_livraison = req.body.date_livraison_prevue || null;
    let commentaire = req.body.commentaire || '';
    let montant_cfa = req.body.montant_cfa || null;
    let mode_paiement = req.body.mode_paiement || null;
    let data_formulaire = req.body.data_formulaire || {};

    // Si le frontend envoie le format moderne
    if (req.body.data_formulaire) {
      const data = req.body.data_formulaire;
      client = data.client || client;
      type_formulaire = req.body.type_formulaire || type_formulaire;
      description = data.description || description;
      quantite = data.quantite || quantite;
      client_email = data.client_email || client_email;
      client_telephone = data.client_telephone || client_telephone;
      date_livraison = data.date_livraison_prevue || date_livraison;
      commentaire = data.commentaire || commentaire;
      montant_cfa = data.montant_cfa || montant_cfa;
      mode_paiement = data.mode_paiement || mode_paiement;
    }

    // Validation des données obligatoires
    if (!client || !type_formulaire) {
      return res.status(400).json({
        success: false,
        message: 'Client et type_formulaire sont obligatoires',
      });
    }

    if (!['roland', 'xerox'].includes(type_formulaire.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'type_formulaire doit être roland ou xerox',
      });
    }

    // Génération du numéro unique
    const numero = await generateNumeroCommande();

    // Création du dossier avec preparateur_id
    const dossierQuery = `
      INSERT INTO dossiers (
        numero, client, type_formulaire, statut, preparateur_id, data_formulaire, commentaire, quantite, date_livraison, mode_paiement, montant_cfa
      ) VALUES ($1, $2, $3, 'en_cours', $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      numero,
      client,
      type_formulaire,
      req.user.id,
      data_formulaire,
      commentaire,
      quantite,
      date_livraison,
      mode_paiement,
      montant_cfa,
    ];
    const result = await db.query(dossierQuery, values);
    const dossier = result.rows[0];

    // Créer le répertoire pour les fichiers
    const uploadPath = path.join(__dirname, '../../uploads', String(dossier.id));
    await fs.mkdir(uploadPath, { recursive: true });

    // Émettre l'événement Socket.IO pour notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_created', {
        dossier: dossier,
        created_by: req.user.nom,
        message: `Nouveau dossier ${numero} créé par ${req.user.nom}`,
      });
    }

    res.status(201).json({
      success: true,
      message: `Dossier ${numero} créé avec succès`,
      dossier: dossier,
    });
  } catch (error) {
  serverLog('error', 'Erreur POST /dossiers:', error);

    if (error.constraint === 'dossiers_numero_commande_key') {
      return res.status(400).json({
        success: false,
        message: 'Numéro de commande déjà existant',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du dossier',
      error: error.message,
    });
  }
});

// ✏️ PUT /dossiers/:id - Modifier un dossier
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      client,
      machine,
      description,
      quantite,
      client_email,
      client_telephone,
      date_livraison_prevue,
      commentaires,
    } = req.body;

    // Vérifier que le dossier existe et que l'utilisateur y a accès
    const checkQuery = filterDossiersByRole(
      req.user,
      `
      SELECT * FROM dossiers WHERE id = $1
    `
    );

    const checkParams = [id];
    if (req.user.role === 'preparateur') {
      checkParams.push(req.user.id);
    }

    const checkResult = await db.query(checkQuery, checkParams);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    const dossier = checkResult.rows[0];

    // Vérification des droits de modification
    const canModify =
      req.user.role === 'admin' ||
      (req.user.role === 'preparateur' &&
        dossier.created_by === req.user.id &&
        !dossier.valide_preparateur) ||
      (req.user.role === 'preparateur' && dossier.statut === 'À revoir');

    if (!canModify) {
      return res.status(403).json({
        success: false,
        message:
          "Modification non autorisée. Le dossier est validé ou vous n'en êtes pas le créateur.",
      });
    }

    // Construction dynamique de la requête UPDATE
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (client !== undefined) {
      updates.push(`client = $${paramIndex++}`);
      values.push(client);
    }

    if (machine !== undefined && ['Roland', 'Xerox'].includes(machine)) {
      updates.push(`machine = $${paramIndex++}`);
      values.push(machine);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (quantite !== undefined) {
      updates.push(`quantite = $${paramIndex++}`);
      values.push(parseInt(quantite));
    }

    if (client_email !== undefined) {
      updates.push(`client_email = $${paramIndex++}`);
      values.push(client_email);
    }

    if (client_telephone !== undefined) {
      updates.push(`client_telephone = $${paramIndex++}`);
      values.push(client_telephone);
    }

    if (date_livraison_prevue !== undefined) {
      updates.push(`date_livraison_prevue = $${paramIndex++}`);
      values.push(date_livraison_prevue);
    }

    if (commentaires !== undefined) {
      updates.push(`commentaires = $${paramIndex++}`);
      values.push(commentaires);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à modifier',
      });
    }

    values.push(id); // Pour WHERE id = $last

    const updateQuery = `
      UPDATE dossiers 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedDossier = result.rows[0];

    // Notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_updated', {
        dossier: updatedDossier,
        updated_by: req.user.nom,
        message: `Dossier ${updatedDossier.numero_commande} modifié`,
      });
    }

    res.json({
      success: true,
      message: 'Dossier modifié avec succès',
      dossier: updatedDossier,
    });
  } catch (error) {
  serverLog('error', 'Erreur PUT /dossiers/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du dossier',
      error: error.message,
    });
  }
});

// 🔄 PUT /dossiers/:id/statut - Changer le statut d'un dossier
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nouveau_statut, commentaire = null } = req.body;

    // Normalisation des statuts pour tolérer variantes (accents, casse, '_' vs ' ')
    const normalizeStat = s => (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9_ ]/g, '');

    const allowedNormalized = new Set([
      'en_cours',
      'a_revoir',
      'en_impression',
      'termine',
      'livre',
      'pret_livraison',
      'en_livraison',
      'imprime'
    ]);

    if (!allowedNormalized.has(normalizeStat(nouveau_statut))) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Autorisés: ${Array.from(allowedNormalized).join(', ')}`,
      });
    }

    // Vérifier l'accès au dossier dans la table jobs
    const checkQuery = `SELECT * FROM jobs WHERE id = $1`;
    const checkParams = [id];
    let checkResult = await db.query(checkQuery, checkParams);
    let dossier = checkResult.rows[0];
    // Si le dossier n'existe pas, le créer à partir des infos minimales (toujours, si id ou jobNumber fourni)
    if (!dossier) {
      // Utiliser id comme jobNumber si jobNumber non fourni
      const jobNumber = req.body.jobNumber || id;
      const statusToSet = req.body.nouveau_statut || req.body.status || 'pret_livraison';
      const insertQuery = `INSERT INTO jobs (jobNumber, status, createdById) VALUES ($1, $2, $3) RETURNING *`;
      const insertValues = [jobNumber, statusToSet, req.user.id];
      const insertResult = await db.query(insertQuery, insertValues);
      dossier = insertResult.rows[0];
    }

  // Note: normalizeStat is already defined above for initial validation; reuse it here

    // Vérification des droits de changement de statut selon le rôle
    const canChangeStatus = () => {
      switch (req.user.role) {
        case 'admin':
          return true; // Admin peut tout changer

        case 'preparateur':
          // Préparateur peut seulement remettre "En cours" si "À revoir"
          return (
            dossier.created_by === req.user.id &&
            normalizeStat(dossier.statut) === 'a_revoir' &&
            normalizeStat(nouveau_statut) === 'en_cours'
          );

        case 'imprimeur_roland':
        case 'imprimeur_xerox':
          // Imprimeurs peuvent changer:
          // En cours → À revoir/En impression
          // En impression → Prêt livraison/À revoir/En livraison/Imprimé
          const transitionsRaw = {
            'En cours': ['À revoir', 'En impression'],
            'En impression': ['Prêt livraison', 'À revoir', 'En livraison', 'Imprimé', 'imprime', 'en_livraison'],
          };
          // Construire une version normalisée
          const validTransitions = {};
          for (const k of Object.keys(transitionsRaw)) {
            validTransitions[normalizeStat(k)] = transitionsRaw[k].map(v => normalizeStat(v));
          }
          return validTransitions[normalizeStat(dossier.statut)]?.includes(normalizeStat(nouveau_statut));

        case 'livreur':
          // Livreur peut marquer comme Livré quand le dossier est prêt pour livraison
          const prevNorm = normalizeStat(dossier.statut);
          const allowedPrev = ['termine', 'imprime', 'pret_livraison'];
          return allowedPrev.includes(prevNorm) && normalizeStat(nouveau_statut) === 'livre';

        default:
          return false;
      }
    };

    if (!canChangeStatus()) {
      return res.status(403).json({
        success: false,
        message: `Changement de statut non autorisé. Statut actuel: ${dossier.statut}, Votre rôle: ${req.user.role}`,
      });
    }

    // Mise à jour du statut dans jobs
    const updateQuery = `
      UPDATE jobs 
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(updateQuery, [nouveau_statut, id]);
    const updatedDossier = result.rows[0];

    // Enregistrement dans l'historique (automatique via trigger)
    // Mais on peut ajouter le commentaire manuellement
    if (commentaire) {
      await db.query(
        `
        UPDATE dossier_status_history 
        SET commentaire = $1 
        WHERE dossier_id = $2 AND nouveau_statut = $3 AND commentaire IS NULL
        ORDER BY changed_at DESC LIMIT 1
      `,
        [commentaire, id, nouveau_statut]
      );
    }

  // 💰 GÉNÉRATION AUTOMATIQUE DE FACTURE LORS DE LA LIVRAISON
  // Use normalized comparisons to tolerate variants/accents
  if (normalizeStat(nouveau_statut) === 'livre' && ['termine', 'pret_livraison', 'imprime'].includes(normalizeStat(dossier.statut))) {
      try {
        // Vérifier qu'une facture n'existe pas déjà
        const existingInvoice = await db.query(
          'SELECT id FROM factures WHERE dossier_id = $1', 
          [updatedDossier.folder_id || updatedDossier.id]
        );

        if (existingInvoice.rows.length === 0) {
          // Générer automatiquement la facture
          const axios = require('axios');
          const API_URL = process.env.API_URL || 'http://localhost:5001/api';
          
          // Préparer les données de la facture depuis le dossier
          const factureData = {
            dossier_id: updatedDossier.folder_id || updatedDossier.id,
            mode_paiement: req.body.mode_paiement || 'especes',
            client_nom: updatedDossier.client || updatedDossier.nom_client || 'Client',
            client_contact: updatedDossier.telephone || updatedDossier.email || '',
            montant_ttc: req.body.montant_cfa || updatedDossier.montant_prevu || 0
          };

          // Appel interne à l'API de génération de facture
          const token = req.headers.authorization;
          await axios.post(`${API_URL}/factures/generate`, factureData, {
            headers: { Authorization: token }
          });

          serverLog('log', `✅ Facture générée automatiquement pour le dossier ${updatedDossier.numero_commande}`);
        }
      } catch (factureError) {
  serverLog('error', '⚠️ Erreur génération automatique de facture:', factureError.message);
        // Ne pas bloquer le changement de statut si la facture échoue
      }
    }

    // Notification temps réel à tous les utilisateurs concernés
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_status_changed', {
        dossier: updatedDossier,
        ancien_statut: dossier.statut,
        nouveau_statut: nouveau_statut,
        changed_by: req.user.nom,
        commentaire: commentaire,
        message: `Statut du dossier ${updatedDossier.numero_commande} changé: ${dossier.statut} → ${nouveau_statut}`,
      });
    }

    res.json({
      success: true,
      message: `Statut changé: ${dossier.statut} → ${nouveau_statut}`,
      dossier: updatedDossier,
    });
  } catch (error) {
  serverLog('error', 'Erreur PUT /dossiers/:id/statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut',
      error: error.message,
    });
  }
});

// ✅ PUT /dossiers/:id/valider - Valider un dossier (Préparateur)
router.put('/:id/valider', auth, checkRole(['preparateur']), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que c'est bien le créateur du dossier
    const checkQuery = `
      SELECT * FROM dossiers 
      WHERE id = $1 AND created_by = $2 AND valide_preparateur = false
    `;

    const checkResult = await db.query(checkQuery, [id, req.user.id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ce dossier ne peut pas être validé : il n'existe pas, est déjà validé, ou vous n'en êtes pas le créateur"
      });
    }

    // Vérifier qu'il y a au moins un fichier
    const filesCheck = await db.query('SELECT COUNT(*) FROM fichiers WHERE dossier_id = $1', [id]);
    const nbFichiers = parseInt(filesCheck.rows[0].count);

    if (nbFichiers === 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de valider un dossier sans fichiers',
      });
    }

    // Valider le dossier
    const updateQuery = `
      UPDATE dossiers 
      SET valide_preparateur = true, date_validation_preparateur = NOW() 
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);
    const dossier = result.rows[0];

    // Notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_validated', {
        dossier: dossier,
        validated_by: req.user.nom,
        message: `Dossier ${dossier.numero_commande} validé et prêt pour impression`,
      });
    }

    res.json({
      success: true,
      message:
        'Dossier validé avec succès. Il est maintenant verrouillé et visible par les imprimeurs.',
      dossier: dossier,
    });
  } catch (error) {
  serverLog('error', 'Erreur PUT /dossiers/:id/valider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation du dossier',
      error: error.message,
    });
  }
});

module.exports = router;
