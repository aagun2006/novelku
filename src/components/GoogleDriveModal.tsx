import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  FolderOpen,
  Loader2,
  LogOut,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type {
  GeneratedChapter,
  NovelConfig,
  NovelOutline,
} from '../types/novel';
import {
  googleSignIn,
  logoutGoogle,
} from '../utils/googleAuth';
import {
  createNovelInDrive,
  deleteNovelFromDrive,
  DriveAuthExpiredError,
  listSavedNovels,
  loadNovelFromDrive,
  updateNovelInDrive,
  type DriveNovelFile,
  type DriveNovelPayload,
} from '../utils/googleDrive';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleDriveModalProps {
  isOpen: boolean;
  user: User | null;
  accessToken: string | null;
  currentConfig: NovelConfig;
  currentOutline: NovelOutline | null;
  currentChapters: GeneratedChapter[];
  linkedDriveFileId: string | null;
  linkedDriveFileName: string | null;
  isGenerating: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
  onAuthCleared: () => void;
  onLinkedFileChange: (fileId: string | null, fileName: string | null) => void;
  onLoadNovelFromDrive: (
    payload: DriveNovelPayload,
    fileId: string,
    fileName: string
  ) => void;
}

type PendingConfirmation =
  | {
      type: 'overwrite';
      fileId: string;
      fileName: string;
    }
  | {
      type: 'delete';
      fileId: string;
      fileName: string;
    }
  | null;

