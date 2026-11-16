export const GENRE_OPTIONS = [
  'Fantasi',
  'Romansa',
  'Horor',
  'Thriller',
  'Sci-Fi',
  'Misteri',
  'Drama Keluarga',
  'Komedi',
] as const;

export type NovelGenre = (typeof GENRE_OPTIONS)[number];

export const TARGET_AUDIENCE_OPTIONS = [
  'Anak-anak (7-12 tahun)',
  'Remaja / Young Adult (13-17 tahun)',
  'Dewasa Muda / New Adult (18-25 tahun)',
  'Dewasa (25+ tahun)',
] as const;

export type TargetAudience = (typeof TARGET_AUDIENCE_OPTIONS)[number];

export interface NovelConfig {
  genre: NovelGenre;
  targetAudience: TargetAudience;
  chapterCount: number;
  minWordsPerChapter: number;
  synopsis: string;
}

export interface OutlineChapter {
  nomor_bab: number;
  judul_bab: number | string;
  ringkasan_adegan: string;
}

export interface NovelOutline {
  judul_novel: string;
  premisa_singkat: string;
  daftar_bab: {
    nomor_bab: number;
    judul_bab: string;
    ringkasan_adegan: string;
  }[];
}

export interface GeneratedChapter {
  nomor_bab: number;
  judul_bab: string;
  isi_cerita: string;
  jumlah_kata: number;
  ringkasan_terakhir: string;
}

export type GenerationPhase =
  | 'idle'
  | 'outlining'
  | 'writing'
  | 'cooldown'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface StoredNovelState {
  config: NovelConfig;
  outline: NovelOutline | null;
  chapters: GeneratedChapter[];
  phase: GenerationPhase;
  linkedDriveFileId?: string | null;
  linkedDriveFileName?: string | null;
  updatedAt: string;
}
