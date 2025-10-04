export interface ColorgoryDef {
  id: 'cyan' | 'magenta' | 'yellow' | 'red' | 'green' | 'blue' | 'orange' | 'purple' | 'slate' 
  name: string
  hex: string
}

export const COLORGORY_DEFS: ColorgoryDef[] = [
  { id: 'cyan', name: 'Cyan', hex: '#00CFF5' },
  { id: 'yellow', name: 'Yellow', hex: '#FFDE00' },
  { id: 'magenta', name: 'Magenta', hex: '#FF00A8' },
  { id: 'green', name: 'Green', hex: '#34D399' },
  { id: 'red', name: 'Red', hex: '#EF4444' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6' },
  { id: 'orange', name: 'Orange', hex: '#F97316' },
  { id: 'purple', name: 'Purple', hex: '#8B5CF6' },
  { id: 'slate', name: 'Slate', hex: '#64748B' },
]

// Dark theme mapping (legacy/default)
export const colorgoryHexByIdDark: Record<string, string> = COLORGORY_DEFS.reduce((acc, d) => {
  acc[d.id] = d.hex
  return acc
}, {} as Record<string, string>)

// Light theme mapping
export const colorgoryHexByIdLight: Record<string, string> = {
  cyan: '#A7E8F2',
  yellow: '#F9E9A8',
  magenta: '#F4B6D9',
  green: '#B8E2C7',
  red: '#F2B8B8',
  blue: '#AEC8F5',
  orange: '#F5C19E',
  purple: '#C8B9E8',
  slate: '#B8BFCB',
}

// Back-compat: keep the original name pointing to dark mapping
export const colorgoryHexById: Record<string, string> = colorgoryHexByIdDark

// Helper to get the correct color for current theme (defaults to dark on server)
export function getColorgoryHex(id: string, isDark?: boolean): string {
  const dark = typeof isDark === 'boolean'
    ? isDark
    : (typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true)
  const table = dark ? colorgoryHexByIdDark : colorgoryHexByIdLight
  return table[id] || colorgoryHexByIdDark[id] || '#9ca3af'
}


