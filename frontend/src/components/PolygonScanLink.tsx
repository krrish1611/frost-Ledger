import React from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { copyToClipboard } from '../services/soundEffects';

interface PolygonScanLinkProps {
  type?: 'tx' | 'address' | 'block';
  value?: string;
  hash?: string;
  label?: string;
  shorten?: boolean;
  showFullLink?: boolean;
  className?: string;
}

export const PolygonScanLink: React.FC<PolygonScanLinkProps> = ({
  type = 'tx',
  value,
  hash,
  label,
  shorten = true,
  className = '',
}) => {
  const targetValue = value || hash || '';
  if (!targetValue) return null;

  const url = `https://amoy.polygonscan.com/${type}/${targetValue}`;
  const displayText = label || (shorten && targetValue.length > 16 ? `${targetValue.slice(0, 8)}...${targetValue.slice(-6)}` : targetValue);

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline hover:brightness-110 transition-all font-semibold"
        title={`View on PolygonScan (${type.toUpperCase()}): ${value}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span>{displayText}</span>
        <ExternalLink size={10} className="opacity-80" />
      </a>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(targetValue, `${type.toUpperCase()}`);
        }}
        className="p-0.5 rounded text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
        title="Copy Hash"
      >
        <Copy size={10} />
      </button>
    </span>
  );
};
