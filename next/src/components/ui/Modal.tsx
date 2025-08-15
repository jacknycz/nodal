import React, { useEffect, useState } from 'react'
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
  onStepChange
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      // Small delay to ensure the element is in the DOM before animating
      requestAnimationFrame(() => {
        setIsVisible(true)
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
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black backdrop-blur-sm transition-all duration-200 ease-out ${
          isVisible ? 'bg-opacity-40' : 'bg-opacity-0'
        }`}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
        aria-label="Close modal"
      />
      {/* Modal content */}
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-4xl shadow-2xl max-w-lg w-full mx-4 p-6 flex flex-col transition-all duration-200 ease-out ${
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
        <div className="flex-1">{children}</div>
        {actions && <div className="mt-6 flex gap-2 justify-end">{actions}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal; 