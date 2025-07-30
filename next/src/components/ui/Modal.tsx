import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, description, children, actions, className }) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-label="Close modal"
      />
      {/* Modal content */}
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 flex flex-col ${className || ''}`}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {title && <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h2>}
        {description && <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{description}</p>}
        <div className="flex-1">{children}</div>
        {actions && <div className="mt-6 flex gap-2 justify-end">{actions}</div>}
      </div>
    </div>,
    typeof window !== 'undefined' ? document.body : (null as any)
  );
};

export default Modal; 