import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { 
  SunIcon, 
  MoonIcon, 
  SparklesIcon,
  BeakerIcon,
  FireIcon,
  CloudIcon,
  HeartIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

/**
 * ThemeSelector - Sélecteur de thème complet avec preview
 * 
 * Affiche tous les thèmes disponibles avec:
 * - Icônes personnalisées
 * - Preview des couleurs
 * - Indicateur de thème actif
 * - Animations fluides
 */
const ThemeSelector = ({ variant = 'grid', compact = false }) => {
  const { theme, setTheme, themes } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-20 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
    );
  }

  // Configuration des thèmes avec métadonnées
  const themeConfig = {
    light: {
      name: 'Clair',
      description: 'Thème clair classique',
      icon: SunIcon,
      colors: ['#3b82f6', '#737373', '#22c55e', '#f59e0b', '#ef4444'],
    },
    dark: {
      name: 'Sombre',
      description: 'Thème sombre élégant',
      icon: MoonIcon,
      colors: ['#60a5fa', '#9ca3af', '#34d399', '#fbbf24', '#f87171'],
    },
    ocean: {
      name: 'Océan',
      description: 'Profondeurs bleues',
      icon: CloudIcon,
      colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#f59e0b', '#ef4444'],
    },
    forest: {
      name: 'Forêt',
      description: 'Nature verdoyante',
      icon: SparklesIcon,
      colors: ['#22c55e', '#84cc16', '#10b981', '#f59e0b', '#ef4444'],
    },
    sunset: {
      name: 'Coucher de soleil',
      description: 'Chaleur orangée',
      icon: FireIcon,
      colors: ['#f97316', '#f59e0b', '#84cc16', '#fbbf24', '#dc2626'],
    },
    midnight: {
      name: 'Minuit',
      description: 'Nuit étoilée',
      icon: MoonIcon,
      colors: ['#a855f7', '#8b5cf6', '#34d399', '#fbbf24', '#f87171'],
    },
    rose: {
      name: 'Rose',
      description: 'Romantique moderne',
      icon: HeartIcon,
      colors: ['#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#ef4444'],
    },
  };

  // Variante dropdown compacte
  if (variant === 'dropdown' || compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 
                     rounded-lg transition-all duration-200
                     bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700
                     border border-neutral-200 dark:border-neutral-700"
        >
          <div className="flex items-center gap-3">
            {themeConfig[theme] && React.createElement(themeConfig[theme].icon, {
              className: "h-5 w-5 text-neutral-700 dark:text-neutral-200"
            })}
            <div className="text-left">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {themeConfig[theme]?.name || theme}
              </p>
              {!compact && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {themeConfig[theme]?.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {themeConfig[theme]?.colors.slice(0, 3).map((color, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border border-neutral-300 dark:border-neutral-600"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto
                          bg-white dark:bg-neutral-800 rounded-lg shadow-xl
                          border border-neutral-200 dark:border-neutral-700">
              <div className="p-2 space-y-1">
                {themes.map((themeName) => {
                  const config = themeConfig[themeName];
                  if (!config) return null;
                  const Icon = config.icon;
                  const isActive = theme === themeName;

                  return (
                    <button
                      key={themeName}
                      onClick={() => {
                        setTheme(themeName);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                transition-all duration-200
                                ${isActive 
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500' 
                                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 border-2 border-transparent'
                                }`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'}`} />
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-neutral-900 dark:text-white'}`}>
                          {config.name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {config.description}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {config.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      {isActive && (
                        <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Variante grid (par défaut)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
          Choisir un thème
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {themes.length} thèmes disponibles
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((themeName) => {
          const config = themeConfig[themeName];
          if (!config) return null;
          const Icon = config.icon;
          const isActive = theme === themeName;

          return (
            <button
              key={themeName}
              onClick={() => setTheme(themeName)}
              className={`relative p-4 rounded-xl transition-all duration-200 text-left
                        ${isActive 
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-2 border-blue-500 shadow-lg transform scale-105' 
                          : 'bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                        }`}
            >
              {isActive && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <CheckIcon className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-600' : 'bg-neutral-100 dark:bg-neutral-700'}`}>
                  <Icon className={`h-6 w-6 ${isActive ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold text-base ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-neutral-900 dark:text-white'}`}>
                    {config.name}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {config.description}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {config.colors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-8 rounded-md border-2 border-white dark:border-neutral-900 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={`Couleur ${i + 1}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info sur le thème actuel */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <SparklesIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">
            Thème actif: {themeConfig[theme]?.name}
          </h4>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Le thème est sauvegardé automatiquement et s'applique immédiatement à toute l'interface.
        </p>
      </div>
    </div>
  );
};

export default ThemeSelector;
