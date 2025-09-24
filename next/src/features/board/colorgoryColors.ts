export interface ColorgoryDef {
  id: 'cyan' | 'magenta' | 'yellow' | 'red' | 'green' | 'blue' | 'orange' | 'purple' | 'slate' 
  name: string
  hex: string
}

export const COLORGORY_DEFS: ColorgoryDef[] = [
  { id: 'cyan', name: 'Cyan', hex: '#00CFF5' },
  { id: 'magenta', name: 'Magenta', hex: '#FF00A8' },
  { id: 'yellow', name: 'Yellow', hex: '#FFDE00' },
  { id: 'red', name: 'Red', hex: '#EF4444' },
  { id: 'green', name: 'Green', hex: '#34D399' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6' },
  { id: 'orange', name: 'Orange', hex: '#F97316' },
  { id: 'purple', name: 'Purple', hex: '#8B5CF6' },
  { id: 'slate', name: 'Slate', hex: '#64748B' },
]

export const colorgoryHexById: Record<string, string> = COLORGORY_DEFS.reduce((acc, d) => {
  acc[d.id] = d.hex
  return acc
}, {} as Record<string, string>)


