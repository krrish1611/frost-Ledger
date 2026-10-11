import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Activity,
  ShieldCheck,
  Brain,
  Sliders,
  FileDown,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Layers,
  Flame,
  ArrowRight,
  Package,
} from 'lucide-react';
import { MOCK_SHIPMENTS, ShipmentSummary } from '../services/api';
import { soundEffects } from '../services/soundEffects';
import { useTheme } from '../context/ThemeContext';
import { generateOfficialAuditCertificatePdf, generateDeepThermalAnalyticsPdf } from '../services/pdfReportGenerator';
import { toast } from 'sonner';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: 'shipments' | 'verify' | 'ai-intelligence' | 'admin') => void;
  onSelectShipment: (shipment: ShipmentSummary) => void;
  onOpenSimulator: () => void;
  onOpenVerifier: () => void;
  onNavigateHome?: () => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Shipments' | 'Audit & Reports' | 'Tools & Simulators' | 'Preferences';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onSelectShipment,
  onOpenSimulator,
  onOpenVerifier,
  onNavigateHome,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      soundEffects.playClick();
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-shipments',
      category: 'Navigation',
      title: 'Go to Live Telemetry & Shipments',
      subtitle: 'Monitor real-time cold chain sensors and telemetry',
      icon: <Activity size={16} />,
      action: () => {
        onSelectTab('shipments');
        onClose();
      },
    },
    {
      id: 'nav-verify',
      category: 'Navigation',
      title: 'Go to Arrival Verification',
      subtitle: 'Execute arrival dock cryptographic verification checklist',
      icon: <ShieldCheck size={16} />,
      action: () => {
        onSelectTab('verify');
        onClose();
      },
    },
    {
      id: 'nav-ai',
      category: 'Navigation',
      title: 'Go to AI Risk & Telemetry Advisory',
      subtitle: 'Inspect River ML anomaly detection and SHAP explanations',
      icon: <Brain size={16} />,
      action: () => {
        onSelectTab('ai-intelligence');
        onClose();
      },
    },
    {
      id: 'nav-admin',
      category: 'Navigation',
      title: 'Go to Admin Fleet Management',
      subtitle: 'Manage devices, profiles, and immutable audit logs',
      icon: <Sliders size={16} />,
      action: () => {
        onSelectTab('admin');
        onClose();
      },
    },
    ...(onNavigateHome
      ? [
          {
            id: 'nav-home',
            category: 'Navigation' as const,
            title: 'Return to Public Landing Showcase',
            subtitle: 'Explore 3D hero visualization, cold chain overview, and metrics',
            icon: <Layers size={16} />,
            action: () => {
              onNavigateHome();
              onClose();
            },
          },
        ]
      : []),

    // Tools & Simulators
    {
      id: 'tool-sim',
      category: 'Tools & Simulators',
      title: 'Launch Interactive Excursion Simulator',
      subtitle: 'Live Arrhenius degradation, River ML alert & Ed25519 signing',
      icon: <Flame size={16} className="text-[var(--color-warn)]" />,
      action: () => {
        onClose();
        onOpenSimulator();
      },
    },
    {
      id: 'tool-verifier',
      category: 'Tools & Simulators',
      title: 'Query Polygon Amoy Smart Contract On-Chain',
      subtitle: 'Live EVM RPC cryptographic consensus check',
      icon: <Layers size={16} className="text-[var(--color-accent)]" />,
      action: () => {
        onClose();
        onOpenVerifier();
      },
    },

    // Reports
    {
      id: 'report-audit',
      category: 'Audit & Reports',
      title: 'Download Cryptographic Audit Certificate PDF',
      subtitle: 'Official pharmaceutical release audit certificate with Ed25519 hash chain',
      icon: <FileDown size={16} className="text-[var(--color-accent)]" />,
      action: () => {
        onClose();
        try {
          generateOfficialAuditCertificatePdf(MOCK_SHIPMENTS[0], null);
          soundEffects.playSuccessChime();
          toast.success('Cryptographic Audit Certificate PDF downloaded!');
        } catch (err: any) {
          toast.error('Failed to generate Audit PDF: ' + (err?.message || 'Error'));
        }
      },
    },
    {
      id: 'report-analytics',
      category: 'Audit & Reports',
      title: 'Download Deep Analytics & Arrhenius Report PDF',
      subtitle: 'Mean Kinetic Temperature, MKT kinetics and cumulative degradation analysis',
      icon: <FileDown size={16} className="text-[var(--color-pass)]" />,
      action: () => {
        onClose();
        try {
          generateDeepThermalAnalyticsPdf(MOCK_SHIPMENTS[0]);
          soundEffects.playSuccessChime();
          toast.success('Deep Analytics & Thermal Kinetics Report PDF downloaded!');
        } catch (err: any) {
          toast.error('Failed to generate Analytics PDF: ' + (err?.message || 'Error'));
        }
      },
    },

    // Preferences
    {
      id: 'pref-theme',
      category: 'Preferences',
      title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      subtitle: `Currently in ${theme.toUpperCase()} theme`,
      icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
      action: () => {
        toggleTheme();
        onClose();
      },
    },
    {
      id: 'pref-sound',
      category: 'Preferences',
      title: soundEffects.isMuted() ? 'Enable Sound FX' : 'Mute Sound FX',
      subtitle: soundEffects.isMuted() ? 'Turn on audio synthesizer' : 'Silence tactile feedback',
      icon: soundEffects.isMuted() ? <Volume2 size={16} /> : <VolumeX size={16} />,
      action: () => {
        soundEffects.toggleMute();
        onClose();
      },
    },

    // Shipments
    ...MOCK_SHIPMENTS.map((s) => ({
      id: `shipment-${s.shipment_id}`,
      category: 'Shipments' as const,
      title: `${s.profile_name} (${s.shipment_id})`,
      subtitle: `Temp: ${s.current_temp}°C | Potency: ${s.remaining_life_pct}% | ${s.status.toUpperCase()}`,
      icon: <Package size={16} className="text-[var(--color-accent)]" />,
      action: () => {
        onSelectShipment(s);
        onSelectTab('shipments');
        onClose();
        toast.success(`Loaded Shipment ${s.shipment_id}`);
      },
    })),
  ];

  // Filter commands
  const filtered = commands.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
  });

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
      soundEffects.playClick();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      soundEffects.playClick();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        soundEffects.playClick();
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -15 }}
          transition={{ duration: 0.16 }}
          className="w-full max-w-xl rounded-2xl border hairline bg-[#0e0e12] text-neutral-200 shadow-2xl overflow-hidden font-mono text-xs flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Search Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-[#121218]">
            <Search size={16} className="text-[var(--color-accent)] opacity-80" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command, shipment ID, or action... (↑ ↓ to navigate, ↵ to select)"
              className="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none text-xs font-mono"
            />
            <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] border border-white/[0.1] text-neutral-400">
              ESC
            </kbd>
          </div>

          {/* Action List */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs font-mono">
                No matching commands found for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      soundEffects.playClick();
                      item.action();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--color-accent)]/15 text-white border border-[var(--color-accent)]/30'
                        : 'hover:bg-white/[0.04] text-neutral-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded ${isSelected ? 'text-[var(--color-accent)]' : 'text-neutral-400'}`}>
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate text-white">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-[10px] text-neutral-400 truncate">{item.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-400 font-sans">
                        {item.category}
                      </span>
                      {isSelected && <ArrowRight size={12} className="text-[var(--color-accent)]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-[#0c0c10] text-[10px] text-neutral-400">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] mr-1">↑</kbd>
                <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] mr-1">↓</kbd>
                Navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] mr-1">↵</kbd>
                Select
              </span>
            </div>
            <span>FrostLedger Command Engine</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