export function GoogleDriveModal({
  isOpen,
  user,
  accessToken,
  currentConfig,
  currentOutline,
  currentChapters,
  linkedDriveFileId,
  linkedDriveFileName,
  isGenerating,
  onClose,
  onAuthSuccess,
  onAuthCleared,
  onLinkedFileChange,
  onLoadNovelFromDrive,
}: GoogleDriveModalProps) {
  const [files, setFiles] = useState<DriveNovelFile[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmation>(null);

  const refreshFiles = useCallback(
    async (tokenToUse?: string) => {
      const token = tokenToUse ?? accessToken;
      if (!token) return;
      setIsLoadingFiles(true);
      setErrorMessage(null);
      try {
        const list = await listSavedNovels(token);
        setFiles(list);
      } catch (err) {
        if (err instanceof DriveAuthExpiredError) {
          onAuthCleared();
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Gagal memuat daftar file dari Google Drive.'
        );
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [accessToken, onAuthCleared]
  );

  useEffect(() => {
    if (isOpen && accessToken) {
      refreshFiles(accessToken);
    }
  }, [isOpen, accessToken, refreshFiles]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      onAuthSuccess(result.user, result.accessToken);
      await refreshFiles(result.accessToken);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal masuk dengan Google. Silakan coba kembali.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutGoogle();
    onAuthCleared();
    setFiles([]);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const buildPayload = (): DriveNovelPayload | null => {
    if (!currentOutline) return null;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      config: currentConfig,
      outline: currentOutline,
      chapters: currentChapters,
    };
  };

  const handleSaveNewFile = async () => {
    if (!accessToken) return;
    const payload = buildPayload();
    if (!payload) return;

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingConfirm(null);

    try {
      const created = await createNovelInDrive(accessToken, payload);
      onLinkedFileChange(created.id, created.name);
      setStatusMessage(`Naskah berhasil disimpan sebagai "${created.name}".`);
      await refreshFiles(accessToken);
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onAuthCleared();
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan ke Google Drive.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (!accessToken || !currentOutline) return;
    if (linkedDriveFileId && linkedDriveFileName) {
      setPendingConfirm({
        type: 'overwrite',
        fileId: linkedDriveFileId,
        fileName: linkedDriveFileName,
      });
      return;
    }
    await handleSaveNewFile();
  };

  const confirmOverwriteFile = async () => {
    if (
      !accessToken ||
      pendingConfirm?.type !== 'overwrite'
    ) {
      return;
    }
    const payload = buildPayload();
    if (!payload) return;

    const targetId = pendingConfirm.fileId;
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingConfirm(null);

    try {
      const updated = await updateNovelInDrive(accessToken, targetId, payload);
      onLinkedFileChange(updated.id, updated.name);
      setStatusMessage(`File "${updated.name}" di Google Drive telah diperbarui.`);
      await refreshFiles(accessToken);
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onAuthCleared();
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui file di Google Drive.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFile = async (file: DriveNovelFile) => {
    if (!accessToken || isGenerating) return;
    setIsOpeningId(file.id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const payload = await loadNovelFromDrive(accessToken, file.id);
      onLoadNovelFromDrive(payload, file.id, file.name);
      onClose();
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onAuthCleared();
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal membuka file dari Google Drive.'
      );
    } finally {
      setIsOpeningId(null);
    }
  };

  const confirmDeleteFile = async () => {
    if (!accessToken || pendingConfirm?.type !== 'delete') return;
    const { fileId, fileName } = pendingConfirm;

    setIsDeletingId(fileId);
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingConfirm(null);

    try {
      await deleteNovelFromDrive(accessToken, fileId);
      if (linkedDriveFileId === fileId) {
        onLinkedFileChange(null, null);
      }
      setStatusMessage(`File "${fileName}" telah dihapus dari Google Drive.`);
      await refreshFiles(accessToken);
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onAuthCleared();
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal menghapus file dari Google Drive.'
      );
    } finally {
      setIsDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gdrive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xl flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Cloud className="w-5 h-5 text-blue-700 shrink-0" />
            <h2
              id="gdrive-modal-title"
              className="text-base font-bold text-zinc-900 truncate"
            >
              Penyimpanan Google Drive
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela Google Drive"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status & Errors */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900"
            >
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-sm text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Confirmation Dialog Box for Mutating / Destructive Operations */}
          {pendingConfirm && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-start gap-2.5 text-amber-950">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-sm">
                  {pendingConfirm.type === 'overwrite' ? (
                    <>
                      <p className="font-semibold">
                        Perbarui file di Google Drive?
                      </p>
                      <p className="mt-1 text-amber-900">
                        Naskah saat ini sudah terhubung dengan{' '}
                        <strong>{pendingConfirm.fileName}</strong>. Apakah Anda ingin menimpa file tersebut dengan isi bab terbaru, atau menyimpannya sebagai file baru?
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">
                        Hapus file dari Google Drive?
                      </p>
                      <p className="mt-1 text-amber-900">
                        Anda akan menghapus permanen{' '}
                        <strong>{pendingConfirm.fileName}</strong> dari Google Drive Anda. Tindakan ini tidak dapat dibatalkan.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg whitespace-nowrap"
                >
                  Batal
                </button>
                {pendingConfirm.type === 'overwrite' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveNewFile}
                      className="px-3.5 py-2 text-xs font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg whitespace-nowrap"
                    >
                      Simpan Sebagai File Baru
                    </button>
                    <button
                      type="button"
                      onClick={confirmOverwriteFile}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap"
                    >
                      Ya, Perbarui File
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={confirmDeleteFile}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap"
                  >
                    Ya, Hapus Permanen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Auth Required State */}
          {!accessToken ? (
            <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-xl text-center space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-zinc-900">
                  Hubungkan Akun Google Anda
                </h3>
                <p className="text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                  Masuk dengan akun Google untuk menyimpan data novel (konfigurasi, kerangka cerita, dan seluruh bab) ke Google Drive Anda serta membukanya kembali kapan saja.
                </p>
              </div>
              <div className="flex justify-center pt-1">
                <GoogleSignInButton
                  onClick={handleSignIn}
                  loading={isLoggingIn}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Connected Account Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Terhubung sebagai</p>
                  <p className="font-medium text-zinc-900 truncate">
                    {user?.email || user?.displayName || 'Akun Google'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-lg whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Keluar</span>
                </button>
              </div>

              {/* Save Current Novel Section */}
              <div className="p-4 border border-zinc-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    {currentOutline
                      ? currentOutline.judul_novel
                      : 'Belum ada naskah aktif'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {currentOutline
                      ? `${currentChapters.length} dari ${currentOutline.daftar_bab.length} bab siap disimpan ke Google Drive`
                      : 'Buat atau lanjutkan novel terlebih dahulu untuk menyimpannya ke Google Drive.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={!currentOutline || isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 shrink-0" />
                      <span>
                        {linkedDriveFileId ? 'Simpan / Perbarui' : 'Simpan ke Drive'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Saved Novels List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Naskah Tersimpan di Google Drive
                  </h3>
                  <button
                    type="button"
                    onClick={() => refreshFiles()}
                    disabled={isLoadingFiles}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`}
                    />
                    <span>Muat Ulang</span>
                  </button>
                </div>

                {isLoadingFiles ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengambil daftar naskah dari Google Drive...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-8 px-4 text-center border border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500">
                    Belum ada data novel KaryaNaskah yang tersimpan di Google Drive Anda.
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                    {files.map((file) => {
                      const isOpening = isOpeningId === file.id;
                      const isDeleting = isDeletingId === file.id;
                      return (
                        <li
                          key={file.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-zinc-50/70 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 truncate">
                              {file.name.replace(/ - KaryaNaskah\.json$/i, '')}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              {file.appProperties?.genre && (
                                <>
                                  <span>{file.appProperties.genre}</span>
                                  <span aria-hidden="true">·</span>
                                </>
                              )}
                              {file.appProperties?.chapterCount && (
                                <>
                                  <span className="font-mono tabular-nums">
                                    {file.appProperties.chapterCount} bab
                                  </span>
                                  <span aria-hidden="true">·</span>
                                </>
                              )}
                              <span>Diubah {formatDate(file.modifiedTime)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenFile(file)}
                              disabled={isGenerating || isOpening || isDeleting}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-100 disabled:opacity-50 rounded-lg whitespace-nowrap"
                            >
                              {isOpening ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FolderOpen className="w-3.5 h-3.5" />
                              )}
                              <span>Buka</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setPendingConfirm({
                                  type: 'delete',
                                  fileId: file.id,
                                  fileName: file.name,
                                })
                              }
                              disabled={isDeleting || isOpening}
                              aria-label={`Hapus ${file.name} dari Google Drive`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg whitespace-nowrap"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Hapus</span>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
