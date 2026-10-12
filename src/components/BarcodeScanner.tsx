// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: BarcodeScanner  (LIGHT MODE ONLY)
//
// PURPOSE:
// Live camera-based barcode + QR scanner with laser overlay, snapshot
// capture, and file upload fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onImageCaptured?: (base64Image: string) => void;
  onClose?: () => void;
}

export default function BarcodeScanner({ onDetected, onImageCaptured, onClose }: BarcodeScannerProps) {
  const elementId = 'html5-qrcode-scanner-view';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startingRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
  };

  const startCamera = async () => {
    if (startingRef.current || scannerRef.current?.isScanning) return;
    startingRef.current = true;
    setErrorMsg('');
    try {
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch {}
      }

      const scanner = new Html5Qrcode(elementId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.PDF_417,
          Html5QrcodeSupportedFormats.AZTEC,
        ],
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decodedText) => {
          playBeep();
          if (navigator.vibrate) navigator.vibrate(100);
          onDetected(decodedText);
        },
        () => {}
      );
      setRunning(true);
    } catch (err: any) {
      const message = String(err?.message || '');
      const errorName = String(err?.name || '');
      const details = `${errorName} ${message}`.toLowerCase();
      setErrorMsg(
        details.includes('notreadable') || details.includes('device in use')
          ? 'The camera is already in use by another app.'
          : details.includes('notallowed') || details.includes('permission') || details.includes('denied')
          ? 'Camera permission blocked. Allow camera access in browser settings.'
          : details.includes('notfound') || details.includes('no camera')
          ? 'No camera found. Connect a webcam and retry.'
          : details.includes('overconstrained')
          ? 'Camera does not support the requested settings.'
          : message || 'Could not access the camera.'
      );
      setRunning(false);
    } finally {
      startingRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setRunning(false);
  };

  const handleCaptureSnapshot = () => {
    const videoEl = document.querySelector<HTMLVideoElement>(`#${elementId} video`);
    if (!videoEl || !videoEl.videoWidth) {
      setErrorMsg('Camera stream not ready yet.');
      return;
    }
    try {
      setIsProcessing(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      playBeep();
      onImageCaptured?.(dataUrl);
    } catch (err: any) {
      setErrorMsg('Failed to capture snapshot: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result && onImageCaptured) {
        setIsProcessing(true);
        onImageCaptured(result);
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const startTimer = window.setTimeout(() => void startCamera(), 0);
    return () => {
      window.clearTimeout(startTimer);
      stopCamera();
    };
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {running && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${running ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          </span>
          <div>
            <h3 className="text-[12.5px] font-semibold text-slate-900">
              {running ? 'Live scanner active' : 'Camera paused'}
            </h3>
            <p className="text-[10.5px] text-slate-500">
              {running ? 'Align the barcode within the frame' : 'Click resume to start scanner'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {running ? (
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-700 transition"
            >
              Resume
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={() => { stopCamera(); onClose(); }}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="relative w-full overflow-hidden rounded-xl bg-black min-h-[260px] max-h-[380px] shadow-inner">
        <div id={elementId} className="w-full h-full" />

        {running && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="relative w-[88%] max-w-[340px] h-[190px] rounded-xl border border-emerald-400/60 bg-emerald-500/5 shadow-[0_0_25px_rgba(52,211,153,0.2)] flex items-center justify-center">
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_#34d399] animate-laser" />
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />
              <span className="text-[10.5px] font-mono text-white/80 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-white/10">
                Align barcode within frame
              </span>
            </div>
            <div className="mt-3 rounded-full bg-black/60 px-3 py-1 text-[10.5px] font-medium text-white/90 backdrop-blur-sm border border-white/10">
              ⚡ Full-frame optical scanning active
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="text-[10.5px] text-slate-500">
          Auto-detects automatically, or capture a high-res photo:
        </div>

        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 flex items-center gap-1.5 transition"
          >
            📁 Upload Picture
          </button>
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            disabled={!running || isProcessing}
            className="rounded-lg bg-teal-600 text-white hover:bg-teal-700 px-3.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            📸 Take Photo & Analyze
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
          {errorMsg}
        </div>
      )}
    </div>
  );
}