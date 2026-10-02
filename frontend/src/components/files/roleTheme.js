// Centralized role-based UI themes with intelligent sidebar colors
export const roleTheme = {
  admin: {
    name: 'Administrateur',
    gradient: 'from-[#007bff] to-[#00c6ff]',
    badge: 'bg-primary-100 text-primary-800 dark:bg-blue-700 dark:text-white',
    header: 'bg-gradient-to-r from-[#007bff] to-[#00c6ff]',
    accent: 'text-blue-600 dark:text-blue-400',
    // Couleurs pour le sidebar
    sidebar: {
      bg: 'bg-[linear-gradient(135deg,_#007bff,_#00c6ff)] text-white',
      border: 'border-white/20',
      headerGradient: 'from-[#007bff] to-[#00c6ff]',
      itemActive: 'bg-white/15 text-white shadow-none',
      itemHover: 'hover:bg-white/10',
      itemText: 'text-white/90',
      itemIcon: 'text-white/80',
      itemIconHover: 'group-hover:text-white',
    },
  },
  preparateur: {
    name: 'Préparateur',
    gradient: 'from-[#007bff] to-[#00c6ff]',
    badge: 'bg-primary-100 text-primary-800 dark:bg-blue-700 dark:text-white',
    header: 'bg-gradient-to-r from-[#007bff] to-[#00c6ff]',
    accent: 'text-blue-600 dark:text-blue-400',
    // Couleurs pour le sidebar
    sidebar: {
      bg: 'bg-[linear-gradient(135deg,_#007bff,_#00c6ff)] text-white',
      border: 'border-white/20',
      headerGradient: 'from-[#007bff] to-[#00c6ff]',
      itemActive: 'bg-white/15 text-white shadow-none',
      itemHover: 'hover:bg-white/10',
      itemText: 'text-white/90',
      itemIcon: 'text-white/80',
      itemIconHover: 'group-hover:text-white',
    },
  },
  imprimeur_roland: {
    name: 'Imprimeur Roland',
    gradient: 'from-[#007bff] to-[#00c6ff]',
    badge: 'bg-primary-100 text-primary-800 dark:bg-blue-700 dark:text-white',
    header: 'bg-gradient-to-r from-[#007bff] to-[#00c6ff]',
    accent: 'text-blue-600 dark:text-blue-400',
    // Couleurs pour le sidebar
    sidebar: {
      bg: 'bg-[linear-gradient(135deg,_#007bff,_#00c6ff)] text-white',
      border: 'border-white/20',
      headerGradient: 'from-[#007bff] to-[#00c6ff]',
      itemActive: 'bg-white/15 text-white shadow-none',
      itemHover: 'hover:bg-white/10',
      itemText: 'text-white/90',
      itemIcon: 'text-white/80',
      itemIconHover: 'group-hover:text-white',
    },
  },
  imprimeur_xerox: {
    name: 'Imprimeur Xerox',
    gradient: 'from-[#007bff] to-[#00c6ff]',
    badge: 'bg-primary-100 text-primary-800 dark:bg-blue-700 dark:text-white',
    header: 'bg-gradient-to-r from-[#007bff] to-[#00c6ff]',
    accent: 'text-blue-600 dark:text-blue-400',
    // Couleurs pour le sidebar
    sidebar: {
      bg: 'bg-[linear-gradient(135deg,_#007bff,_#00c6ff)] text-white',
      border: 'border-white/20',
      headerGradient: 'from-[#007bff] to-[#00c6ff]',
      itemActive: 'bg-white/15 text-white shadow-none',
      itemHover: 'hover:bg-white/10',
      itemText: 'text-white/90',
      itemIcon: 'text-white/80',
      itemIconHover: 'group-hover:text-white',
    },
  },
  livreur: {
    name: 'Livreur',
    gradient: 'from-[#007bff] to-[#00c6ff]',
    badge: 'bg-primary-100 text-primary-800 dark:bg-blue-700 dark:text-white',
    header: 'bg-gradient-to-r from-[#007bff] to-[#00c6ff]',
    accent: 'text-blue-600 dark:text-blue-400',
    // Couleurs pour le sidebar
    sidebar: {
      bg: 'bg-[linear-gradient(135deg,_#007bff,_#00c6ff)] text-white',
      border: 'border-white/20',
      headerGradient: 'from-[#007bff] to-[#00c6ff]',
      itemActive: 'bg-white/15 text-white shadow-none',
      itemHover: 'hover:bg-white/10',
      itemText: 'text-white/90',
      itemIcon: 'text-white/80',
      itemIconHover: 'group-hover:text-white',
    },
  },
};

export const getRoleTheme = role => roleTheme[role] || roleTheme.admin;
