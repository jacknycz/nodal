import React, { useState } from 'react';
import { useBoardStore } from '../../next/src/features/board/boardSlice';
import { TrashIcon } from 'lucide-react';

export default function TaskList({ className = '' }: { className?: string }) {
  const tasks = useBoardStore(state => state.tasks || []);
  const addTask = useBoardStore(state => state.addTask);
  const toggleTask = useBoardStore(state => state.toggleTask);
  const removeTask = useBoardStore(state => state.removeTask);
  const [input, setInput] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      addTask(input.trim());
      setInput('');
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-72 mt-2 ${className}`}
         style={{ minWidth: 240 }}>
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Board Tasks</h3>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        />
        <button type="submit" className="px-3 py-1 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600">Add</button>
      </form>
      <ul className="space-y-2">
        {tasks.length === 0 && <li className="text-gray-400 dark:text-gray-500 text-sm">No tasks yet.</li>}
        {tasks.map(task => (
          <li key={task.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className="accent-blue-500 w-4 h-4"
            />
            <span className={`flex-1 text-sm ${task.completed ? 'line-through text-gray-400 dark:text-gray-400' : 'dark:text-gray-100'}`}>{task.text}</span>
            <button
              onClick={() => removeTask(task.id)}
              className="text-gray-400 hover:text-red-500 p-1"
              title="Delete task"
            >
              <TrashIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
} 