'use client'

import { Robot } from '@phosphor-icons/react/dist/ssr'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'
import type { OpenAIModel } from '../features/ai/aiTypes'
import Menu from './ui/Menu'
import IconButton from './ui/IconButton'
import Select from './ui/Select'
import { MODELS } from '../features/ai/models'

interface AISettingsMenuProps {
  isTestMode?: boolean
  onToggleTestMode?: () => void
  className?: string
}



const POSITION_STRATEGIES = [
  { value: 'smart', label: 'Smart (Recommended)' },
  { value: 'radial', label: 'Radial' },
  { value: 'grid', label: 'Grid' },
  { value: 'manual', label: 'Manual' },
]

export default function AISettingsMenu({
  isTestMode = false,
  onToggleTestMode,
  className = ''
}: AISettingsMenuProps) {
  const { model, setModel, positionStrategy, setPositionStrategy, temperature, setTemperature } = useAISettingsStore()

  return (
    <Menu
      trigger={
        <IconButton
          aria-label="AI Settings"
        >
          <Robot size={24} className='w-5 h-5' />
        </IconButton>
      }
      width="w-64"
      customContent={
        <div className="p-4">
          <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100 text-sm">AI Settings</div>

          <div className="mb-3">
            <Select
              size="sm"
              fullWidth
              aria-label="AI Model"
              value={model}
              options={MODELS}
              onChange={(v) => setModel(v as OpenAIModel)}
            />
          </div>

          <div className="mb-3">
            <Select
              size="sm"
              fullWidth
              aria-label="Position Strategy"
              value={positionStrategy}
              options={POSITION_STRATEGIES}
              onChange={(v) => setPositionStrategy(v)}
            />
          </div>

          <div className="mb-1">
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Creativity (Temperature: {temperature})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>
        </div>
      }
      className={className}
    />
  )
}