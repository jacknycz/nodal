import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  // Multi-step support
  currentStep?: number
  totalSteps?: number
  onStepChange?: (step: number) => void
  // Control whether the body should scroll when content overflows
  scrollBody?: boolean
  // Optional custom classes for the backdrop color (supports light/dark)
  // Example: 'bg-white/60 dark:bg-black/60'
  backdropClassName?: string
  // If false, allow pointer interactions to pass through backdrop (board stays interactive)
  backdropInteractive?: boolean
  // If false, clicking the backdrop will not close the modal
  closeOnBackdropClick?: boolean
}

const Modal: React.FC<ModalProps> = ({ 
  open, 
  onClose, 
  title, 
  description, 
  children, 
  actions, 
  className,
  currentStep,
  totalSteps,
  onStepChange,
  scrollBody = true,
  backdropClassName,
  backdropInteractive = true,
  closeOnBackdropClick = true,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const openedAtRef = useRef<number>(0)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      // Small delay to ensure the element is in the DOM before animating
      requestAnimationFrame(() => {
        setIsVisible(true)
        openedAtRef.current = Date.now()
      })
    } else {
      setIsVisible(false)
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 200) // Match the transition duration
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!shouldRender) return null;

  // Only render if we're in the browser
  if (typeof window === 'undefined') return null;

  return ReactDOM.createPortal(
    <div className={`fixed inset-0 z-[900] flex items-center justify-center md:justify-start ${backdropInteractive ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${backdropClassName || 'bg-black'} transition-all duration-200 ease-out ${
          isVisible ? 'bg-opacity-40' : 'bg-opacity-0'
        } ${backdropInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={(e) => {
          if (!backdropInteractive || !closeOnBackdropClick) return
          e.stopPropagation()
          e.preventDefault()
          // Guard against immediate close when opened via click/tap
          if (Date.now() - (openedAtRef.current || 0) < 200) return
          onClose()
        }}
        aria-label="Close modal"
      />
      {/* Modal content */}
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-4xl shadow-2xl pointer-events-auto 
          max-w-lg w-full mx-4 p-6 flex flex-col transition-all duration-200 ease-out max-h-[85vh] overflow-hidden ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-1'
        } ${className || ''}`}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {/* Step indicator */}
        {totalSteps && totalSteps > 1 && (
          <div className="flex items-center justify-center mb-4">
            <div className="flex space-x-2">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                    i < (currentStep || 0) 
                      ? 'bg-primary-200' 
                      : i === (currentStep || 0) 
                        ? 'bg-primary-500' 
                        : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {title && <h2 className="text-lg md:text-xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">{title}</h2>}
        {description && <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{description}</p>}
        <div className={`flex-1 min-h-0 h-full ${scrollBody ? 'overflow-y-auto' : 'overflow-hidden'}`}>{children}</div>
        {(() => {
          const hasActions = !!actions && (React.Children.count(actions as any) > 0)
          return hasActions ? (
            <div className="mt-6 flex gap-2 justify-end">{actions}</div>
          ) : null
        })()}
      </div>
    </div>,
    document.body
  );
};

export default Modal; 