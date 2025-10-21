#!/bin/bash
# Script d'automatisation de la migration des statuts 'COMPLETED' vers 'READY' dans la table jobs

psql -U mac -d impression_platform -c "UPDATE jobs SET status = 'READY' WHERE status = 'COMPLETED';"

if [ $? -eq 0 ]; then
  echo "Migration terminée : tous les dossiers 'COMPLETED' sont maintenant en 'READY'."
else
  echo "Erreur lors de la migration. Vérifiez la connexion et les droits."
fi
