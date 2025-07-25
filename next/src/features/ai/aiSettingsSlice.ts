import { create } from 'zustand'
import type { OpenAIModel } from './aiTypes'

interface AISettingsState {
  model: OpenAIModel
  positionStrategy: string
  temperature: number
  setModel: (model: OpenAIModel) => void
  setPositionStrategy: (strategy: string) => void
  setTemperature: (temp: number) => void
}

export const useAISettingsStore = create<AISettingsState>((set) => ({
  model: 'gpt-4o-mini',
  positionStrategy: 'center',
  temperature: 0.7,
  setModel: (model) => set({ model }),
  setPositionStrategy: (positionStrategy) => set({ positionStrategy }),
  setTemperature: (temperature) => set({ temperature }),
})) 