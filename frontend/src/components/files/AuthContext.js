import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from "./apiAdapter";
import PropTypes from 'prop-types';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('auth_token');

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        // Stocker le token dans axios (header par défaut) si nécessaire
        try {
          if (storedToken) {
            // Le realAuthService dans apiAdapter gère déjà les requêtes authentifiées via localStorage/JWT côté backend
            // Donc ici on s'assure juste qu'il existe bien
          }
        } catch (e) {
          console.warn('Impossible de configurer le header auth:', e);
        }
      } catch (error) {
        console.error('Erreur parsing utilisateur:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const normalizedEmail = (email || '').trim();
      console.log('🔑 Tentative de connexion:', normalizedEmail);
      
      const response = await authService.login(normalizedEmail, password);
      console.log('📡 Réponse authService:', response);
      
      // Le service peut retourner différents formats (mock vs réel)
      const token = response.token || response.accessToken || response.jwt;
      const userData = response.user || response.utilisateur || response.data?.user;
      
      if (token && userData) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setToken(token);
        console.log('✅ Connexion réussie, redirection...');
        navigate('/');
        return { success: true };
      }
      
      console.error('❌ Token ou userData manquant:', { token: !!token, userData: !!userData });
      throw new Error(response.error || 'Login échoué - données incomplètes');
    } catch (error) {
      const apiErr = error?.response?.data || error || {};
      console.error('❌ Erreur de login complète:', {
        error,
        apiErr,
        status: error?.response?.status,
        message: error?.message
      });
      
      // Gestion spécifique selon le type d'erreur
      let message = 'Erreur de connexion inattendue';
      let code = apiErr.code;
      
      if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
        message = 'Serveur non accessible - vérifiez que le backend est démarré';
        code = 'SERVER_UNREACHABLE';
      } else if (error?.response?.status === 401) {
        message = apiErr.error || 'Email ou mot de passe incorrect';
        code = apiErr.code || 'INVALID_CREDENTIALS';
      } else if (error?.response?.status >= 500) {
        message = 'Erreur serveur - veuillez réessayer';
        code = 'SERVER_ERROR';
      } else if (apiErr.error) {
        message = apiErr.error;
      } else if (error?.message) {
        message = error.message;
      }
      
      return { success: false, error: message, code };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    // Pas besoin de retirer un header custom ici car nous utilisons les services adaptatifs
    navigate('/login');
  };

  const authContextValue = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      isAuthenticated: !!user && !!token,
      loading,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé au sein d'un AuthProvider");
  }
  return context;
};
