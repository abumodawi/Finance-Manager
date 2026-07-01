import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(dateStr))
}

export function formatMonth(dateStr: string) {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long'
  }).format(new Date(dateStr))
}

const SALARY_NOTE_RE = /^راتب\s+(\d{4}-\d{2})/

// Returns the salary month ("YYYY-MM") a deposit belongs to, or null if the
// transaction is not one of the auto-generated salary deposits. Used to collapse
// the many per-subcategory salary deposits into a single "الراتب" line.
export function salaryMonthOf(tx: { type: string; notes?: string | null }): string | null {
  if (tx.type !== 'deposit') return null
  const notes = tx.notes
  if (!notes) return null
  const m = notes.match(SALARY_NOTE_RE)
  return m ? m[1] : null
}
