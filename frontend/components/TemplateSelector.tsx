'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Zap, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Template } from '@/types';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  onSelect: (body: string) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.templates.list().then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, []);

  // Auto focus search
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Group by category
  const filtered = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.body.includes(search) ||
      t.category.includes(search)
  );

  const grouped = filtered.reduce<Record<string, Template[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 right-0 w-80 bg-white rounded-xl shadow-card border border-surface-border z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-muted">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-semibold text-slate-700">תבניות מהירות</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 transition text-slate-400"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-surface-border">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 right-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="חפש תבנית..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-8 pl-3 py-1.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Templates */}
      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            טוען תבניות...
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            לא נמצאו תבניות
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-surface-muted border-b border-surface-border/50">
                {category}
              </div>
              {items.map((template) => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  onSelect={() => {
                    onSelect(template.body);
                    onClose();
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TemplateItem({
  template,
  onSelect,
}: {
  template: Template;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-right px-4 py-2.5 hover:bg-brand-50 transition-colors',
        'border-b border-surface-border/40 last:border-0 group'
      )}
    >
      <p className="text-sm font-medium text-slate-700 group-hover:text-brand-700 transition-colors">
        {template.title}
      </p>
      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
        {template.body}
      </p>
    </button>
  );
}
