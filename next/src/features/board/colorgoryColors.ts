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
  cyan: '#E0F7FB',
  yellow: '#FDF7E1',
  magenta: '#FCE6F2',
  green: '#E7F5EB',
  red: '#FBE7E7',
  blue: '#E3ECFB',
  orange: '#FBE9DD',
  purple: '#ECE7F7',
  slate: '#E7E9ED',
}

// Back-compat: keep the original name pointing to dark mapping
export const colorgoryHexById: Record<string, string> = colorgoryHexByIdDark

// Helper to get the correct color for current theme (defaults to dark on server)
export function getColorgoryHex(id: string, isDark?: boolean): string {
  // First, check dynamic board store for custom colorgories and hex overrides
  try {
    // Lazy import to avoid circular require issues
    const { useBoardStore } = require('./boardSlice') as typeof import('./boardSlice')
    const colorgories = (useBoardStore?.getState?.() as any)?.colorgories as Array<{ id: string; color: string }> | undefined
    const entry = Array.isArray(colorgories) ? colorgories.find(c => c.id === id) : undefined
    if (entry && typeof entry.color === 'string') {
      const color = entry.color
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
        return color
      }
      // If color references a built-in id, use mapping below
      if (colorgoryHexByIdDark[color]) {
        const dark0 = typeof isDark === 'boolean'
          ? isDark
          : (typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true)
        const table0 = dark0 ? colorgoryHexByIdDark : colorgoryHexByIdLight
        return table0[color] || colorgoryHexByIdDark[color]
      }
    }
  } catch {}
  const dark = typeof isDark === 'boolean'
    ? isDark
    : (typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true)
  const table = dark ? colorgoryHexByIdDark : colorgoryHexByIdLight
  return table[id] || colorgoryHexByIdDark[id] || '#9ca3af'
}


