// Démonstration hors ligne d'Evocom Print : l'interface réelle avec une API simulée dans le navigateur,
// activée seulement par `import.meta.env.MODE === 'demo'` (voir main.tsx), absente du build normal.
//
// Régénérer (API de démonstration et interface de développement lancées, voir v2/README.md) :
//   BASE=http://localhost:5173 node src/demo/outils/enregistrer.mjs    réponses de l'API → src/demo/donnees/
//   API=http://127.0.0.1:4000 npx tsx src/demo/outils/comparer.ts      (facultatif) domaine simulé = API réelle
//   npm run build:demo                                                 → dist-demo/
//   node src/demo/outils/verifier.mjs [dossier-captures]               page statique, réseau bloqué
//
// Domaine en mémoire (domaine/) : circuit des dossiers, paiements, notifications, statistiques,
// livraisons, clients, tarifs, paramètres, utilisateurs. Réponses enregistrées (enregistrements.ts) :
// journal, devis, factures, santé, gestion des fichiers, système, configuration de l'assistant IA.
export { installerDemo } from './installer';
export { Demo } from './Demo';
