import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onDetected: (code: string) => void
  onImageCaptured?: (base64Image: string) => void
  onClose?: () => void
}

export default function BarcodeScanner({ onDetected, onImageCaptured, onClose }: BarcodeScannerProps) {
  const elementId = 'html5-qrcode-scanner-view'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [running, setRunning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Play pleasant positive scan confirmation beep using browser Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, audioCtx.currentTime) // 880Hz A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.15)
    } catch {}
  }

  const startCamera = async () => {
    setErrorMsg('')
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {}
      }

      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          aspectRatio: undefined
          // Omit qrbox so html5-qrcode scans the entire frame with zero double-box clipping
        },
        (decodedText) => {
          playBeep()
          if (navigator.vibrate) navigator.vibrate(100)
          onDetected(decodedText)
        },
        () => {
          // ignore frame miss
        }
      )
      setRunning(true)
    } catch (err: any) {
      console.warn('Camera error:', err)
      setErrorMsg(err?.message || 'Could not access camera. Check device permissions.')
      setRunning(false)
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
    setRunning(false)
  }

  // Capture current video frame as high-res snapshot and send to Python AI / CV analyzer
  const handleCaptureSnapshot = () => {
    const videoEl = document.querySelector<HTMLVideoElement>(`#${elementId} video`)
    if (!videoEl || !videoEl.videoWidth) {
      setErrorMsg('Camera stream not ready yet. Please wait a moment.')
      return
    }

    try {
      setIsProcessing(true)
      const canvas = document.createElement('canvas')
      canvas.width = videoEl.videoWidth
      canvas.height = videoEl.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

      playBeep()
      if (onImageCaptured) {
        onImageCaptured(dataUrl)
      }
    } catch (err: any) {
      setErrorMsg('Failed to capture snapshot: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Allow uploading a photo from device gallery / files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (result && onImageCaptured) {
        setIsProcessing(true)
        onImageCaptured(result)
        setIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="rounded-xl border border-ink/15 bg-white p-4 shadow-sm space-y-3">
      {/* Top Header & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {running && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                running ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {running ? 'Live Scanner Active' : 'Camera Paused'}
            </h3>
            <p className="text-xs text-ink/60">
              {running
                ? 'Align the barcode or QR code within the frame'
                : 'Click resume to start scanner'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {running ? (
            <button
              type="button"
              onClick={stopCamera}
              className="rounded bg-ink/10 px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/20"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="rounded bg-teal px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Resume
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopCamera()
                onClose()
              }}
              className="rounded border border-ink/20 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Video Container with Overlaid Laser Sweep Line */}
      <div className="relative w-full overflow-hidden rounded-xl bg-black min-h-[260px] max-h-[380px] shadow-inner">
        <div id={elementId} className="w-full h-full" />

        {/* Unified High-Tech Targeting Reticle */}
        {running && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="relative w-[88%] max-w-[340px] h-[190px] rounded-xl border border-emerald-400/60 bg-emerald-500/5 shadow-[0_0_25px_rgba(52,211,153,0.2)] flex items-center justify-center">
              {/* Smooth sweeping emerald laser bar */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_#34d399] animate-laser" />
              
              {/* Clean Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />

              <span className="text-[11px] font-mono text-white/80 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-xs border border-white/10">
                Align barcode within frame
              </span>
            </div>

            <div className="mt-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm border border-white/10">
              ⚡ Full-frame optical scanning active
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar: Capture Snapshot & Upload Photo */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-ink/10">
        <div className="text-xs text-ink/50">
          Auto-detects automatically, or capture a high-res photo:
        </div>

        <div className="flex gap-2">
          {/* Upload file button */}
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
            className="rounded-lg border border-ink/20 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-ink flex items-center gap-1.5 transition"
          >
            📁 Upload Picture
          </button>

          {/* Take Photo Snapshot & Send to Backend Button */}
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            disabled={!running || isProcessing}
            className="rounded-lg bg-teal text-white hover:opacity-90 px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            📸 Take Photo & Analyze
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-alert/30 bg-alert/10 p-2 text-xs text-alert">
          {errorMsg}
        </div>
      )}
    </div>
  )
}
