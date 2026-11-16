import { useRef, useState } from 'react';
import { BookOpen, FolderUp, Loader2, Square } from 'lucide-react';
import {
  GENRE_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  type GenerationPhase,
  type NovelConfig,
  type NovelGenre,
  type TargetAudience,
} from '../types/novel';
import {
  parseProjectJsonFile,
  type ProjectJsonPayload,
} from '../utils/projectFile';

interface NovelConfigSidebarProps {
  config: NovelConfig;
  phase: GenerationPhase;
  currentChapterWriting: number;
  completedChaptersCount: number;
  cooldownSeconds: number;
  onChange: (next: NovelConfig) => void;
  onGenerate: () => void;
  onCancel: () => void;
  onImportProject: (payload: ProjectJsonPayload) => void;
}

const SAMPLE_SYNOPSIS =
  'Di kota pelabuhan tua bernama Pelita Senja yang selalu diselimuti kabut laut, seorang pembuat jam muda bernama Raka mewarisi sebuah arloji saku kuningan dari mendiang ayahnya. Suatu malam saat badai besar melanda, ia menyadari jarum arloji itu mulai berputar mundur dan memundurkan waktu kota selama tepat dua belas menit setiap kali berdentang. Bersama Nadia, seorang jurnalis lokal yang menyelidiki hilangnya tiga kapal nelayan di perairan yang sama, Raka menemukan bahwa arloji itu terhubung dengan sebuah perjanjian masa lalu yang harus ditebus sebelum fajar hari ketujuh tiba.';

