import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ConfirmResetModal } from './components/ConfirmResetModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { Header } from './components/Header';
import { NovelConfigSidebar } from './components/NovelConfigSidebar';
import { NovelOutputPanel } from './components/NovelOutputPanel';
import {
  GENRE_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  type GeneratedChapter,
  type GenerationPhase,
  type NovelConfig,
  type NovelOutline,
  type StoredNovelState,
} from './types/novel';
import { getAccessToken, initAuth } from './utils/googleAuth';
import type { DriveNovelPayload } from './utils/googleDrive';
import { exportNovelToPdf } from './utils/pdfExport';
import {
  exportProjectJson,
  type ProjectJsonPayload,
} from './utils/projectFile';

const STORAGE_KEY = 'karyanaskah_novel_draft_v1';
const CHAPTER_COOLDOWN_SECONDS = 10;

const DEFAULT_CONFIG: NovelConfig = {
  genre: GENRE_OPTIONS[0],
  targetAudience: TARGET_AUDIENCE_OPTIONS[1],
  chapterCount: 5,
  minWordsPerChapter: 1500,
  synopsis: '',
};

function saveDraftToStorage(state: Omit<StoredNovelState, 'updatedAt'>): void {
  try {
    const payload: StoredNovelState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

function loadInitialDraft(): StoredNovelState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredNovelState;
    if (!parsed || !parsed.config) return null;
    const isInterrupted =
      parsed.phase === 'outlining' ||
      parsed.phase === 'writing' ||
      parsed.phase === 'cooldown';
    const normalizedPhase: GenerationPhase = isInterrupted
      ? parsed.outline
        ? 'cancelled'
        : 'idle'
      : parsed.phase;
    return {
      ...parsed,
      phase: normalizedPhase,
    };
  } catch {
    return null;
  }
}

