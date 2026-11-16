import { AlertTriangle, X } from 'lucide-react';

interface ConfirmResetModalProps {
  isOpen: boolean;
  novelTitle?: string | null;
  chaptersCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmResetModal({
  isOpen,
  novelTitle,
  chaptersCount,
  onConfirm,
  onCancel,
}: ConfirmResetModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-zinc-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h2 id="reset-modal-title" className="text-base font-bold">
              Mulai Novel Baru?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup konfirmasi"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3 text-sm text-zinc-600 leading-relaxed">
          <p>
            Tindakan ini akan menghapus seluruh data yang tersimpan di layar dan{' '}
            <span className="font-medium text-zinc-800">LocalStorage</span>
            {novelTitle ? (
              <>
                {' '}
                untuk novel <strong className="text-zinc-900">&ldquo;{novelTitle}&rdquo;</strong>
                {chaptersCount > 0 ? ` (${chaptersCount} bab)` : ''}
              </>
            ) : (
              ''
            )}
            .
          </p>
          <p className="text-xs text-zinc-500">
            Pastikan Anda sudah mengunduh file <strong>Simpan Project (.JSON)</strong> atau <strong>Export ke PDF</strong> jika ingin menyimpan progres saat ini.
          </p>
        </div>

        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-lg transition-colors whitespace-nowrap"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Ya, Mulai Novel Baru
          </button>
        </div>
      </div>
    </div>
  );
}
