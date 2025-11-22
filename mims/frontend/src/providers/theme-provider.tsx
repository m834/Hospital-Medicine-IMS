'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeName, themes } from '@/lib/theme-config';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'mims-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('default');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName;
    if (savedTheme && themes[savedTheme]) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('default');
    }
  }, []);

  // Apply theme to CSS variables
  const applyTheme = (themeName: ThemeName) => {
    const root = document.documentElement;
    const themeColors = themes[themeName];

    // Apply all CSS variables
    Object.entries(themeColors).forEach(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--${cssVarName}`, value);
    });

    // Add/remove dark class for dark theme
    if (themeName === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Set theme and persist to localStorage
  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    availableThemes: Object.keys(themes) as ThemeName[],
  };

  // Prevent flash of unstyled content
  if (!mounted) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Custom hook to use theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
