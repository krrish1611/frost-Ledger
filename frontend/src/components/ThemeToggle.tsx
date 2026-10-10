import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', compact = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border hairline transition-all duration-200 cursor-pointer select-none font-mono text-xs ${
        isLight
          ? 'bg-white hover:bg-[#f0f9ff] text-[#0284c7] border-[#cbd5e1] shadow-[0_2px_10px_rgba(2,132,199,0.15)]'
          : 'bg-[#121215] hover:bg-[#1a1a1f] text-neutral-300 hover:text-white border-[#222227]'
      } ${className}`}
      title={isLight ? 'Switch to Cyber Dark Mode' : 'Switch to Cryo Light Mode'}
      aria-label="Toggle Theme"
    >
      <motion.div
        key={theme}
        initial={{ rotate: -45, scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 45, scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-center"
      >
        {isLight ? (
          <Sun size={14} className="text-[#0284c7] drop-shadow-[0_0_6px_rgba(2,132,199,0.5)]" />
        ) : (
          <Moon size={14} className="text-[var(--color-accent)] drop-shadow-[0_0_6px_rgba(125,249,196,0.5)]" />
        )}
      </motion.div>

      {!compact && (
        <span className="text-[11px] font-semibold tracking-wide hidden sm:inline">
          {isLight ? 'LIGHT' : 'DARK'}
        </span>
      )}
    </button>
  );
};
