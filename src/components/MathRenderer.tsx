'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  block?: boolean;
  inline?: boolean;
}

/**
 * Safely parses and renders text containing inline ($...$) and block ($$...$$) KaTeX mathematical formulas.
 */
export function MathRenderer({ content, className = '', block = false, inline = false }: MathRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    // Pattern to match $$block math$$ and $inline math$
    // Using a regex with lookbehinds to avoid matching escaped \$
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Push preceding text
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>
        );
      }

      const matchText = match[0];
      const isBlock = matchText.startsWith('$$') && matchText.endsWith('$$');
      const mathExpr = isBlock
        ? matchText.slice(2, -2).trim()
        : matchText.slice(1, -1).trim();

      try {
        const html = katex.renderToString(mathExpr, {
          displayMode: isBlock || block,
          throwOnError: false,
          output: 'htmlAndMathml',
        });

        parts.push(
          <span
            key={`math-${match.index}`}
            dangerouslySetInnerHTML={{ __html: html }}
            className={`inline-math ${isBlock ? 'block my-3 text-center overflow-x-auto py-1' : 'inline-block mx-0.5'}`}
          />
        );
      } catch (err) {
        parts.push(
          <span
            key={`err-${match.index}`}
            className="font-mono text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1 rounded"
          >
            {matchText}
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {content.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [content, block]);

  if (inline) {
    return <span className={`font-sans leading-relaxed ${className}`}>{renderedContent}</span>;
  }

  return <div className={`font-sans leading-relaxed ${className}`}>{renderedContent}</div>;
}

export function MathCheatSheetPopover() {
  const [open, setOpen] = React.useState(false);

  const CHEATSHEET = [
    { label: 'Inline Formula', code: '$E = mc^2$', preview: 'E = mc^2' },
    { label: 'Block Equation', code: '$$\\int_a^b f(x) dx = F(b) - F(a)$$', preview: '\\int_a^b f(x) dx = F(b) - F(a)' },
    { label: 'Fractions', code: '$\\frac{a}{b}$', preview: '\\frac{a}{b}' },
    { label: 'Superscript & Subscript', code: '$x_1^2 + y_1^2 = r^2$', preview: 'x_1^2 + y_1^2 = r^2' },
    { label: 'Square Root', code: '$\\sqrt{x^2 + y^2}$', preview: '\\sqrt{x^2 + y^2}' },
    { label: 'Greek Symbols', code: '$\\alpha, \\beta, \\theta, \\lambda, \\pi, \\Delta$', preview: '\\alpha, \\beta, \\theta, \\lambda, \\pi, \\Delta' },
    { label: 'Vectors', code: '$\\vec{F} = m\\vec{a}$', preview: '\\vec{F} = m\\vec{a}' },
    { label: 'Summation & Limits', code: '$\\sum_{i=1}^n i, \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$', preview: '\\sum_{i=1}^n i, \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' },
    { label: 'Chemistry Reactions', code: '$2H_2 + O_2 \\rightarrow 2H_2O$', preview: '2H_2 + O_2 \\rightarrow 2H_2O' },
  ];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        <span>📐 KaTeX Math Format Guide</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>📐 KaTeX Formula Cheat Sheet</span>
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Type formulas directly inside your study notes and task details:
              <br />
              Use <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600">$...$</code> for inline formulas, and <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600">$$...$$</code> for centered block equations.
            </p>

            <div className="space-y-2.5">
              {CHEATSHEET.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {item.label}
                    </span>
                    <code className="block text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded">
                      {item.code}
                    </code>
                  </div>
                  <div className="text-xs py-1 px-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                    <MathRenderer content={item.code} />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
