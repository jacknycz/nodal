'use client'
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | null;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  clearTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(null);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function getCurrentTheme(): Theme {
      if (!('theme' in localStorage)) return null;
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return null;
    }
    function getIsDark(): boolean {
      return document.documentElement.classList.contains('dark');
    }
    function updateTheme() {
      document.documentElement.classList.toggle(
        'dark',
        localStorage.theme === 'dark' ||
          (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }

    setThemeState(getCurrentTheme());
    updateTheme();
    setIsDark(getIsDark());
    setMounted(true);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!('theme' in localStorage)) {
        updateTheme();
        setIsDark(getIsDark());
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (newTheme === 'light') {
      localStorage.theme = 'light';
    } else if (newTheme === 'dark') {
      localStorage.theme = 'dark';
    } else {
      localStorage.removeItem('theme');
    }
    document.documentElement.classList.toggle(
      'dark',
      newTheme === 'dark' ||
        (!newTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
    setIsDark(document.documentElement.classList.contains('dark'));
  };

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      const currentlyDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(currentlyDark ? 'light' : 'dark');
    }
  };

  const clearTheme = () => {
    setTheme(null);
  };

  // Prevent hydration mismatch by not rendering children until mounted
  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, clearTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 