export function NovelConfigSidebar({
  config,
  phase,
  currentChapterWriting,
  completedChaptersCount,
  cooldownSeconds,
  onChange,
  onGenerate,
  onCancel,
  onImportProject,
}: NovelConfigSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const isGenerating =
    phase === 'outlining' || phase === 'writing' || phase === 'cooldown';

  const totalSteps = config.chapterCount + 1;
  const completedSteps =
    phase === 'outlining'
      ? 0
      : phase === 'writing' || phase === 'cooldown'
        ? 1 + completedChaptersCount
        : phase === 'completed'
          ? totalSteps
          : 0;
  const progressPercent = isGenerating
    ? Math.min(98, Math.max(6, Math.round((completedSteps / totalSteps) * 100)))
    : phase === 'completed'
      ? 100
      : 0;

  const statusText =
    phase === 'outlining'
      ? 'Menyusun kerangka cerita (Outline) dan judul novel...'
      : phase === 'cooldown'
        ? `Jeda kuota ${cooldownSeconds} dtk sebelum Bab ${currentChapterWriting}...`
        : phase === 'writing'
          ? `Sedang menulis Bab ${currentChapterWriting} dari ${config.chapterCount}...`
          : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGenerating) {
      onGenerate();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const payload = await parseProjectJsonFile(file);
      onImportProject(payload);
      setImportSuccess(
        `Project "${payload.outline.judul_novel}" berhasil dimuat.`
      );
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Gagal membaca file project (.JSON).'
      );
    }
  };

  return (
    <aside
      id="konfigurasi"
      className="w-full lg:w-[400px] xl:w-[430px] shrink-0"
    >
      <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-7 lg:sticky lg:top-24">
        <div className="mb-6 pb-5 border-b border-zinc-100 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Pengaturan Novel
            </h1>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Unggah file project JSON"
            />
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-300 hover:bg-zinc-100 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <FolderUp className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>Buka Project (.JSON)</span>
            </button>
          </div>

          <p className="text-sm text-zinc-600 leading-relaxed">
            Tentukan parameter cerita, atau buka kembali file project yang pernah Anda simpan.
          </p>

          {importError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900"
            >
              {importError}
            </div>
          )}

          {importSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              {importSuccess}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Genre */}
          <div>
            <label
              htmlFor="novel-genre"
              className="block text-sm font-semibold text-zinc-800 mb-1.5"
            >
              Genre
            </label>
            <select
              id="novel-genre"
              value={config.genre}
              disabled={isGenerating}
              onChange={(e) =>
                onChange({ ...config, genre: e.target.value as NovelGenre })
              }
              className="w-full h-11 px-3.5 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-zinc-50 disabled:text-zinc-500 transition-colors"
            >
              {GENRE_OPTIONS.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Target Usia Pembaca */}
          <div>
            <label
              htmlFor="novel-audience"
              className="block text-sm font-semibold text-zinc-800 mb-1.5"
            >
              Target Usia Pembaca
            </label>
            <select
              id="novel-audience"
              value={config.targetAudience}
              disabled={isGenerating}
              onChange={(e) =>
                onChange({
                  ...config,
                  targetAudience: e.target.value as TargetAudience,
                })
              }
              className="w-full h-11 px-3.5 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-zinc-50 disabled:text-zinc-500 transition-colors"
            >
              {TARGET_AUDIENCE_OPTIONS.map((audience) => (
                <option key={audience} value={audience}>
                  {audience}
                </option>
              ))}
            </select>
          </div>

          {/* 3 & 4. Jumlah Bab & Minimal Kata per Bab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="novel-chapters"
                className="block text-sm font-semibold text-zinc-800 mb-1.5"
              >
                Jumlah Bab
              </label>
              <input
                id="novel-chapters"
                type="number"
                min={1}
                max={100}
                value={config.chapterCount}
                disabled={isGenerating}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (Number.isNaN(val)) {
                    onChange({ ...config, chapterCount: 1 });
                    return;
                  }
                  onChange({
                    ...config,
                    chapterCount: Math.min(100, Math.max(1, val)),
                  });
                }}
                className="w-full h-11 px-3.5 text-sm font-mono tabular-nums text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-zinc-50 disabled:text-zinc-500 transition-colors"
              />
              <p className="mt-1 text-xs text-zinc-500">Min 1 · Maks 100 bab</p>
            </div>

            <div>
              <label
                htmlFor="novel-min-words"
                className="block text-sm font-semibold text-zinc-800 mb-1.5"
              >
                Min. Kata per Bab
              </label>
              <input
                id="novel-min-words"
                type="number"
                min={200}
                max={6000}
                step={100}
                value={config.minWordsPerChapter}
                disabled={isGenerating}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (Number.isNaN(val)) {
                    onChange({ ...config, minWordsPerChapter: 1500 });
                    return;
                  }
                  onChange({
                    ...config,
                    minWordsPerChapter: Math.min(6000, Math.max(200, val)),
                  });
                }}
                className="w-full h-11 px-3.5 text-sm font-mono tabular-nums text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-zinc-50 disabled:text-zinc-500 transition-colors"
              />
              <p className="mt-1 text-xs text-zinc-500">Default 1.500 kata</p>
            </div>
          </div>

          {/* 5. Sinopsis Novel */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="novel-synopsis"
                className="block text-sm font-semibold text-zinc-800"
              >
                Sinopsis Novel
              </label>
              {!isGenerating && (
                <button
                  type="button"
                  onClick={() => onChange({ ...config, synopsis: SAMPLE_SYNOPSIS })}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline underline-offset-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                >
                  Isi Contoh Sinopsis
                </button>
              )}
            </div>
            <textarea
              id="novel-synopsis"
              rows={8}
              value={config.synopsis}
              disabled={isGenerating}
              onChange={(e) => onChange({ ...config, synopsis: e.target.value })}
              placeholder={
                'Panduan menulis sinopsis yang kuat:\n1. Tokoh utama & tujuannya (siapa dan apa yang ia perjuangkan).\n2. Konflik utama & antagonis atau rintangan terbesar.\n3. Latar dunia, waktu, dan atmosfer cerita.\n4. Titik balik atau arah akhir cerita yang diinginkan.'
              }
              className="w-full p-3.5 text-sm text-zinc-900 leading-relaxed bg-white border border-zinc-300 rounded-lg resize-y min-h-[180px] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-zinc-50 disabled:text-zinc-500 transition-colors placeholder:text-zinc-400"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500">
              <span>Minimal 20 karakter</span>
              <span className="font-mono tabular-nums">
                {config.synopsis.trim().length} karakter
              </span>
            </div>
          </div>

          {/* 6. Tombol Utama "Generate Novel" + Progress Bar */}
          <div className="pt-2">
            {!isGenerating ? (
              <button
                type="submit"
                disabled={config.synopsis.trim().length < 20}
                className="w-full h-12 px-5 flex items-center justify-center gap-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Generate Novel</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-800">
                    <span className="flex items-center gap-2 min-w-0">
                      <Loader2 className="w-4 h-4 text-blue-700 animate-spin shrink-0" />
                      <span className="truncate">{statusText}</span>
                    </span>
                    <span className="font-mono tabular-nums text-zinc-600 shrink-0">
                      {progressPercent}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-blue-700 transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>Hentikan Proses</span>
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}
