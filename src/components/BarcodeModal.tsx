import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type { Product } from '../types'

interface BarcodeModalProps {
  product: Product & { id: string }
  onClose: () => void
  onTestScan?: (barcode: string) => void
}

export default function BarcodeModal({ product, onClose, onTestScan }: BarcodeModalProps) {
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [format, setFormat] = useState<'both' | 'barcode' | 'qr'>('both')

  useEffect(() => {
    // Render 1D Barcode
    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, product.id, {
          format: 'CODE128',
          width: 2.2,
          height: 70,
          displayValue: true,
          font: 'monospace',
          fontSize: 16,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000'
        })
      } catch (err) {
        console.warn('Barcode render error:', err)
      }
    }

    // Render 2D QR Code
    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        product.id,
        {
          width: 180,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.warn('QR code render error:', err)
        }
      )
    }
  }, [product.id, format])

  // Download printable medical label card as PNG
  const handleDownload = () => {
    // Create an offscreen canvas to combine label text and barcode
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 600
    canvas.height = 420

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Header banner
    ctx.fillStyle = '#0f766e' // teal
    ctx.fillRect(0, 0, canvas.width, 45)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText('Rwanda FDA · Verified Pharmaceutical Label', 20, 28)

    // Product Details
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText(product.name, 25, 85)

    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#475569'
    ctx.fillText(`Category: ${product.category}   |   Mfg: ${product.manufacturer}`, 25, 115)
    ctx.fillText(`Batch: ${product.batch}   |   Expiry: ${product.expiry}`, 25, 138)

    // Divider line
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(25, 155)
    ctx.lineTo(575, 155)
    ctx.stroke()

    // Draw Barcode SVG onto Canvas
    const svg = barcodeSvgRef.current
    if (svg) {
      const xml = new XMLSerializer().serializeToString(svg)
      const svg64 = btoa(unescape(encodeURIComponent(xml)))
      const image64 = 'data:image/svg+xml;base64,' + svg64

      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 30, 175, 340, 150)

        // Draw QR code next to it
        if (qrCanvasRef.current) {
          ctx.drawImage(qrCanvasRef.current, 400, 175, 160, 160)
        }

        // Instructions footer
        ctx.fillStyle = '#64748b'
        ctx.font = '12px sans-serif'
        ctx.fillText('Scan with MedVerify point-of-sale scanner to verify authenticity.', 25, 385)

        // Trigger Download
        const link = document.createElement('a')
        link.download = `MedVerify-${product.id}-${product.name.replace(/\s+/g, '_')}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      img.src = image64
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-ink/10 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-ink/10 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-teal font-semibold">
              Official Medication Barcode Card
            </div>
            <h2 className="text-xl font-bold text-ink mt-0.5">{product.name}</h2>
            <div className="text-xs text-ink/60 mt-0.5">
              {product.manufacturer} · Batch {product.batch} · Exp: {product.expiry}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex gap-2 my-4">
          {(['both', 'barcode', 'qr'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFormat(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition capitalize ${
                format === mode
                  ? 'bg-ink text-white'
                  : 'bg-slate-100 text-ink/70 hover:bg-slate-200'
              }`}
            >
              {mode === 'both' ? 'Barcode & QR Code' : mode === 'barcode' ? '1D Barcode' : '2D QR Code'}
            </button>
          ))}
        </div>

        {/* Display Canvas Card */}
        <div
          ref={cardRef}
          className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col items-center justify-center min-h-[220px] shadow-sm"
        >
          <div className="text-center mb-2">
            <span className="text-xs font-semibold text-ink/70">Scan this code with your webcam:</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {(format === 'both' || format === 'barcode') && (
              <div className="flex flex-col items-center">
                <svg ref={barcodeSvgRef} className="max-w-[280px]" />
                <span className="text-[11px] text-ink/50 mt-1 font-mono">Standard EAN/Code128</span>
              </div>
            )}

            {(format === 'both' || format === 'qr') && (
              <div className="flex flex-col items-center">
                <canvas ref={qrCanvasRef} className="rounded-lg border border-slate-100 shadow-sm" />
                <span className="text-[11px] text-ink/50 mt-1 font-mono">2D Data Matrix QR</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap gap-2 justify-between items-center">
          <div className="text-xs text-ink/50">
            💡 <em>Tip: Hold your phone screen or this window up to the scanner.</em>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="rounded-lg border border-teal text-teal hover:bg-teal/5 px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              ⬇️ Download PNG Label
            </button>

            {onTestScan && (
              <button
                onClick={() => {
                  onTestScan(product.id)
                  onClose()
                }}
                className="rounded-lg bg-teal text-white hover:opacity-90 px-3.5 py-2 text-xs font-semibold transition"
              >
                ⚡ Test Verify Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
