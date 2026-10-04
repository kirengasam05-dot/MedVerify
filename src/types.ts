export type CodeMatch = 'valid_unused' | 'not_found' | 'already_used'
export type Category = 'Genuine' | 'Low Suspicion' | 'Medium Suspicion' | 'High Suspicion' | 'Critical'
export type CaseStatus = 'closed' | 'open' | 'confirmed' | 'not_confirmed'

export interface Product {
  name: string; category: string; manufacturer: string; batch: string; expiry: string
  status: 'valid' | 'flagged'   // flagged = reported used/compromised
}
export interface Scan {
  id: string; barcode: string; productName: string; codeMatch: CodeMatch
  similarity: number; category: Category; location: string; device: string
  caseStatus: CaseStatus; createdAt: number
}
