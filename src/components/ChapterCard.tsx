import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { GeneratedChapter } from '../types/novel';

interface ChapterCardProps {
  chapter: GeneratedChapter;
}

export function ChapterCard({ chapter }: ChapterCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullText = `Bab ${chapter.nomor_bab}: ${chapter.judul_bab}\n\n${chapter.isi_cerita}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const paragraphs = chapter.isi_cerita
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article
      id={`bab-${chapter.nomor_bab}`}
      className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 lg:p-10"
    >
      <header className="flex items-start justify-between gap-4 pb-6 mb-7 border-b border-zinc-100">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-2">
            <span className="font-mono font-medium uppercase tracking-wider text-zinc-700 tabular-nums">
              Bab {chapter.nomor_bab}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {chapter.jumlah_kata.toLocaleString('id-ID')} kata
            </span>
          </div>
          <h3 className="font-serif text-2xl sm:text-[26px] font-bold text-zinc-900 leading-snug">
            {chapter.judul_bab}
          </h3>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Salin teks Bab ${chapter.nomor_bab}`}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            copied
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Copy Bab</span>
            </>
          )}
        </button>
      </header>

      <div className="font-serif text-[16.5px] sm:text-[17px] leading-[1.85] text-zinc-800 max-w-[68ch] space-y-5">
        {paragraphs.map((para, idx) => (
          <p key={idx} className="text-pretty">
            {para}
          </p>
        ))}
      </div>
    </article>
  );
}
