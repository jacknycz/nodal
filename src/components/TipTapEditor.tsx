import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

interface TipTapEditorProps {
  value: string;
  onChange: (content: string) => void;
  onImageAdd?: (url: string) => void;
  onImageDelete?: (url: string) => void;
}

const TipTapEditor: React.FC<TipTapEditorProps> = ({ value, onChange, onImageAdd, onImageDelete }) => {
  const lastImagesRef = useRef<string[]>([]);
  const [editorState, setEditorState] = useState(0); // Force re-renders

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      // Image sync logic
      const doc = editor.state.doc;
      const images: string[] = [];
      doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs.src) {
          images.push(node.attrs.src);
        }
      });
      // Detect added images
      images.forEach((img) => {
        if (!lastImagesRef.current.includes(img) && onImageAdd) {
          onImageAdd(img);
        }
      });
      // Detect deleted images
      lastImagesRef.current.forEach((img) => {
        if (!images.includes(img) && onImageDelete) {
          onImageDelete(img);
        }
      });
      lastImagesRef.current = images;
    },
  });

  // Keep editor in sync with value prop
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Listen for editor state changes to update toolbar active states
  useEffect(() => {
    if (editor) {
      const updateToolbar = () => {
        setEditorState(prev => prev + 1);
      };
      
      editor.on('transaction', updateToolbar);
      
      return () => {
        editor.off('transaction', updateToolbar);
      };
    }
  }, [editor]);

  // Toolbar actions
  const setImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        alert('Image must be less than 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor?.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="tiptap-editor border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
        <button
          type="button"
          className={`flex p-2 text-sm border border-gray-200 dark:border-gray-700 rounded ${editor?.isActive('bold') ? 'font-bold text-primary-600' : ''}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >B</button>
        <button
          type="button"
          className={`flex p-2 text-sm border border-gray-200 dark:border-gray-700 rounded ${editor?.isActive('italic') ? 'italic text-primary-600' : ''}`}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >I</button>
        <button
          type="button"
          className={`flex p-2 text-sm border border-gray-200 dark:border-gray-700 rounded ${editor?.isActive('bulletList') ? 'text-primary-600' : ''}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >• List</button>
        <button
          type="button"
          className="flex p-2 text-sm border border-gray-200 dark:border-gray-700 rounded"
          onClick={setImage}
        >Image</button>
      </div>
      <EditorContent editor={editor} className="focus:outline-none" />
    </div>
  );
};

export default TipTapEditor; 