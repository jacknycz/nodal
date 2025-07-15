import React, { useState } from 'react'
import type { BoardBrief } from '../features/board/boardTypes'

interface BoardSetupModalProps {
  isOpen: boolean
  onComplete: (brief: BoardBrief & { uploadedFiles?: File[] }) => void
  onClose: () => void
}

const GOAL_OPTIONS = [
  'Freeform',
  'Solve a Problem',
  'Brainstorm Ideas',
  'Explore a Topic',
  'Other',
]

const AUDIENCE_OPTIONS = [
  'Personal',
  'Team',
  'Project',
  'Other',
]

const AI_HELP_OPTIONS = [
  'Suggest',
  'Expand',
  'Challenge',
  'Summarize',
]

export default function BoardSetupModal({ isOpen, onComplete, onClose }: BoardSetupModalProps) {
  const [step, setStep] = useState(0)
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [goalOther, setGoalOther] = useState('')
  const [audience, setAudience] = useState('')
  const [audienceOther, setAudienceOther] = useState('')
  const [resources, setResources] = useState<string[]>([])
  const [resourceInput, setResourceInput] = useState('')
  const [aiHelpPreferences, setAIHelpPreferences] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const steps = [
    {
      label: 'What are you brainstorming?',
      content: (
        <div>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="e.g. Marketing Plan, Research Project, App Idea..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            autoFocus
          />
        </div>
      ),
      canContinue: !!topic.trim(),
    },
    {
      label: 'What’s your goal?',
      content: (
        <div>
          <select
            className="w-full px-3 py-2 border rounded-lg mb-2"
            value={goal}
            onChange={e => setGoal(e.target.value)}
          >
            <option value="">Select a goal...</option>
            {GOAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {goal === 'Other' && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Describe your goal..."
              value={goalOther}
              onChange={e => setGoalOther(e.target.value)}
            />
          )}
        </div>
      ),
      canContinue: goal && (goal !== 'Other' || !!goalOther.trim()),
    },
    {
      label: 'Who’s this for?',
      content: (
        <div>
          <select
            className="w-full px-3 py-2 border rounded-lg mb-2"
            value={audience}
            onChange={e => setAudience(e.target.value)}
          >
            <option value="">Select audience...</option>
            {AUDIENCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {audience === 'Other' && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Describe the audience..."
              value={audienceOther}
              onChange={e => setAudienceOther(e.target.value)}
            />
          )}
        </div>
      ),
      canContinue: audience && (audience !== 'Other' || !!audienceOther.trim()),
    },
    {
      label: 'Any resources or background to bring in?',
      content: (
        <div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 border rounded-lg"
              placeholder="Paste a link, note, or context..."
              value={resourceInput}
              onChange={e => setResourceInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && resourceInput.trim()) {
                  setResources([...resources, resourceInput.trim()])
                  setResourceInput('')
                }
              }}
            />
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded-lg"
              onClick={() => {
                if (resourceInput.trim()) {
                  setResources([...resources, resourceInput.trim()])
                  setResourceInput('')
                }
              }}
              type="button"
            >
              Add
            </button>
          </div>
          <ul className="mb-2">
            {resources.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm mb-1">
                <span>{r}</span>
                <button
                  className="text-red-500 hover:underline"
                  onClick={() => setResources(resources.filter((_, idx) => idx !== i))}
                  type="button"
                >Remove</button>
              </li>
            ))}
          </ul>
          {/* Document upload input */}
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload documents (PDF, TXT, etc):</label>
            <input
              type="file"
              multiple
              onChange={e => {
                const files = e.target.files;
                if (!files) return;
                setUploadedFiles(prev => [...prev, ...Array.from(files)]);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadedFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {uploadedFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <span>{file.name}</span>
                    <button
                      className="text-red-500 hover:underline"
                      type="button"
                      onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))}
                    >Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ),
      canContinue: true,
    },
    {
      label: 'How do you want the AI to help?',
      content: (
        <div className="flex flex-wrap gap-2">
          {AI_HELP_OPTIONS.map(opt => (
            <label key={opt} className={`px-3 py-2 rounded-lg border cursor-pointer ${aiHelpPreferences.includes(opt) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>
              <input
                type="checkbox"
                className="mr-2"
                checked={aiHelpPreferences.includes(opt)}
                onChange={e => {
                  if (e.target.checked) setAIHelpPreferences([...aiHelpPreferences, opt])
                  else setAIHelpPreferences(aiHelpPreferences.filter(a => a !== opt))
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      ),
      canContinue: aiHelpPreferences.length > 0,
    },
    {
      label: 'Any notes or context?',
      content: (
        <textarea
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Anything else you want to share before starting?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      ),
      canContinue: true,
    },
  ]

  const handleNext = () => setStep(s => Math.min(s + 1, steps.length - 1))
  const handleBack = () => setStep(s => Math.max(s - 1, 0))
  const handleFinish = () => {
    onComplete({
      topic: topic.trim(),
      goal: goal === 'Other' ? goalOther.trim() : goal,
      audience: audience === 'Other' ? audienceOther.trim() : audience,
      resources,
      aiHelpPreferences,
      notes: notes.trim() || undefined,
      isReady: true,
      preSessionChat: [],
      uploadedFiles,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <div className="text-xs text-gray-500 mb-1">Step {step + 1} of {steps.length}</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{steps[step].label}</h2>
        </div>
        <form onSubmit={e => { e.preventDefault(); steps[step].canContinue && (step === steps.length - 1 ? handleFinish() : handleNext()) }}>
          {steps[step].content}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
              onClick={step === 0 ? onClose : handleBack}
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${steps[step].canContinue ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
              disabled={!steps[step].canContinue}
            >
              {step === steps.length - 1 ? 'Start Pre-Session Chat' : 'Next'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 