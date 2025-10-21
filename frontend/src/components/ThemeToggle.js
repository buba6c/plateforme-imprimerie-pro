import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

const ThemeToggle = ({ className = '' }) => {
  const [isDark, setIsDark] = useState(false);

  // Charger le thème depuis localStorage au montage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Basculer le thème
  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <motion.button
      onClick={toggleTheme}
      className={`
        relative inline-flex items-center justify-center
        w-12 h-12 rounded-full
        bg-gradient-to-br from-blue-500 to-cyan-500
        dark:from-indigo-600 dark:to-purple-600
        shadow-lg hover:shadow-xl
        transition-all duration-300
        hover:scale-110 active:scale-95
        ${className}
      `}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? (
          <MoonIcon className="h-6 w-6 text-white" />
        ) : (
          <SunIcon className="h-6 w-6 text-white" />
        )}
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggle;
