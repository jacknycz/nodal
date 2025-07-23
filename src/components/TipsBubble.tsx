import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface TipsBubbleProps {
  tips: string[];
}

export default function TipsBubble({ tips }: TipsBubbleProps) {
  const [index, setIndex] = useState(0);
  const nextTip = () => setIndex((i) => (i + 1) % tips.length);
  return (
    <div className="flex w-48 h-12 items-center justify-between gap-2 bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 shadow-lg text-xs text-gray-700 dark:text-gray-200 select-none">
      <span>{tips[index]}</span>
      <button
        className="ml-1 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        onClick={nextTip}
        aria-label="Next tip"
        type="button"
      >
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
} 