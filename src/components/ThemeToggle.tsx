'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  username?: string;
}

export default function ThemeToggle({ username = 'guest' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const userThemeKey = `theme_${username}`;
    const savedTheme = localStorage.getItem(userThemeKey) as 'dark' | 'light' | null;
    
    // Default to 'dark' mode as requested
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    
    if (initialTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [username]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem(`theme_${username}`, nextTheme);
    
    if (nextTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  };

  // Prevent hydration mismatch by returning placeholder
  if (!mounted) {
    return (
      <button className="theme-toggle-btn" style={{ width: '40px', height: '40px' }} aria-label="Toggle Theme">
        <span style={{ width: '18px', height: '18px' }} />
      </button>
    );
  }

  return (
    <button 
      onClick={toggleTheme} 
      className="theme-toggle-btn" 
      aria-label="Toggle Theme"
      style={{ width: '40px', height: '40px' }}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-slate-800" size={18} />
      ) : (
        <Sun className="w-5 h-5 text-yellow-400" size={18} />
      )}
    </button>
  );
}

