import React from 'react';
import LivreurDossiers from '../components/LivreurDossiers';

// Page de test pour l'interface livreur améliorée
const TestLivreurPage = () => {
  const mockUser = {
    id: 1,
    nom: 'Dupont',
    prenom: 'Paul',
    role: 'livreur'
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <LivreurDossiers user={mockUser} />
    </div>
  );
};

export default TestLivreurPage;