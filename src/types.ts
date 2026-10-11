export type CodeMatch = 'valid_unused' | 'not_found' | 'already_used' | 'status_unknown'
export type Category = 'Genuine' | 'Low Suspicion' | 'Medium Suspicion' | 'High Suspicion' | 'Critical'
export type CaseStatus = 'closed' | 'open' | 'confirmed' | 'not_confirmed'

export interface Product {
  name: string; category: string; manufacturer: string; batch: string; expiry: string
  piecesPerPack?: number
  status: 'valid' | 'flagged' | 'unknown'   // unknown means the record has no explicit validity status
}
export interface Scan {
  id: string; barcode: string; productName: string; codeMatch: CodeMatch
  similarity?: number; category: Category; location: string; device: string
  caseStatus: CaseStatus; createdAt: number
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  medicineType?: string; manufacturer?: string; batch?: string; expiry?: string
  piecesPerPack?: number; registryStatus?: Product['status'] | 'not_found'
  productDetails?: Record<string, unknown>
}
