import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, QrCode, CheckCircle2, Download, Printer, Upload } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';
import { MOCK_SHIPMENTS, ShipmentSummary } from '../services/api';
import { toast } from 'sonner';

interface PalletQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (shipment: ShipmentSummary) => void;
}

export const PalletQrScannerModal: React.FC<PalletQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'badge' | 'upload'>('camera');
  const [selectedShipment, setSelectedShipment] = useState<ShipmentSummary>(MOCK_SHIPMENTS[0]);
  const [scanSuccess, setScanSuccess] = useState<ShipmentSummary | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize camera when camera mode is active
  useEffect(() => {
    if (!isOpen || activeMode !== 'camera') {
      stopCamera();
      return;
    }

    setCameraError(null);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          setCameraError('Camera access unavailable or denied. Use the 1-Click Simulation or Upload tab below.');
        });
    } else {
      setCameraError('Camera not supported by browser. Use 1-Click Simulation or Badge Generator.');
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const triggerScanSuccess = (shipment: ShipmentSummary) => {
    soundEffects.playScanBeep();
    setTimeout(() => soundEffects.playSuccessChime(), 150);

    setScanSuccess(shipment);
    toast.success(`Pallet Scanned: ${shipment.shipment_id}`, {
      description: `Hardware Ed25519 Key Verified • ${shipment.profile_name}`,
    });

    setTimeout(() => {
      onScanSuccess(shipment);
      onClose();
    }, 1200);
  };

  // Draw downloadable printable QR badge
  useEffect(() => {
    if (activeMode === 'badge' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 320;
      canvas.height = 380;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 320, 380);

      // Border
      ctx.strokeStyle = '#033500';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 304, 364);

      // Header
      ctx.fillStyle = '#033500';
      ctx.fillRect(10, 10, 300, 48);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FROSTLEDGER PALLET SEAL', 160, 32);
      ctx.font = '10px monospace';
      ctx.fillText('CRYPTOGRAPHIC COLD-CHAIN INTEGRITY', 160, 48);

      // Shipment details
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`ID: ${selectedShipment.shipment_id}`, 20, 80);
      ctx.fillText(`DRUG: ${selectedShipment.profile_name}`, 20, 98);
      ctx.fillText(`RANGE: ${selectedShipment.temp_min_c}°C to ${selectedShipment.temp_max_c}°C`, 20, 116);
      ctx.fillText(`MKT SPEC: < ${selectedShipment.mkt}°C`, 20, 134);

      // Draw QR Pattern Simulation
      const qrStartX = 60;
      const qrStartY = 150;
      const qrSize = 200;
      const cells = 25;
      const cellSize = qrSize / cells;

      ctx.fillStyle = '#033500';
      // Corner finders
      const drawFinder = (fx: number, fy: number) => {
        ctx.fillRect(fx, fy, cellSize * 7, cellSize * 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx + cellSize, fy + cellSize, cellSize * 5, cellSize * 5);
        ctx.fillStyle = '#033500';
        ctx.fillRect(fx + cellSize * 2, fy + cellSize * 2, cellSize * 3, cellSize * 3);
      };

      drawFinder(qrStartX, qrStartY);
      drawFinder(qrStartX + qrSize - cellSize * 7, qrStartY);
      drawFinder(qrStartX, qrStartY + qrSize - cellSize * 7);

      // Deterministic pseudo-random pattern based on shipment hash
      let seed = 42;
      for (let i = 0; i < selectedShipment.shipment_id.length; i++) {
        seed += selectedShipment.shipment_id.charCodeAt(i);
      }

      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          if (
            (r < 8 && c < 8) ||
            (r < 8 && c >= cells - 8) ||
            (r >= cells - 8 && c < 8)
          ) {
            continue;
          }
          seed = (seed * 9301 + 49297) % 233280;
          if (seed / 233280 > 0.5) {
            ctx.fillRect(qrStartX + c * cellSize, qrStartY + r * cellSize, cellSize, cellSize);
          }
        }
      }

      // Footer
      ctx.fillStyle = '#033500';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ed25519: 0x4b719a... VALID ✓ • Polygon Amoy L2', 160, 365);
    }
  }, [activeMode, selectedShipment]);

  const handleDownloadBadge = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `Pallet_QR_Badge_${selectedShipment.shipment_id}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    soundEffects.playSuccessChime();
    toast.success('Pallet QR Badge PNG Downloaded');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl border hairline bg-[#0d0d11] text-neutral-200 shadow-2xl overflow-hidden font-mono text-xs flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#121217]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                <QrCode size={16} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Pallet QR Dock Scanner</h3>
                <p className="text-[10px] text-[var(--color-muted)]">Warehouse Receiving Optical &amp; Ed25519 Seal Verifier</p>
              </div>
            </div>
            <button
              onClick={() => {
                soundEffects.playClick();
                onClose();
              }}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-white/[0.08] bg-[#101014] p-1.5 gap-1.5 text-[11px]">
            <button
              onClick={() => {
                soundEffects.playClick();
                setActiveMode('camera');
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                activeMode === 'camera'
                  ? 'bg-[var(--color-accent)] text-[#0a0a0b]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Camera size={13} />
              Optical Camera
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                setActiveMode('badge');
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                activeMode === 'badge'
                  ? 'bg-[var(--color-accent)] text-[#0a0a0b]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Printer size={13} />
              Generate Pallet Badge
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                setActiveMode('upload');
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                activeMode === 'upload'
                  ? 'bg-[var(--color-accent)] text-[#0a0a0b]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Upload size={13} />
              Instant 1-Click Scan
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {activeMode === 'camera' && (
              <div className="space-y-4">
                {/* Camera Viewfinder */}
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/[0.12] flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

                  {/* Scanning Crosshair & Animated Laser Line */}
                  <div className="absolute inset-8 border-2 border-dashed border-[var(--color-accent)]/60 rounded-xl pointer-events-none flex items-center justify-center">
                    <motion.div
                      className="w-full h-0.5 bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]"
                      animate={{ y: [-80, 80, -80] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>

                  {scanSuccess && (
                    <div className="absolute inset-0 bg-[var(--color-pass)]/20 backdrop-blur-xs flex items-center justify-center">
                      <div className="p-4 rounded-xl bg-black/85 border border-[var(--color-pass)] text-center space-y-1">
                        <CheckCircle2 size={32} className="text-[var(--color-pass)] mx-auto" />
                        <span className="font-bold text-white block">PALLET SEAL VALIDATED</span>
                        <span className="text-[10px] text-[var(--color-pass)] font-mono">{scanSuccess.shipment_id}</span>
                      </div>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px]">
                    {cameraError}
                  </div>
                )}

                {/* 1-Click Fast Sim Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider block">
                    Fast Simulation Pallets:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {MOCK_SHIPMENTS.slice(0, 2).map((s) => (
                      <button
                        key={s.shipment_id}
                        onClick={() => triggerScanSuccess(s)}
                        className="p-2.5 rounded-lg border border-white/[0.08] hover:border-[var(--color-accent)] bg-white/[0.03] text-left hover:bg-white/[0.06] transition-all cursor-pointer"
                      >
                        <span className="font-bold text-white block truncate">{s.profile_name}</span>
                        <span className="text-[10px] text-[var(--color-accent)] font-mono">{s.shipment_id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeMode === 'badge' && (
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-[var(--color-muted)] mb-1">
                    Select Shipment for Pallet Seal Badge:
                  </label>
                  <select
                    value={selectedShipment.shipment_id}
                    onChange={(e) => {
                      const found = MOCK_SHIPMENTS.find((s) => s.shipment_id === e.target.value);
                      if (found) setSelectedShipment(found);
                    }}
                    className="w-full px-3 py-2 rounded border border-white/[0.12] bg-[#16161c] text-white font-mono text-xs"
                  >
                    {MOCK_SHIPMENTS.map((s) => (
                      <option key={s.shipment_id} value={s.shipment_id}>
                        {s.profile_name} ({s.shipment_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-white rounded-xl shadow-lg border border-neutral-300 flex justify-center">
                  <canvas ref={canvasRef} className="rounded" style={{ width: '240px', height: '285px' }} />
                </div>

                <button
                  onClick={handleDownloadBadge}
                  className="w-full py-2.5 rounded-lg bg-[var(--color-accent)] text-[#0a0a0b] font-bold flex items-center justify-center gap-2 hover:bg-[#6febb5] transition-all cursor-pointer shadow-md"
                >
                  <Download size={14} />
                  Download Printable QR Pallet Badge (PNG)
                </button>
              </div>
            )}

            {activeMode === 'upload' && (
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--color-muted)]">
                  Click any verified shipment below to simulate optical reading of an authenticated pallet RFID/QR seal:
                </p>
                <div className="space-y-2">
                  {MOCK_SHIPMENTS.map((s) => (
                    <button
                      key={s.shipment_id}
                      onClick={() => triggerScanSuccess(s)}
                      className="w-full p-3 rounded-lg border border-white/[0.08] hover:border-[var(--color-accent)] bg-white/[0.03] text-left hover:bg-white/[0.06] transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-white block">{s.profile_name}</span>
                        <span className="text-[10px] text-[var(--color-muted)]">
                          {s.shipment_id} • Status: {s.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="px-2 py-1 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-[10px] font-bold">
                        Simulate Scan →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
