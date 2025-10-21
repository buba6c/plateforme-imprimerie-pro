import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { EyeIcon, EyeSlashIcon, PrinterIcon, UserIcon } from '@heroicons/react/24/outline';
import { useToast } from './ui/Toast';

const LoginModern = () => {
  const { login: authLogin } = useAuth();
  const toast = useToast?.() || { error: (msg) => console.error(msg) }; // Fallback si ToastProvider pas disponible
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fonction pour obtenir un message d'erreur contextuel
  const getErrorMessage = (error) => {
    const errorStr = String(error).toLowerCase();
    if (errorStr.includes('401') || errorStr.includes('unauthorized') || errorStr.includes('incorrect')) {
      return '🔒 Identifiants incorrects. Vérifiez votre email et mot de passe.';
    }
    if (errorStr.includes('network') || errorStr.includes('fetch') || errorStr.includes('connexion')) {
      return '🌐 Problème de connexion. Vérifiez votre connexion internet.';
    }
    if (errorStr.includes('timeout')) {
      return '⏱️ Le serveur met trop de temps à répondre. Réessayez dans un instant.';
    }
    return '❌ Une erreur est survenue. Contactez le support si le problème persiste.';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // eslint-disable-next-line no-console
    console.log('🔐 Tentative de connexion avec:', { email: formData.email, passwordLength: formData.password.length });
    try {
      const result = await authLogin(formData.email, formData.password);
      // eslint-disable-next-line no-console
      console.log('✅ Résultat connexion:', result);
      if (!result.success) {
        const errorMsg = getErrorMessage(result.error || 'Erreur de connexion');
        setError(errorMsg);
        if (toast?.error) {
          toast.error(errorMsg);
        }
      }
      // Si success = true, AuthContext gère la redirection automatiquement
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('❌ Erreur de connexion:', err);
      // eslint-disable-next-line no-console
      console.error('❌ Erreur détaillée:', JSON.stringify(err, null, 2));
      const errorMsg = getErrorMessage(err.error || err.message || 'Erreur de connexion');
      setError(errorMsg);
      if (toast?.error) {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const testAccounts = [
    { label: 'Admin', email: 'admin@imprimerie.com', password: 'admin123', icon: '👑', color: 'from-primary-500 to-primary-700' },
    { label: 'Préparateur', email: 'buba6c@gmail.com', password: 'Bouba2307', icon: '📝', color: 'from-secondary-500 to-secondary-700' },
    { label: 'Imprimeur Roland', email: 'roland@imprimerie.local', password: 'Imprimerie2025', icon: '🖨️', color: 'from-success-500 to-success-700' },
    { label: 'Imprimeur Xerox', email: 'xerox@imprimerie.local', password: 'Imprimerie2025', icon: '🖨️', color: 'from-info-500 to-info-700' },
    { label: 'Livreur', email: 'livreur@imprimerie.local', password: 'admin123', icon: '🚚', color: 'from-warning-400 to-warning-600' },
  ];

  const quickFill = (account) => {
    setFormData({ email: account.email, password: account.password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neutral-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className={`max-w-6xl w-full space-y-8 relative z-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left side - Login form */}
          <div className="bg-white dark:bg-neutral-800/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 space-y-8 transform transition-all duration-500 hover:scale-[1.01]">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl shadow-lg dark:shadow-secondary-900/25 transform hover:rotate-12 transition-transform duration-300">
                <PrinterIcon className="w-10 h-10 text-white" />
              </div>

              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                  EvocomPrint
                </h1>
                <p className="text-neutral-600 dark:text-neutral-300 mt-2 font-medium">
                  Plateforme d&apos;imprimerie numérique
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error message */}
              {error && (
                <div className="bg-error-50 dark:bg-error-900/20 border-l-4 border-error-500 dark:border-error-400 rounded-lg p-4 animate-shake">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  Adresse email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-neutral-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition-all duration-200 bg-white dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400"
                    placeholder="votremail@exemple.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  Mot de passe
                </label>
                <div className="relative group">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="block w-full pr-10 pl-3 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition-all duration-200 bg-white dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login button */}
              <button
                type="submit"
                disabled={loading || !formData.email || !formData.password}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-white font-bold bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] hover:shadow-xl dark:shadow-secondary-900/30"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Connexion en cours...</span>
                  </div>
                ) : (
                  <span className="flex items-center">
                    <PrinterIcon className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                    Se connecter
                  </span>
                )}
              </button>

              {/* Lien mot de passe oublié */}
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          </div>

          {/* Right side - Quick access */}
          <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">Accès rapide</h2>
              <p className="text-neutral-600 dark:text-neutral-300">Cliquez sur un rôle pour vous connecter</p>
            </div>

            <div className="space-y-3">
              {testAccounts.map((account) => (
                <button
                  key={account.email}
                  onClick={() => quickFill(account)}
                  className={`w-full flex items-center space-x-4 p-4 rounded-xl bg-gradient-to-r ${account.color} text-white hover:shadow-lg dark:shadow-secondary-900/25 transform hover:scale-[1.02] transition-all duration-200`}
                >
                  <div className="text-3xl">{account.icon}</div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-lg">{account.label}</p>
                    <p className="text-sm opacity-90">{account.email}</p>
                  </div>
                  <div className="text-2xl opacity-75">→</div>
                </button>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                Cliquez sur un compte pour remplir automatiquement les identifiants
              </p>
              {/* Affichage sécurisé des mots de passe uniquement en dev */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <summary className="text-xs text-yellow-800 dark:text-yellow-200 cursor-pointer hover:text-yellow-900 dark:hover:text-yellow-100 font-medium">
                    🔧 Identifiants de test (Mode Développement)
                  </summary>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-neutral-600 dark:text-neutral-300">
                      <span className="font-semibold">Admin:</span> admin123
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300">
                      <span className="font-semibold">Préparateur:</span> Bouba2307
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300">
                      <span className="font-semibold">Imprimeurs:</span> Imprimerie2025
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300">
                      <span className="font-semibold">Autres:</span> admin123
                    </p>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-white/70 text-sm backdrop-blur-sm bg-white dark:bg-neutral-800/10 inline-block px-6 py-3 rounded-full">
            © 2025 EvocomPrint - Plateforme d&apos;imprimerie numérique
          </p>
        </div>
      </div>

      {/* CSS for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-5px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(5px);
          }
        }

        .animate-shake {
          animation: shake 0.5s;
        }
        `
      }} />
    </div>
  );
};

export default LoginModern;
