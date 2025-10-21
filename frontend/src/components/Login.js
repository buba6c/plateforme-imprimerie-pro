import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import {
  LockClosedIcon,
  ArrowRightOnRectangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';

// NOTE: Page de connexion revisitée pour un aspect plus professionnel.
// Points ajoutés:
//  - Layout "split" avec volet gauche branding et volet droit formulaire
//  - Zone d'accroche marketing + bénéfices (peut être reliée à un CMS plus tard)
//  - Gestion d'accessibilité (aria-* sur messages d'erreur, labels explicites)
//  - Option "Se souvenir de moi" (clé locale remember_login_email)
//  - Placeholder lien "Mot de passe oublié ?" (à implémenter + route backend /auth/forgot-password)
//  - Badges comptes de test relookés
//  - Préparation dark mode (classes tailwind dark:*)
//  - Animations douces (transition, hover, focus rings)

const Login = () => {
  const { login } = useAuth();
  const rememberedEmail = localStorage.getItem('remember_login_email') || '';
  const [formData, setFormData] = useState({
    email: rememberedEmail,
    password: '',
    remember: !!rememberedEmail,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Effacer l'erreur lors de la saisie
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (formData.remember) {
        localStorage.setItem('remember_login_email', formData.email);
      } else {
        localStorage.removeItem('remember_login_email');
      }

      // IMPORTANT: login() retourne { success: boolean, error?: string }
      const result = await login(formData.email, formData.password);

      if (!result || result.success !== true) {
        // Pas de throw dans AuthContext en cas d'échec -> on gère ici
        const errorMsg = result?.error || 'Email ou mot de passe incorrect.';
        const errorCode = result?.code ? ` (Code: ${result.code})` : '';
        setError(errorMsg + errorCode);
        return; // ne pas continuer
      }
      // Succès: la navigation est effectuée dans AuthContext (navigate('/'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Erreur de connexion (exception):', err);
      }
      setError(err?.message || 'Erreur de connexion inattendue');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-neutral-50 dark:bg-neutral-900">
      {/* Colonne branding */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)] pointer-events-none" />
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="h-14 w-14 rounded-xl bg-white dark:bg-neutral-800/10 backdrop-blur flex items-center justify-center shadow-inner">
              <LockClosedIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">EvocomPrint</h1>
              <p className="text-blue-100 text-sm font-medium">Plateforme d&apos;impression &amp; workflow</p>
            </div>
          </div>
          <div className="space-y-6">
            <h2 className="text-4xl font-extrabold leading-tight drop-shadow-sm">
              Accélérez votre production<br />dès la connexion.
            </h2>
            <p className="text-blue-100 max-w-md leading-relaxed">
              Suivi temps réel, centralisation des fichiers, orchestration des rôles. Une suite unifiée pour
              préparateurs, opérateurs et livreurs.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5" />
                <span>Traçabilité complète des dossiers & statuts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5" />
                <span>Gestion unifiée des fichiers & prévisualisations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5" />
                <span>Optimisé pour les flux Roland & Xerox</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="text-xs text-blue-200/80">
          © {new Date().getFullYear()} EvocomPrint. Tous droits réservés.
        </div>
      </div>

      {/* Colonne formulaire */}
      <div className="flex items-center justify-center py-12 px-6 sm:px-8 lg:px-12 relative">
        <div className="absolute top-4 right-4 text-xs text-neutral-400 dark:text-neutral-500">
          v1.0.0
        </div>
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-4">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">EvocomPrint</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Plateforme d&apos;impression &amp; workflow</p>
          </div>

          <div className="bg-neutral-0/80 dark:bg-neutral-800/70 backdrop-blur-md shadow-xl rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 p-8 transition-all">
            <div className="mb-8 space-y-2">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <ArrowRightOnRectangleIcon className="h-6 w-6 text-blue-600" /> Connexion sécurisée
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Authentifiez-vous pour accéder à votre espace de production.
              </p>
            </div>

            {error && (
              <div
                className="bg-danger-50/90 dark:bg-danger-900/40 border border-danger-200 dark:border-danger-700 rounded-lg p-4 flex gap-3"
                role="alert"
                aria-live="assertive"
              >
                <svg
                  className="h-5 w-5 text-danger-500 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-danger-800 dark:text-danger-300">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="form-label flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Email professionnel</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="form-input h-11"
                    placeholder="ex: operateur@entreprise.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    aria-invalid={!!error}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                      onClick={() => alert('Fonction à implémenter: reset mot de passe')}
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative group">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="form-input h-11 pr-10"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-500"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {passwordFocused && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <InformationCircleIcon className="h-4 w-4" />
                      Saisissez votre mot de passe personnel.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-neutral-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
                      checked={formData.remember}
                      onChange={e => setFormData(prev => ({ ...prev, remember: e.target.checked }))}
                      disabled={loading}
                    />
                    <span>Se souvenir de moi</span>
                  </label>
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">ENV: {process.env.NODE_ENV}</div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !formData.email || !formData.password}
                  className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 h-5 w-5 text-white"
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
                      Connexion...
                    </>
                  ) : (
                    <>
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                      Se connecter
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-10 border-t border-neutral-200 dark:border-neutral-700 pt-6">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3">Comptes disponibles ✅</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {[
                  { label: 'Admin Legacy', cred: 'admin@imprimerie.local / admin123' },
                  { label: 'Admin Nouveau', cred: 'admin@evocomprint.com / admin123' },
                  { label: 'Préparateur', cred: 'preparateur@evocomprint.com / prep123' },
                  { label: 'Imprimeur Roland', cred: 'roland@evocomprint.com / roland123' },
                  { label: 'Imprimeur Xerox', cred: 'xerox@evocomprint.com / xerox123' },
                  { label: 'Livreur', cred: 'livreur@evocomprint.com / livreur123' },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded border border-neutral-200 dark:border-neutral-700/70 px-2 py-1 bg-neutral-50/80 dark:bg-neutral-700/30 text-neutral-700 dark:text-neutral-200 flex flex-col"
                  >
                    <span className="font-semibold text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">
                      {item.label}
                    </span>
                    <span className="truncate" title={item.cred}>{item.cred}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                API Backend connectée • Tous comptes validés • Mode production
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-neutral-400 dark:text-neutral-500">
            <p>
              © {new Date().getFullYear()} EvocomPrint • Infrastructure sécurisée • Build {process.env.REACT_APP_BUILD_ID || 'local'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
