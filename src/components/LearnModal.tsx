import React from 'react';
import { X } from 'lucide-react';

interface LearnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LearnModal({ isOpen, onClose }: LearnModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700">
        <button
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Welcome to Nodal!</h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Nodal is your collaborative mindmapping and knowledge-building space, powered by AI.
        </p>
        <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 space-y-2 text-sm mb-4">
          <li>Double-click to add a node</li>
          <li>Drag to pan the board</li>
          <li>Right-click for context menu</li>
          <li>Use AI to brainstorm and expand your ideas</li>
          <li>Press Ctrl+F to search nodes</li>
          <li>Click a node to edit</li>
          <li>Use Free Chat Mode for open conversation</li>
          <li>Connect nodes to build your map</li>
          <li>Try uploading a PDF</li>
        </ul>
        <p className="text-gray-600 dark:text-gray-400 text-xs">
          Explore, create, and connect ideas. Nodal is here to help you think deeper and build better knowledge.
        </p>
      </div>
    </div>
  );
} 