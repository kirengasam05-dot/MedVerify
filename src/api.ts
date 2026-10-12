// MedVerify API Client for Python Gateway
import { auth } from './firebase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) {
    return {}
  }
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

export type UserRole = 'field_officer' | 'ict_staff' | 'manager'
export interface CurrentUser {
  uid: string
  email: string
  role: UserRole
  roleLabel: string
  name?: string
  avatarUrl?: string
}

export interface SubmitScanPayload {
  barcode: string
  similarity: number
  location?: string
  device?: string
}

export interface HealthStatus {
  status: 'online' | 'offline'
  firebase?: { connected: boolean; mode: string; authenticated?: boolean; error?: string | null }
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_URL}/health`)
    if (!res.ok) return { status: 'offline' }
    const data = await res.json()
    return { status: 'online', firebase: data.firebase }
  } catch {
    return { status: 'offline' }
  }
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch(`${API_URL}/me`, { headers: await authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Could not verify account role' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function submitScan(data: SubmitScanPayload) {
  const res = await fetch(`${API_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
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
  const res = await fetch(`${API_URL}/scans`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch scans (HTTP ${res.status})`)
  return res.json()
}

export async function updateScanCase(id: string, changes: { caseStatus?: string; priority?: string }) {
  const res = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(changes)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update case' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchProducts() {
  const res = await fetch(`${API_URL}/products`, { headers: await authHeaders() })
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
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
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
    method: 'PATCH',
    headers: await authHeaders()
  })
  if (!res.ok) throw new Error(`Failed to toggle product (HTTP ${res.status})`)
  return res.json()
}

export async function seedDemoData() {
  const res = await fetch(`${API_URL}/seed`, {
    method: 'POST',
    headers: await authHeaders()
  })
  if (!res.ok) throw new Error(`Failed to seed demo data (HTTP ${res.status})`)
  return res.json()
}

export async function submitAccessRequest(data: {
  email: string
  name: string
  role: string
  department?: string
  reason?: string
}) {
  const res = await fetch(`${API_URL}/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Could not submit access request' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface InvestigationRecord {
  id: string
  facilityName: string
  location: string
  officer: string
  medicineBatch: string
  findings: string
  verdict: 'Seized & Quarantined' | 'Routine Inspection Passed' | 'Under Lab Review' | 'Warning Notice Issued'
  date: string
}

export async function fetchInvestigations(): Promise<InvestigationRecord[]> {
  const res = await fetch(`${API_URL}/investigations`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch investigations (HTTP ${res.status})`)
  return res.json()
}

export async function createInvestigation(data: {
  facilityName: string
  location: string
  officer?: string
  medicineBatch: string
  findings: string
  verdict: string
}): Promise<InvestigationRecord> {
  const res = await fetch(`${API_URL}/investigations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Could not create investigation' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
