import { useState } from 'react';
import {
  AlertCircle,
  BookText,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Download,
  FileJson,
  Loader2,
  Play,
} from 'lucide-react';
import type {
  GeneratedChapter,
  GenerationPhase,
  NovelConfig,
  NovelOutline,
} from '../types/novel';
import { ChapterCard } from './ChapterCard';

interface NovelOutputPanelProps {
  config: NovelConfig;
  outline: NovelOutline | null;
  chapters: GeneratedChapter[];
  phase: GenerationPhase;
  currentChapterWriting: number;
  cooldownSeconds: number;
  isRestoredDraft: boolean;
  errorMessage: string | null;
  linkedDriveFileName: string | null;
  onExportPdf: () => void;
  onExportProjectJson: () => void;
  onResumeFromNext: () => void;
  onOpenDriveModal: () => void;
}

export function NovelOutputPanel({
  config,
  outline,
  chapters,
  phase,
  currentChapterWriting,
  cooldownSeconds,
  isRestoredDraft,
  errorMessage,
  linkedDriveFileName,
  onExportPdf,
  onExportProjectJson,
  onResumeFromNext,
  onOpenDriveModal,
}: NovelOutputPanelProps) {
  const [showOutline, setShowOutline] = useState(true);
  const [imageError, setImageError] = useState(false);

  const totalWords = chapters.reduce((acc, ch) => acc + ch.jumlah_kata, 0);
  const isGenerating =
    phase === 'outlining' || phase === 'writing' || phase === 'cooldown';
  const canResume =
    (phase === 'cancelled' || phase === 'error') &&
    outline !== null &&
    chapters.length < outline.daftar_bab.length;

  const activeOutlineChapter = outline?.daftar_bab.find(
    (c) => c.nomor_bab === currentChapterWriting
  );

  // Empty State before any outline exists and not currently outlining
  if (!outline && phase !== 'outlining') {
    return (
      <section id="naskah" className="flex-1 min-w-0">
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-900"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Gagal Memulai Generasi Novel</p>
              <p className="mt-1 text-red-800">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-12 items-stretch">
            <div className="xl:col-span-6 p-8 sm:p-10 flex flex-col justify-center">
              <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">
                Studio Penulisan Bertahap
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-zinc-900 leading-tight">
                Wujudkan Sinopsis Menjadi Naskah Novel Utuh
              </h2>
              <p className="mt-4 text-sm sm:text-base text-zinc-600 leading-relaxed">
                Sistem menulis secara bertahap agar alur cerita panjang tetap konsisten, emosional, dan memenuhi target panjang kata di setiap bab.
              </p>

              <ol className="mt-7 space-y-4 border-t border-zinc-100 pt-6 text-sm">
                <li className="flex items-start gap-3">
                  <span className="font-mono text-xs font-semibold text-zinc-500 mt-0.5 tabular-nums">
                    01.
                  </span>
                  <span className="text-zinc-700 leading-relaxed">
                    <strong className="font-semibold text-zinc-900">
                      Tahap Kerangka (Outline):
                    </strong>{' '}
                    AI menyusun judul novel beserta ringkasan adegan untuk setiap bab dalam struktur JSON.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono text-xs font-semibold text-zinc-500 mt-0.5 tabular-nums">
                    02.
                  </span>
                  <span className="text-zinc-700 leading-relaxed">
                    <strong className="font-semibold text-zinc-900">
                      Penulisan Berurutan Real-Time:
                    </strong>{' '}
                    Bab 1 hingga bab terakhir ditulis satu per satu dengan teknik{' '}
                    <em>Show, Don&apos;t Tell</em> serta kesinambungan konteks antarbab.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono text-xs font-semibold text-zinc-500 mt-0.5 tabular-nums">
                    03.
                  </span>
                  <span className="text-zinc-700 leading-relaxed">
                    <strong className="font-semibold text-zinc-900">
                      Salin, PDF &amp; Google Drive:
                    </strong>{' '}
                    Setiap bab langsung tampil untuk disalin, diunduh sebagai buku PDF, atau disimpan ke Google Drive Anda.
                  </span>
                </li>
              </ol>

              <div className="mt-7 pt-5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={onOpenDriveModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Cloud className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Buka Naskah dari Google Drive</span>
                </button>
              </div>
            </div>

            <div className="xl:col-span-6 bg-zinc-100 min-h-[280px] xl:min-h-[460px] relative">
              {!imageError ? (
                <img
                  src="/src/assets/images/editorial_manuscript_desk_1794842168628.jpg"
                  alt="Meja kerja penulisan dengan buku catatan terbuka dan pena"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-zinc-500 bg-gradient-to-br from-zinc-100 to-zinc-200">
                  <BookText className="w-10 h-10 mb-3 text-zinc-400" />
                  <span className="font-serif text-base text-zinc-600">
                    Ruang Naskah KaryaNaskah
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="naskah" className="flex-1 min-w-0 space-y-6">
      {/* Error banner if an error occurred during generation */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-4 text-sm text-red-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Proses Generasi Terhenti</p>
              <p className="mt-1 text-red-800">{errorMessage}</p>
            </div>
          </div>
          {canResume && (
            <button
              type="button"
              onClick={onResumeFromNext}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
            >
              <Play className="w-3.5 h-3.5 shrink-0" />
              <span>Lanjutkan dari Bab {chapters.length + 1}</span>
            </button>
          )}
        </div>
      )}

      {/* Auto-saved LocalStorage / Project Recovery Banner */}
      {canResume && !errorMessage && (
        <div className="p-4 sm:p-5 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-zinc-800">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">
              {isRestoredDraft
                ? 'Progres Novel Siap Dilanjutkan'
                : 'Proses Penulisan Dijeda'}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed">
              {chapters.length} dari {outline?.daftar_bab.length} bab sudah dimuat. Klik tombol di samping untuk meneruskan penulisan tanpa mengulang dari awal.
            </p>
          </div>
          <button
            type="button"
            onClick={onResumeFromNext}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Play className="w-4 h-4 shrink-0" />
            <span>Lanjutkan dari Bab {chapters.length + 1}</span>
          </button>
        </div>
      )}

      {/* Stage 1 Loading Card before Outline arrives */}
      {!outline && phase === 'outlining' && (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 sm:p-10">
          <div className="flex items-center gap-3 text-blue-700 mb-3">
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
            <span className="text-sm font-semibold">
              Tahap 1 — Merancang Kerangka Novel ({config.chapterCount} Bab)
            </span>
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed max-w-xl">
            AI sedang menyusun judul novel, premis cerita, dan rencana adegan untuk seluruh bab agar alur cerita menyatu dari awal hingga akhir.
          </p>
        </div>
      )}

      {/* Novel Master Header & Export PDF Action */}
      {outline && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-3">
                <span>{config.genre}</span>
                <span aria-hidden="true">·</span>
                <span>{config.targetAudience}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {chapters.length} dari {outline.daftar_bab.length} Bab
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {totalWords.toLocaleString('id-ID')} Kata
                </span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-zinc-900 leading-tight">
                {outline.judul_novel}
              </h2>

              {outline.premisa_singkat && (
                <p className="mt-3 text-base text-zinc-600 leading-relaxed max-w-[68ch]">
                  {outline.premisa_singkat}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {canResume && !errorMessage && (
                <button
                  type="button"
                  onClick={onResumeFromNext}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Lanjutkan dari Bab {chapters.length + 1}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onExportProjectJson}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <FileJson className="w-4 h-4 text-zinc-700 shrink-0" />
                <span>Simpan Project (.JSON)</span>
              </button>

              <button
                type="button"
                onClick={onOpenDriveModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Cloud className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  {linkedDriveFileName ? 'Google Drive (Terhubung)' : 'Simpan ke Google Drive'}
                </span>
              </button>

              <button
                type="button"
                onClick={onExportPdf}
                disabled={chapters.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Export ke PDF</span>
              </button>
            </div>
          </div>

          {/* Quick Chapter Navigation */}
          {chapters.length > 0 && (
            <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="font-semibold text-zinc-500">Lompat ke Bab:</span>
              {chapters.map((ch) => (
                <a
                  key={ch.nomor_bab}
                  href={`#bab-${ch.nomor_bab}`}
                  className="font-mono tabular-nums text-zinc-700 hover:text-blue-700 hover:underline underline-offset-4 whitespace-nowrap"
                >
                  Bab {ch.nomor_bab}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stage 1 Outline Preview Section */}
      {outline && (
        <div
          id="kerangka"
          className="bg-white border border-zinc-200 rounded-xl overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setShowOutline((prev) => !prev)}
            aria-expanded={showOutline}
            className="w-full px-6 sm:px-8 py-4 flex items-center justify-between gap-4 text-left hover:bg-zinc-50/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
          >
            <div>
              <span className="text-sm font-semibold text-zinc-900">
                Kerangka Cerita ({outline.daftar_bab.length} Bab)
              </span>
              <span className="ml-2 text-xs text-zinc-500">
                Rencana adegan hasil Tahap 1
              </span>
            </div>
            {showOutline ? (
              <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
            )}
          </button>

          {showOutline && (
            <div className="px-6 sm:px-8 pb-6 border-t border-zinc-100 divide-y divide-zinc-100">
              {outline.daftar_bab.map((item) => {
                const isDone = chapters.some((c) => c.nomor_bab === item.nomor_bab);
                const isActive =
                  isGenerating && currentChapterWriting === item.nomor_bab;
                return (
                  <div key={item.nomor_bab} className="py-3.5 flex items-start gap-4">
                    <span className="font-mono text-xs font-semibold text-zinc-500 tabular-nums pt-0.5 w-12 shrink-0">
                      Bab {item.nomor_bab}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900">
                          {item.judul_bab}
                        </p>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          {isDone
                            ? 'Selesai ditulis'
                            : isActive
                              ? 'Sedang ditulis...'
                              : 'Menunggu giliran'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed">
                        {item.ringkasan_adegan}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Real-time Generated Chapters List */}
      {chapters.map((chapter) => (
        <ChapterCard key={chapter.nomor_bab} chapter={chapter} />
      ))}

      {/* Active Chapter Writing or Cooldown Placeholder */}
      {phase === 'cooldown' && activeOutlineChapter && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-3 text-amber-700 mb-3">
            <Clock className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold font-mono tabular-nums">
              Jeda Otomatis Anti-Limit Kuota — Melanjutkan dalam {cooldownSeconds} detik...
            </span>
          </div>
          <h3 className="font-serif text-xl font-bold text-zinc-900">
            Berikutnya — Bab {activeOutlineChapter.nomor_bab}: {activeOutlineChapter.judul_bab}
          </h3>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed max-w-[68ch]">
            Bab sebelumnya sudah tersimpan otomatis. Aplikasi memberi jeda 10 detik antar bab agar permintaan API tetap aman di bawah batas kuota per menit (RPM).
          </p>
        </div>
      )}

      {phase === 'writing' && activeOutlineChapter && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-3 text-blue-700 mb-3">
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
            <span className="text-sm font-semibold">
              Sedang menulis Bab {activeOutlineChapter.nomor_bab} dari{' '}
              {outline?.daftar_bab.length ?? config.chapterCount}...
            </span>
          </div>
          <h3 className="font-serif text-xl font-bold text-zinc-900">
            Bab {activeOutlineChapter.nomor_bab}: {activeOutlineChapter.judul_bab}
          </h3>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed max-w-[68ch]">
            {activeOutlineChapter.ringkasan_adegan}
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            Menargetkan minimal {config.minWordsPerChapter.toLocaleString('id-ID')} kata dengan gaya bahasa {config.genre} untuk pembaca {config.targetAudience}.
          </p>
        </div>
      )}
    </section>
  );
}
