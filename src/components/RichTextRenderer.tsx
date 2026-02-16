
import React from 'react';

interface RichTextRendererProps {
  content: string;
  className?: string;
  variant?: 'light' | 'dark';
  isTyping?: boolean;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({ 
  content, 
  className = "", 
  variant = 'dark',
  isTyping = false 
}) => {
  if (!content) return null;

  // Split by newlines
  const lines = content.split('\n');
  
  const parseInline = (text: string) => {
    // Split by bold (**), italic (_), and inline code (`)
    const parts = text.split(/(\*\*.*?\*\*)|(`[^`]+`)|(_.*?_)/g).filter(part => part !== undefined && part !== "");
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
          return (
              <code key={index} className={`font-mono text-xs px-1.5 py-0.5 rounded border ${variant === 'light' ? 'bg-indigo-700 border-indigo-500 text-indigo-100' : 'bg-slate-100 border-slate-200 text-rose-600'}`}>
                  {part.slice(1, -1)}
              </code>
          );
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getTextColor = () => {
      if (variant === 'light') return 'text-white';
      return 'text-slate-700';
  };

  const getHeaderColor = () => {
      if (variant === 'light') return 'text-indigo-100';
      return 'text-slate-900';
  };

  const getBulletColor = () => {
      if (variant === 'light') return 'bg-indigo-300';
      return 'bg-indigo-500';
  };

  return (
    <div className={`space-y-1.5 text-sm leading-relaxed ${getTextColor()} ${className}`}>
      {lines.map((line, i) => {
        const isLastLine = i === lines.length - 1;
        const trimmed = line.trim();
        
        const cursor = isTyping && isLastLine ? (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-current opacity-70 animate-pulse align-middle" />
        ) : null;

        if (!trimmed) {
            // If it's the last line and typing, show cursor on new line
            if (isLastLine && isTyping) return <div key={i} className="h-4">{cursor}</div>;
            return <div key={i} className="h-2" />;
        }

        // Headers
        if (trimmed.startsWith('### ')) return <h4 key={i} className={`font-bold text-sm mt-2 ${getHeaderColor()}`}>{parseInline(trimmed.substring(4))}{cursor}</h4>;
        if (trimmed.startsWith('## ')) return <h3 key={i} className={`font-bold text-base mt-3 border-b pb-1 ${variant === 'light' ? 'border-indigo-400/30' : 'border-slate-200 text-slate-800'}`}>{parseInline(trimmed.substring(3))}{cursor}</h3>;
        if (trimmed.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{parseInline(trimmed.substring(2))}{cursor}</h2>;

        // Blockquotes
        if (trimmed.startsWith('> ')) {
            return (
                <div key={i} className={`border-l-4 pl-3 py-1 my-2 italic ${variant === 'light' ? 'border-indigo-300 text-indigo-100' : 'border-indigo-500 text-slate-500 bg-slate-50 rounded-r'}`}>
                    {parseInline(trimmed.substring(2))}{cursor}
                </div>
            );
        }

        // Bullet Points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const content = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div key={i} className="flex gap-2 ml-1 items-start">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${getBulletColor()}`} />
              <span>{parseInline(content)}{cursor}</span>
            </div>
          );
        }

        // Numbered Lists
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
           return (
            <div key={i} className="flex gap-2 ml-1 items-start">
              <span className={`font-bold shrink-0 ${variant === 'light' ? 'text-indigo-200' : 'text-slate-500'}`}>{numMatch[1]}.</span>
              <span>{parseInline(numMatch[2])}{cursor}</span>
            </div>
           );
        }

        // Horizontal Rule
        if (trimmed === '---' || trimmed === '***') {
            return <hr key={i} className={`my-3 ${variant === 'light' ? 'border-indigo-400' : 'border-slate-200'}`} />;
        }

        // Standard Text
        return <div key={i}>{parseInline(line)}{cursor}</div>;
      })}
    </div>
  );
};
