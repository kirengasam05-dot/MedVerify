import type { Category, CodeMatch } from './types'

// Thresholds follow Table 3.2 of the proposal – recalibrate with Rwanda FDA outcomes.
export const level = (s: number) => (s >= 85 ? 'high' : s >= 60 ? 'moderate' : 'low')

export function classify(code: CodeMatch, similarity: number): Category {
  const ok = code === 'valid_unused'
  const l = level(similarity)
  if (ok && l === 'high') return 'Genuine'
  if (ok && l === 'moderate') return 'Low Suspicion'
  if (!ok && l === 'high') return 'Medium Suspicion'
  if (ok && l === 'low') return 'High Suspicion'
  if (!ok && l === 'moderate') return 'High Suspicion'
  return 'Critical'
}

export const actionFor: Record<Category, string> = {
  Genuine: 'Routine record & release',
  'Low Suspicion': 'Record; monitor',
  'Medium Suspicion': 'Flag for review',
  'High Suspicion': 'Prioritise investigation',
  Critical: 'Immediate investigation'
}

export const tone: Record<Category, string> = {
  Genuine: 'bg-genuine/10 text-genuine border-genuine/40',
  'Low Suspicion': 'bg-amber/10 text-amber border-amber/40',
  'Medium Suspicion': 'bg-amber/15 text-amber border-amber/60',
  'High Suspicion': 'bg-alert/10 text-alert border-alert/40',
  Critical: 'bg-alert text-white border-alert'
}
