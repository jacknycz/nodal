export function getNodeContainerClasses({
  selected,
  isLocked,
  isLockedByMe,
  receiveMode,
  extra,
}: {
  selected?: boolean
  isLocked?: boolean
  isLockedByMe?: boolean
  receiveMode?: boolean
  extra?: string
}) {
  const base = 'relative flex flex-col justify-start text-left p-3 bg-white/90 dark:bg-gray-800 border border-2 border-transparent rounded-lg shadow-sm shadow-orange-950/20 dark:shadow-none group'
  const selectedCls = selected ? '!border-primary-500 bg-primary-50 dark:bg-primary-900/50 backdrop-blur-sm' : ''
  const lockedCls = isLocked && !isLockedByMe ? '!border-red-500 bg-red-50 dark:bg-red-900/20 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : ''
  const receiveCls = receiveMode ? 'ring-2 ring-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-900/10' : ''
  return [base, selectedCls, lockedCls, receiveCls, extra || ''].filter(Boolean).join(' ')
}

// Standard handle styling class for React Flow handles on nodes
export const NODE_HANDLE_CLASS = 'rf-handle-hit-32'


