import type {
  GeneratedChapter,
  NovelConfig,
  NovelOutline,
} from '../types/novel';
import { clearCachedAccessToken } from './googleAuth';

export interface DriveNovelPayload {
  version: 1;
  savedAt: string;
  config: NovelConfig;
  outline: NovelOutline;
  chapters: GeneratedChapter[];
}

export interface DriveNovelFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  appProperties?: {
    source?: string;
    genre?: string;
    chapterCount?: string;
    totalWords?: string;
  };
}

export class DriveAuthExpiredError extends Error {
  constructor(message = 'Sesi Google Drive berakhir. Silakan masuk kembali.') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

function buildSafeFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 80);
  return `${cleaned || 'Naskah Novel'} - KaryaNaskah.json`;
}

async function handleDriveResponse(res: Response): Promise<Response> {
  if (res.status === 401) {
    clearCachedAccessToken();
    throw new DriveAuthExpiredError();
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const msg =
      errBody?.error?.message || `Permintaan Google Drive gagal (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return res;
}

export async function listSavedNovels(
  accessToken: string
): Promise<DriveNovelFile[]> {
  const query = encodeURIComponent(
    "trashed = false and mimeType = 'application/json' and appProperties has { key='source' and value='karyanaskah' }"
  );
  const fields = encodeURIComponent(
    'files(id,name,modifiedTime,size,appProperties)'
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`;

  const res = await handleDriveResponse(
    await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  const data = (await res.json()) as { files?: DriveNovelFile[] };
  return Array.isArray(data.files) ? data.files : [];
}

function createMultipartBody(
  metadata: Record<string, unknown>,
  contentJson: string
): { body: string; boundary: string } {
  const boundary = `karyanaskah_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    contentJson +
    `\r\n--${boundary}--`;

  return { body, boundary };
}

export async function createNovelInDrive(
  accessToken: string,
  payload: DriveNovelPayload
): Promise<DriveNovelFile> {
  const totalWords = payload.chapters.reduce((s, c) => s + c.jumlah_kata, 0);
  const metadata = {
    name: buildSafeFileName(payload.outline.judul_novel),
    mimeType: 'application/json',
    description: `Naskah novel KaryaNaskah (${payload.config.genre}, ${payload.chapters.length} bab)`,
    appProperties: {
      source: 'karyanaskah',
      genre: payload.config.genre,
      chapterCount: String(payload.chapters.length),
      totalWords: String(totalWords),
    },
  };

  const { body, boundary } = createMultipartBody(
    metadata,
    JSON.stringify(payload, null, 2)
  );

  const res = await handleDriveResponse(
    await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    )
  );

  return (await res.json()) as DriveNovelFile;
}

export async function updateNovelInDrive(
  accessToken: string,
  fileId: string,
  payload: DriveNovelPayload
): Promise<DriveNovelFile> {
  const totalWords = payload.chapters.reduce((s, c) => s + c.jumlah_kata, 0);
  const metadata = {
    name: buildSafeFileName(payload.outline.judul_novel),
    description: `Naskah novel KaryaNaskah (${payload.config.genre}, ${payload.chapters.length} bab)`,
    appProperties: {
      source: 'karyanaskah',
      genre: payload.config.genre,
      chapterCount: String(payload.chapters.length),
      totalWords: String(totalWords),
    },
  };

  const { body, boundary } = createMultipartBody(
    metadata,
    JSON.stringify(payload, null, 2)
  );

  const res = await handleDriveResponse(
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    )
  );

  return (await res.json()) as DriveNovelFile;
}

export async function loadNovelFromDrive(
  accessToken: string,
  fileId: string
): Promise<DriveNovelPayload> {
  const res = await handleDriveResponse(
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
  );

  const parsed = (await res.json()) as DriveNovelPayload;
  if (!parsed || !parsed.outline || !parsed.config || !Array.isArray(parsed.chapters)) {
    throw new Error('Format file novel di Google Drive tidak valid.');
  }
  return parsed;
}

export async function deleteNovelFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  await handleDriveResponse(
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
  );
}
