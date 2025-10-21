import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Hook personnalisé pour les thèmes adaptatifs des graphiques
 * Fournit des couleurs et styles adaptés au mode sombre/clair
 */
export const useChartTheme = () => {
  const { resolvedTheme } = useTheme();

  const chartTheme = useMemo(() => {
    const isDark = resolvedTheme === 'dark';

    return {
      // Configuration générale
      isDark,
      
      // Couleurs de base
      backgroundColor: isDark ? '#1f2937' : 'var(--color-neutral-0)',
      textColor: isDark ? '#f3f4f6' : '#1f2937',
      mutedTextColor: isDark ? '#9ca3af' : '#6b7280',
      
      // Grille et axes
      gridColor: isDark ? '#374151' : '#e5e7eb',
      axisColor: isDark ? '#6b7280' : '#9ca3af',
      
      // Tooltip
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : 'var(--color-neutral-0)',
        borderColor: isDark ? '#4b5563' : '#e5e7eb',
        textColor: isDark ? '#f3f4f6' : '#1f2937',
        shadow: isDark 
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
      
      // Légende
      legend: {
        textColor: isDark ? '#d1d5db' : '#4b5563',
      },
      
      // Couleurs des données (palette adaptative)
      dataColors: {
        primary: isDark ? '#60a5fa' : 'var(--color-blue-500)',
        secondary: isDark ? '#34d399' : '#10b981',
        tertiary: isDark ? '#f59e0b' : '#d97706',
        quaternary: isDark ? '#a78bfa' : '#8b5cf6',
        danger: isDark ? '#fb7185' : '#ef4444',
        success: isDark ? '#4ade80' : '#22c55e',
        warning: isDark ? '#fbbf24' : '#f59e0b',
        info: isDark ? '#38bdf8' : '#0ea5e9',
      },
      
      // Couleurs spécifiques pour les graphiques métiers
      businessColors: {
        xerox: isDark ? '#60a5fa' : 'var(--color-blue-500)',      // Bleu pour Xerox
        roland: isDark ? '#34d399' : '#10b981',     // Vert pour Roland
        livraison: isDark ? '#fbbf24' : '#f59e0b',  // Jaune pour livraisons
        production: isDark ? '#a78bfa' : '#8b5cf6', // Violet pour production
        revenu: isDark ? '#4ade80' : '#22c55e',     // Vert pour revenus
      },
      
      // Dégradés adaptatifs
      gradients: {
        primary: isDark 
          ? 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)'
          : 'linear-gradient(135deg, var(--color-blue-500) 0%, var(--color-blue-700) 100%)',
        success: isDark
          ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        warning: isDark
          ? 'linear-gradient(135deg, #92400e 0%, #b45309 100%)'
          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      }
    };
  }, [resolvedTheme]);

  // Fonctions utilitaires pour les styles Recharts
  const getRechartsConfig = useMemo(() => ({
    // Configuration pour CartesianGrid
    grid: {
      strokeDasharray: '3 3',
      stroke: chartTheme.gridColor,
      strokeOpacity: 0.5,
    },
    
    // Configuration pour les axes
    xAxis: {
      fontSize: 12,
      stroke: chartTheme.axisColor,
      tick: { fill: chartTheme.mutedTextColor },
    },
    
    yAxis: {
      fontSize: 12,
      stroke: chartTheme.axisColor,
      tick: { fill: chartTheme.mutedTextColor },
    },
    
    // Configuration pour Tooltip
    tooltip: {
      contentStyle: {
        backgroundColor: chartTheme.tooltip.backgroundColor,
        border: `1px solid ${chartTheme.tooltip.borderColor}`,
        borderRadius: '8px',
        boxShadow: chartTheme.tooltip.shadow,
        color: chartTheme.tooltip.textColor,
      },
      cursor: {
        fill: chartTheme.isDark ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)',
      },
    },
    
    // Configuration pour Legend
    legend: {
      wrapperStyle: {
        color: chartTheme.legend.textColor,
      },
    },
    
  }), [chartTheme]);

  // Fonction pour obtenir une couleur par index
  const getColorByIndex = (index) => {
    const colors = Object.values(chartTheme.dataColors);
    return colors[index % colors.length];
  };

  // Fonction pour obtenir les couleurs métiers
  const getBusinessColor = (type) => {
    return chartTheme.businessColors[type] || chartTheme.dataColors.primary;
  };

  return {
    theme: chartTheme,
    config: getRechartsConfig,
    getColorByIndex,
    getBusinessColor,
    isDark: chartTheme.isDark,
  };
};

export default useChartTheme;