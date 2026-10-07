// MedVerify API Client for Python Gateway
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export interface SubmitScanPayload {
  barcode: string
  similarity: number
  location?: string
  device?: string
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function submitScan(data: SubmitScanPayload) {
  const res = await fetch(`${API_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Scan submission failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function submitImageScan(imageDataBase64: string, similarity: number = 95, location: string = 'Kigali') {
  const res = await fetch(`${API_URL}/scan-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageDataBase64,
      similarity,
      location
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Image analysis failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchScans() {
  const res = await fetch(`${API_URL}/scans`)
  if (!res.ok) throw new Error(`Failed to fetch scans (HTTP ${res.status})`)
  return res.json()
}

export async function updateScanCase(id: string, caseStatus: string) {
  const res = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseStatus })
  })
  if (!res.ok) throw new Error(`Failed to update case (HTTP ${res.status})`)
  return res.json()
}

export async function fetchProducts() {
  const res = await fetch(`${API_URL}/products`)
  if (!res.ok) throw new Error(`Failed to fetch products (HTTP ${res.status})`)
  return res.json()
}

export async function addProduct(data: {
  id: string
  name: string
  category: string
  manufacturer: string
  batch: string
  expiry: string
}) {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add product' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function toggleProductStatus(id: string) {
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(id)}`, {
    method: 'PATCH'
  })
  if (!res.ok) throw new Error(`Failed to toggle product (HTTP ${res.status})`)
  return res.json()
}

export async function seedDemoData() {
  const res = await fetch(`${API_URL}/seed`, {
    method: 'POST'
  })
  if (!res.ok) throw new Error(`Failed to seed demo data (HTTP ${res.status})`)
  return res.json()
}
