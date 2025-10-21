/**
 * COMPOSANT DE STATUT D'AUTHENTIFICATION
 * =======================================
 * 
 * Affiche le statut de connexion et permet la reconnexion
 */

import React from 'react';
import { isAuthenticated, redirectToLogin } from '../../utils/authUtils';
import { ExclamationTriangleIcon, UserIcon } from '@heroicons/react/24/outline';

const AuthStatus = ({ className = '' }) => {
  const isLoggedIn = isAuthenticated();

  if (isLoggedIn) {
    return (
      <div className={`flex items-center text-success-600 ${className}`}>
        <UserIcon className="h-4 w-4 mr-1" />
        <span className="text-sm">Connecté</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center text-error-600 ${className}`}>
      <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
      <span className="text-sm">Non connecté</span>
      <button
        onClick={redirectToLogin}
        className="ml-2 px-2 py-1 bg-error-600 text-white text-xs rounded hover:bg-error-700 transition-colors"
      >
        Se connecter
      </button>
    </div>
  );
};

export default AuthStatus;