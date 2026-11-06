import React, { useEffect, useRef, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';

interface BluebookNotesModalProps {
  questionNumber: number;
  value: string;
  onChange: (nextValue: string) => void;
  onClose: () => void;
}

export const BluebookNotesModal: React.FC<BluebookNotesModalProps> = ({
  questionNumber,
  value,
  onChange,
  onClose,
}) => {
  const [position, setPosition] = useState(() => {
    const defaultX =
      typeof window !== 'undefined'
        ? Math.max(16, window.innerWidth - 400)
        : 860;
    return { x: defaultX, y: 124 };
  });
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const nextX = Math.max(
        8,
        Math.min(window.innerWidth - 260, e.clientX - dragOffsetRef.current.x)
      );
      const nextY = Math.max(
        48,
        Math.min(window.innerHeight - 120, e.clientY - dragOffsetRef.current.y)
      );
      setPosition({ x: nextX, y: nextY });
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: 'min(360px, 92vw)',
        height: 'min(340px, 65vh)',
      }}
      role="dialog"
      aria-label="Notes"
      className="fixed z-50 flex flex-col bg-[#FCF9F4] dark:bg-slate-900 text-stone-900 dark:text-slate-100 border-2 border-stone-800 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Draggable Dark Header Bar (Matches Calculator & Reference Sheet) */}
      <div
        onMouseDown={startDrag}
        className="bg-[#1E1E1E] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none shrink-0"
      >
        <span className="text-xs font-bold tracking-tight">
          Notes (Question {questionNumber})
        </span>

        <div className="flex items-center text-stone-400">
          <GripHorizontal className="w-4 h-4" />
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close Notes"
          className="p-1 rounded hover:bg-white/15 text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Plain Text Scratchpad Area — No Extra Controls */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type notes for this question..."
        aria-label={`Notes for question ${questionNumber}`}
        className="flex-1 w-full resize-none bg-[#FCF9F4] dark:bg-slate-900 p-4 text-sm leading-relaxed text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-none select-text font-sans"
      />
    </div>
  );
};
