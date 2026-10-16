// MedVerify API Client for Python Gateway
import { auth } from './firebase'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV
  ? 'http://127.0.0.1:8000/api'
  : 'https://medver-backend-21ru.onrender.com/api')

export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch (err) {
    console.warn('[Auth] Failed to get ID token:', err)
    return null
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export type UserRole = 'admin' | 'field_officer' | 'ict_staff' | 'manager'
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

/**
 * Universal API fetch helper with explicit timeout and browser console logging
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}, timeoutMs = 45000): Promise<T> {
  const url = `${API_URL}${endpoint}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const startTime = Date.now()

  console.log(`[API Req] ${options.method || 'GET'} ${url}`)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    const duration = Date.now() - startTime
    clearTimeout(timeoutId)

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }))
      console.error(`[API Res Error] ${res.status} ${url} (${duration}ms):`, err)
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    console.log(`[API Res Success] ${res.status} ${url} (${duration}ms):`, data)
    return data
  } catch (err: any) {
    clearTimeout(timeoutId)
    const duration = Date.now() - startTime
    if (err.name === 'AbortError') {
      console.error(`[API Timeout] ${url} timed out after ${timeoutMs / 1000}s`)
      throw new Error(`Server request timed out after ${timeoutMs / 1000}s. Render backend may still be spinning up.`)
    }
    console.error(`[API Network Error] ${url} (${duration}ms):`, err)
    throw err
  }
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const data = await apiFetch<any>('/health', {}, 15000)
    return { status: 'online', firebase: data.firebase }
  } catch {
    return { status: 'offline' }
  }
}

export async function fetchCurrentUser(providedToken?: string): Promise<CurrentUser> {
  const token = providedToken || (await getAuthToken())
  if (!token) throw new Error('Sign in is required.')
  return apiFetch<CurrentUser>('/me', {
    headers: { Authorization: `Bearer ${token}` }
  }, 45000)
}

export async function submitScan(data: SubmitScanPayload) {
  const headers = await authHeaders()
  return apiFetch<any>('/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  })
}

export async function submitImageScan(imageDataBase64: string, similarity: number = 95, location: string = 'Kigali') {
  const headers = await authHeaders()
  return apiFetch<any>('/scan-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ image: imageDataBase64, similarity, location })
  })
}

export async function fetchScans() {
  const headers = await authHeaders()
  if (!headers.Authorization) return []
  return apiFetch<any[]>('/scans', { headers })
}

export async function updateScanCase(id: string, changes: { caseStatus?: string; priority?: string }) {
  const headers = await authHeaders()
  return apiFetch<any>(`/scans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(changes)
  })
}

export async function fetchProducts() {
  const headers = await authHeaders()
  if (!headers.Authorization) return []
  return apiFetch<any[]>('/products', { headers })
}

export async function addProduct(data: {
  id: string
  name: string
  category: string
  manufacturer: string
  batch: string
  expiry: string
}) {
  const headers = await authHeaders()
  return apiFetch<any>('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  })
}

export async function toggleProductStatus(id: string) {
  const headers = await authHeaders()
  return apiFetch<any>(`/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers
  })
}

export async function seedDemoData() {
  const headers = await authHeaders()
  return apiFetch<any>('/seed', {
    method: 'POST',
    headers
  })
}

export async function submitAccessRequest(data: {
  email: string
  name: string
  role: string
  department?: string
  reason?: string
}) {
  return apiFetch<any>('/request-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
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
  const headers = await authHeaders()
  if (!headers.Authorization) return []
  return apiFetch<InvestigationRecord[]>('/investigations', { headers })
}

export async function createInvestigation(data: {
  facilityName: string
  location: string
  officer?: string
  medicineBatch: string
  findings: string
  verdict: string
}): Promise<InvestigationRecord> {
  const headers = await authHeaders()
  return apiFetch<InvestigationRecord>('/investigations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// USER & ROLE MANAGEMENT API (Manager Privileges)
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemUser {
  id: string
  name: string
  email: string
  role: UserRole
  roleLabel?: string
  department?: string
  status: 'active' | 'inactive'
  createdAt: string
  lastLogin?: string | null
}

export interface AccessRequest {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  reason?: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
}

export async function fetchUsers(): Promise<SystemUser[]> {
  const headers = await authHeaders()
  if (!headers.Authorization) return []
  return apiFetch<SystemUser[]>('/users', { headers })
}

export async function createSystemUser(data: {
  name: string
  email: string
  role: UserRole
  department?: string
  password: string
  status?: 'active' | 'inactive'
}): Promise<SystemUser> {
  const headers = await authHeaders()
  return apiFetch<SystemUser>('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  })
}

export async function updateSystemUser(
  id: string,
  changes: Partial<Pick<SystemUser, 'name' | 'role' | 'department' | 'status'>>
): Promise<SystemUser> {
  const headers = await authHeaders()
  return apiFetch<SystemUser>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(changes)
  })
}

export async function deleteSystemUser(id: string): Promise<{ success: boolean; message: string }> {
  const headers = await authHeaders()
  return apiFetch<{ success: boolean; message: string }>(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers
  })
}

export async function fetchAccessRequests(): Promise<AccessRequest[]> {
  const headers = await authHeaders()
  if (!headers.Authorization) return []
  return apiFetch<AccessRequest[]>('/access-requests', { headers })
}

export async function updateAccessRequest(
  id: string,
  action: 'approve' | 'reject',
  role?: UserRole
): Promise<{ success: boolean; request: AccessRequest }> {
  const headers = await authHeaders()
  return apiFetch<{ success: boolean; request: AccessRequest }>(`/access-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action, role })
  })
}

export async function registerUser(data: {
  name: string
  email: string
  password?: string
  role?: UserRole
  department?: string
}): Promise<{ success: boolean; user: SystemUser; role: UserRole; roleLabel?: string }> {
  const headers = await authHeaders()
  return apiFetch<any>('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  })
}

