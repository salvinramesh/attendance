'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    
    const initialTheme = savedTheme || (systemPrefersLight ? 'light' : 'dark');
    setTheme(initialTheme);
    
    if (initialTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    
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