function waitWithCountdown(
  seconds: number,
  signal: AbortSignal,
  onTick: (remaining: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || seconds <= 0) {
      onTick(0);
      resolve();
      return;
    }

    let remaining = seconds;
    onTick(remaining);

    const intervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(intervalId);
        signal.removeEventListener('abort', handleAbort);
        onTick(0);
        resolve();
      } else {
        onTick(remaining);
      }
    }, 1000);

    const handleAbort = () => {
      window.clearInterval(intervalId);
      signal.removeEventListener('abort', handleAbort);
      onTick(0);
      resolve();
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export default function App() {
  const [initialDraft] = useState<StoredNovelState | null>(() =>
    loadInitialDraft()
  );

  const [config, setConfig] = useState<NovelConfig>(
    initialDraft?.config ?? DEFAULT_CONFIG
  );
  const [outline, setOutline] = useState<NovelOutline | null>(
    initialDraft?.outline ?? null
  );
  const [chapters, setChapters] = useState<GeneratedChapter[]>(
    initialDraft?.chapters ?? []
  );
  const [phase, setPhase] = useState<GenerationPhase>(
    initialDraft?.phase ?? 'idle'
  );
  const [currentChapterWriting, setCurrentChapterWriting] = useState<number>(
    () => (initialDraft?.chapters?.length ?? 0) + 1
  );
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoredDraft, setIsRestoredDraft] = useState<boolean>(() =>
    Boolean(
      initialDraft?.outline &&
        initialDraft.chapters.length < initialDraft.outline.daftar_bab.length
    )
  );
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Google Drive Auth & File Linking state (access token kept strictly in memory)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() =>
    getAccessToken()
  );
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [linkedDriveFileId, setLinkedDriveFileId] = useState<string | null>(
    initialDraft?.linkedDriveFileId ?? null
  );
  const [linkedDriveFileName, setLinkedDriveFileName] = useState<string | null>(
    initialDraft?.linkedDriveFileName ?? null
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setDriveAccessToken(token);
      },
      (user) => {
        setGoogleUser(user);
        setDriveAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Auto-save real-time ke LocalStorage setiap kali form, outline, atau bab berubah
  useEffect(() => {
    saveDraftToStorage({
      config,
      outline,
      chapters,
      phase,
      linkedDriveFileId,
      linkedDriveFileName,
    });
  }, [config, outline, chapters, phase, linkedDriveFileId, linkedDriveFileName]);

  const runSequentialChapters = async (
    activeConfig: NovelConfig,
    activeOutline: NovelOutline,
    existingChapters: GeneratedChapter[],
    signal: AbortSignal
  ) => {
    const accumulatedChapters: GeneratedChapter[] = [...existingChapters];
    const startIndex = accumulatedChapters.length;

    setIsRestoredDraft(false);

    for (let i = startIndex; i < activeOutline.daftar_bab.length; i++) {
      if (signal.aborted) {
        setPhase('cancelled');
        return;
      }

      const chapterNum = activeOutline.daftar_bab[i].nomor_bab;
      setPhase('writing');
      setCurrentChapterWriting(chapterNum);

      const previousChaptersSummary = accumulatedChapters.map((ch, idx) => {
        const outlineSummary =
          activeOutline.daftar_bab[idx]?.ringkasan_adegan ?? '';
        return {
          nomor_bab: ch.nomor_bab,
          judul_bab: ch.judul_bab,
          ringkasan: outlineSummary,
        };
      });

      const lastChapter =
        accumulatedChapters.length > 0
          ? accumulatedChapters[accumulatedChapters.length - 1]
          : null;

      const response = await fetch('/api/novel/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          novelTitle: activeOutline.judul_novel,
          novelPremise: activeOutline.premisa_singkat,
          genre: activeConfig.genre,
          targetAudience: activeConfig.targetAudience,
          minWordsPerChapter: activeConfig.minWordsPerChapter,
          synopsis: activeConfig.synopsis,
          outline: activeOutline.daftar_bab,
          currentChapterNumber: chapterNum,
          previousChaptersSummary,
          previousChapterEnding: lastChapter?.ringkasan_terakhir ?? '',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error || `Gagal menulis Bab ${chapterNum} (HTTP ${response.status})`
        );
      }

      const newChapter = data as GeneratedChapter;
      accumulatedChapters.push(newChapter);

      const nextSnapshot = [...accumulatedChapters];
      setChapters(nextSnapshot);

      saveDraftToStorage({
        config: activeConfig,
        outline: activeOutline,
        chapters: nextSnapshot,
        phase:
          i < activeOutline.daftar_bab.length - 1 ? 'cooldown' : 'completed',
        linkedDriveFileId,
        linkedDriveFileName,
      });

      // Jeda otomatis 10 detik antar bab untuk mencegah limit RPM Free Tier
      if (i < activeOutline.daftar_bab.length - 1) {
        const nextChapterNum = activeOutline.daftar_bab[i + 1].nomor_bab;
        setCurrentChapterWriting(nextChapterNum);
        setPhase('cooldown');
        await waitWithCountdown(
          CHAPTER_COOLDOWN_SECONDS,
          signal,
          setCooldownSeconds
        );
        if (signal.aborted) {
          setPhase('cancelled');
          return;
        }
      }
    }

    setCooldownSeconds(0);
    setPhase('completed');
  };

  const handleGenerate = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage(null);
    setOutline(null);
    setChapters([]);
    setLinkedDriveFileId(null);
    setLinkedDriveFileName(null);
    setIsRestoredDraft(false);
    setCooldownSeconds(0);
    setCurrentChapterWriting(1);
    setPhase('outlining');

    try {
      const outlineRes = await fetch('/api/novel/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(config),
      });

      const outlineData = await outlineRes.json().catch(() => ({}));
      if (!outlineRes.ok) {
        throw new Error(
          outlineData.error ||
            `Gagal membuat kerangka cerita (HTTP ${outlineRes.status})`
        );
      }

      const generatedOutline = outlineData as NovelOutline;
      setOutline(generatedOutline);
      saveDraftToStorage({
        config,
        outline: generatedOutline,
        chapters: [],
        phase: 'writing',
        linkedDriveFileId: null,
        linkedDriveFileName: null,
      });

      await runSequentialChapters(
        config,
        generatedOutline,
        [],
        controller.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setCooldownSeconds(0);
        setPhase('cancelled');
        return;
      }
      setCooldownSeconds(0);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan yang tidak terduga saat membuat novel.'
      );
      setPhase('error');
    }
  };

  const handleResumeFromNext = async () => {
    if (!outline) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage(null);
    setCooldownSeconds(0);

    try {
      await runSequentialChapters(config, outline, chapters, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setCooldownSeconds(0);
        setPhase('cancelled');
        return;
      }
      setCooldownSeconds(0);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat melanjutkan penulisan bab.'
      );
      setPhase('error');
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCooldownSeconds(0);
    setPhase('cancelled');
  };

  const handleConfirmReset = () => {
    if (phase === 'outlining' || phase === 'writing' || phase === 'cooldown') {
      return;
    }
    setIsResetModalOpen(false);
    setConfig(DEFAULT_CONFIG);
    setOutline(null);
    setChapters([]);
    setLinkedDriveFileId(null);
    setLinkedDriveFileName(null);
    setIsRestoredDraft(false);
    setCooldownSeconds(0);
    setPhase('idle');
    setErrorMessage(null);
    setCurrentChapterWriting(1);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleExportPdf = () => {
    if (!outline || chapters.length === 0) return;
    exportNovelToPdf({
      title: outline.judul_novel,
      premise: outline.premisa_singkat,
      genre: config.genre,
      targetAudience: config.targetAudience,
      chapters,
    });
  };

  const handleExportProjectJson = () => {
    if (!outline) return;
    exportProjectJson({
      config,
      outline,
      chapters,
    });
  };

  const handleImportProject = (payload: ProjectJsonPayload) => {
    setConfig(payload.config);
    setOutline(payload.outline);
    setChapters(payload.chapters);
    setLinkedDriveFileId(null);
    setLinkedDriveFileName(null);
    setIsRestoredDraft(
      payload.chapters.length < payload.outline.daftar_bab.length
    );
    setCooldownSeconds(0);
    setErrorMessage(null);
    setCurrentChapterWriting(payload.chapters.length + 1);
    setPhase(
      payload.chapters.length >= payload.outline.daftar_bab.length
        ? 'completed'
        : 'cancelled'
    );
  };

  const handleLoadFromDrive = (
    payload: DriveNovelPayload,
    fileId: string,
    fileName: string
  ) => {
    setConfig(payload.config);
    setOutline(payload.outline);
    setChapters(payload.chapters);
    setLinkedDriveFileId(fileId);
    setLinkedDriveFileName(fileName);
    setIsRestoredDraft(
      payload.chapters.length < payload.outline.daftar_bab.length
    );
    setCooldownSeconds(0);
    setErrorMessage(null);
    setCurrentChapterWriting(payload.chapters.length + 1);
    setPhase(
      payload.chapters.length >= payload.outline.daftar_bab.length
        ? 'completed'
        : 'cancelled'
    );
  };

  const isGenerating =
    phase === 'outlining' || phase === 'writing' || phase === 'cooldown';
  const hasDraftData =
    Boolean(outline) ||
    chapters.length > 0 ||
    config.synopsis.trim().length > 0;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F6F5F2] text-zinc-900">
      <Header
        hasNovel={hasDraftData}
        isGenerating={isGenerating}
        onReset={() => setIsResetModalOpen(true)}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <NovelConfigSidebar
            config={config}
            phase={phase}
            currentChapterWriting={currentChapterWriting}
            completedChaptersCount={chapters.length}
            cooldownSeconds={cooldownSeconds}
            onChange={setConfig}
            onGenerate={handleGenerate}
            onCancel={handleCancel}
            onImportProject={handleImportProject}
          />

          <NovelOutputPanel
            config={config}
            outline={outline}
            chapters={chapters}
            phase={phase}
            currentChapterWriting={currentChapterWriting}
            cooldownSeconds={cooldownSeconds}
            isRestoredDraft={isRestoredDraft}
            errorMessage={errorMessage}
            linkedDriveFileName={linkedDriveFileName}
            onExportPdf={handleExportPdf}
            onExportProjectJson={handleExportProjectJson}
            onResumeFromNext={handleResumeFromNext}
            onOpenDriveModal={() => setIsDriveModalOpen(true)}
          />
        </div>
      </main>

      <ConfirmResetModal
        isOpen={isResetModalOpen}
        novelTitle={outline?.judul_novel}
        chaptersCount={chapters.length}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetModalOpen(false)}
      />

      <GoogleDriveModal
        isOpen={isDriveModalOpen}
        user={googleUser}
        accessToken={driveAccessToken}
        currentConfig={config}
        currentOutline={outline}
        currentChapters={chapters}
        linkedDriveFileId={linkedDriveFileId}
        linkedDriveFileName={linkedDriveFileName}
        isGenerating={isGenerating}
        onClose={() => setIsDriveModalOpen(false)}
        onAuthSuccess={(user, token) => {
          setGoogleUser(user);
          setDriveAccessToken(token);
        }}
        onAuthCleared={() => {
          setDriveAccessToken(null);
        }}
        onLinkedFileChange={(fileId, fileName) => {
          setLinkedDriveFileId(fileId);
          setLinkedDriveFileName(fileName);
        }}
        onLoadNovelFromDrive={handleLoadFromDrive}
      />
    </div>
  );
}
