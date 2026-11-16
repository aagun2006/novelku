import {
  GENRE_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  type GeneratedChapter,
  type NovelConfig,
  type NovelGenre,
  type NovelOutline,
  type TargetAudience,
} from '../types/novel';

export interface ProjectJsonPayload {
  version: 1;
  savedAt: string;
  config: NovelConfig;
  outline: NovelOutline;
  chapters: GeneratedChapter[];
}

function slugifyFilename(title: string): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'novel-karyanaskah';
}

export function exportProjectJson({
  config,
  outline,
  chapters,
}: {
  config: NovelConfig;
  outline: NovelOutline;
  chapters: GeneratedChapter[];
}): void {
  const payload: ProjectJsonPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    config,
    outline,
    chapters,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugifyFilename(outline.judul_novel)}-project.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function parseProjectJsonFile(
  file: File
): Promise<ProjectJsonPayload> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File yang dipilih bukan format JSON yang valid.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Struktur file project tidak dikenali.');
  }

  const obj = parsed as Partial<ProjectJsonPayload>;
  if (
    !obj.config ||
    !obj.outline ||
    !Array.isArray(obj.outline.daftar_bab) ||
    obj.outline.daftar_bab.length === 0 ||
    !Array.isArray(obj.chapters)
  ) {
    throw new Error(
      'File project tidak lengkap. Pastikan file berasal dari "Simpan Project (.JSON)" KaryaNaskah.'
    );
  }

  const genreValid = GENRE_OPTIONS.includes(obj.config.genre as NovelGenre);
  const audienceValid = TARGET_AUDIENCE_OPTIONS.includes(
    obj.config.targetAudience as TargetAudience
  );

  const normalizedConfig: NovelConfig = {
    genre: genreValid ? obj.config.genre : GENRE_OPTIONS[0],
    targetAudience: audienceValid
      ? obj.config.targetAudience
      : TARGET_AUDIENCE_OPTIONS[1],
    chapterCount: Math.min(
      100,
      Math.max(1, Number(obj.config.chapterCount) || obj.outline.daftar_bab.length)
    ),
    minWordsPerChapter: Math.min(
      6000,
      Math.max(200, Number(obj.config.minWordsPerChapter) || 1500)
    ),
    synopsis: String(obj.config.synopsis ?? ''),
  };

  const normalizedOutline: NovelOutline = {
    judul_novel: String(obj.outline.judul_novel || 'Naskah Tanpa Judul'),
    premisa_singkat: String(obj.outline.premisa_singkat || ''),
    daftar_bab: obj.outline.daftar_bab.map((b, idx) => ({
      nomor_bab: Number(b.nomor_bab) || idx + 1,
      judul_bab: String(b.judul_bab || `Bab ${idx + 1}`),
      ringkasan_adegan: String(b.ringkasan_adegan || ''),
    })),
  };

  const normalizedChapters: GeneratedChapter[] = obj.chapters.map((ch, idx) => ({
    nomor_bab: Number(ch.nomor_bab) || idx + 1,
    judul_bab: String(ch.judul_bab || `Bab ${idx + 1}`),
    isi_cerita: String(ch.isi_cerita || ''),
    jumlah_kata: Number(ch.jumlah_kata) || 0,
    ringkasan_terakhir: String(ch.ringkasan_terakhir || ''),
  }));

  return {
    version: 1,
    savedAt: String(obj.savedAt || new Date().toISOString()),
    config: normalizedConfig,
    outline: normalizedOutline,
    chapters: normalizedChapters,
  };
}
