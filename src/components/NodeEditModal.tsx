import React, { useState, useRef, useEffect } from 'react';
import TipTapEditor from './TipTapEditor';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, content: string, media: { url: string; alt?: string }[]) => void;
  initialTitle: string;
  initialContent: string;
  initialMedia: { url: string; alt?: string }[];
}

const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB

export default function NodeEditModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialTitle, 
  initialContent, 
  initialMedia 
}: NodeEditModalProps) {
  const [editTitleValue, setEditTitleValue] = useState(initialTitle);
  const [editContentValue, setEditContentValue] = useState(initialContent);
  const [editMedia, setEditMedia] = useState<{ url: string; alt?: string }[]>(initialMedia);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset values when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setEditTitleValue(initialTitle);
      setEditContentValue(initialContent);
      setEditMedia(initialMedia);
    }
  }, [isOpen, initialTitle, initialContent, initialMedia]);

  const handleSave = () => {
    onSave(editTitleValue, editContentValue, editMedia);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-w-md mx-4 shadow-xl w-full max-w-lg text-left flex flex-col items-start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <input 
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" 
            value={editTitleValue} 
            onChange={e => setEditTitleValue(e.target.value)}
            placeholder="Node title"
          />
          <div className="border rounded bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white">
            <TipTapEditor
              value={editContentValue}
              onChange={setEditContentValue}
              onImageAdd={imgUrl => {
                setEditMedia(prev => prev.some(img => img.url === imgUrl) ? prev : [...prev, { url: imgUrl }]);
              }}
              onImageDelete={imgUrl => {
                setEditMedia(prev => prev.filter(img => img.url !== imgUrl));
              }}
            />
          </div>
          <label className="block text-sm font-medium mt-3 mb-1 text-gray-700 dark:text-gray-200">Media (images, max 1MB each)</label>
          <div
            className="border-2 border-dashed rounded p-4 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer mb-2"
            tabIndex={0}
            role="button"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <span className="text-gray-400 dark:text-gray-500">Drag & drop images here or click to upload</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                files.forEach(file => {
                  if (file.size > MAX_IMAGE_SIZE) {
                    alert('Image must be less than 1MB');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      setEditMedia(prev => prev.some(img => img.url === reader.result) ? prev : [...prev, { url: reader.result as string }]);
                    }
                  };
                  reader.readAsDataURL(file);
                });
                e.target.value = '';
              }}
            />
          </div>
          {editMedia.length > 0 && (
            <div className="flex flex-row flex-wrap gap-2 mt-2">
              {editMedia.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img.url} alt={img.alt || `edit-media-${idx}`} className="w-16 h-16 object-cover rounded shadow border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
                  <button
                    className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 text-xs"
                    onClick={() => {
                      setEditMedia(prev => prev.filter((_, i) => i !== idx));
                      setEditContentValue(content =>
                        (content || '').replace(
                          new RegExp(`<img[^>]+src=["']${img.url}["'][^>]*>`, 'g'),
                          ''
                        )
                      );
                    }}
                    title="Remove image"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-primary-600 text-white" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
} 