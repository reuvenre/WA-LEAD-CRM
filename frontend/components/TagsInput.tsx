'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_TAGS = [
  'VIP', 'ממליץ', 'מחכה למחיר', 'ניסיון חינם', 'דחוף', 'קר', 'לידFB', 'אורגני',
];

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagsInput({ tags, onChange, disabled }: TagsInputProps) {
  const [input, setInput] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean || tags.includes(clean)) return;
    onChange([...tags, clean]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const unusedPresets = PRESET_TAGS.filter((p) => !tags.includes(p));

  return (
    <div className="space-y-2">
      {/* Tag chips */}
      <div
        className={cn(
          'min-h-[38px] flex flex-wrap gap-1.5 p-2 rounded-lg border border-surface-border bg-surface-muted cursor-text',
          disabled && 'opacity-60 pointer-events-none'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium"
          >
            <Tag className="w-2.5 h-2.5" />
            {tag}
            <button
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-brand-900 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowPresets(true)}
          onBlur={() => setTimeout(() => setShowPresets(false), 150)}
          placeholder={tags.length === 0 ? 'הוסף תגית...' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Preset tags */}
      {showPresets && unusedPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedPresets.map((tag) => (
            <button
              key={tag}
              onMouseDown={() => addTag(tag)}
              className="px-2 py-0.5 rounded-full border border-surface-border text-xs text-slate-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400">Enter או פסיק להוספה</p>
    </div>
  );
}
