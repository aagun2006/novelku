import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface OutlineChapterItem {
  nomor_bab: number;
  judul_bab: string;
  ringkasan_adegan: string;
}

interface OutlinePayload {
  genre: string;
  targetAudience: string;
  chapterCount: number;
  minWordsPerChapter: number;
  synopsis: string;
}

interface ChapterPayload {
  novelTitle: string;
  novelPremise?: string;
  genre: string;
  targetAudience: string;
  minWordsPerChapter: number;
  synopsis: string;
  outline: OutlineChapterItem[];
  currentChapterNumber: number;
  previousChaptersSummary: {
    nomor_bab: number;
    judul_bab: string;
    ringkasan: string;
  }[];
  previousChapterEnding?: string;
}

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function cleanChapterText(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').trim();
  // Remove accidental leading chapter header like "Bab 1: Judul" or "# Bab 1"
  text = text.replace(
    /^(?:#{1,4}\s*)?(?:\*{1,2})?(?:BAB|Bab)\s+\d+(?:\s*[:\-–—.]\s*[^\n]*)?(?:\*{1,2})?\s*\n+/u,
    ''
  );
  // Remove markdown heading hashes if any slipped in
  text = text.replace(/^#{1,4}\s+/gm, '');
  // Normalize excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function extractEndingExcerpt(text: string, maxWords = 350): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(-maxWords).join(' ');
}

function getAudienceStyleGuide(targetAudience: string): string {
  if (targetAudience.includes('Anak-anak')) {
    return 'Gunakan bahasa Indonesia yang imajinatif, hangat, jernih, ramah anak (7-12 tahun), bebas dari kekerasan eksplisit atau konten dewasa, dengan ritme cerita yang lincah dan penuh rasa ingin tahu.';
  }
  if (targetAudience.includes('Remaja')) {
    return 'Gunakan bahasa Indonesia yang ekspresif, emosional, dinamis, dan relevan bagi pembaca remaja/Young Adult (13-17 tahun), dengan penekanan pada pencarian jati diri, konflik batin, dan dinamika hubungan.';
  }
  if (targetAudience.includes('Dewasa Muda')) {
    return 'Gunakan bahasa Indonesia sastra populer yang matang, intens, dan bernuansa untuk pembaca Dewasa Muda/New Adult (18-25 tahun), dengan konflik psikologis, ambisi, serta dialog yang tajam dan realistis.';
  }
  return 'Gunakan bahasa Indonesia sastra modern yang kaya diksi, berlapis makna, elegan, dan mendalam untuk pembaca Dewasa (25+ tahun), dengan eksplorasi karakter kompleks dan atmosfer yang kuat.';
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNonRetryable =
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('400') ||
        msg.includes('403');
      if (isNonRetryable || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 800 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('API key')) {
    return {
      status: 403,
      message:
        'Konfigurasi API key Gemini belum valid atau tidak memiliki izin. Silakan periksa panel Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Batas kuota permintaan Gemini API sementara tercapai. Tunggu beberapa saat lalu coba lanjutkan kembali.',
    };
  }
  return {
    status: 500,
    message: `Terjadi kendala saat menghubungi layanan AI: ${raw}`,
  };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/novel/outline', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(403).json({
          error: 'GEMINI_API_KEY belum tersedia di environment server. Periksa Settings > Secrets.',
        });
      }

      const body = req.body as Partial<OutlinePayload>;
      const genre = String(body.genre ?? '').trim();
      const targetAudience = String(body.targetAudience ?? '').trim();
      const chapterCount = Math.min(100, Math.max(1, Math.round(Number(body.chapterCount) || 5)));
      const minWordsPerChapter = Math.min(
        6000,
        Math.max(200, Math.round(Number(body.minWordsPerChapter) || 1500))
      );
      const synopsis = String(body.synopsis ?? '').trim();

      if (!genre || !targetAudience || synopsis.length < 20) {
        return res.status(400).json({
          error: 'Mohon lengkapi genre, target usia pembaca, dan sinopsis novel minimal 20 karakter.',
        });
      }

      const audienceGuide = getAudienceStyleGuide(targetAudience);

      const prompt = `Anda adalah seorang editor dan novelis profesional Indonesia.
Tugas Anda adalah merancang kerangka cerita (outline) novel yang utuh, dramatis, dan koheren dalam Bahasa Indonesia.

SPESIFIKASI NOVEL:
- Genre: ${genre}
- Target Usia Pembaca: ${targetAudience}
- Jumlah Bab yang Diminta: TEPAT ${chapterCount} bab (dari Bab 1 hingga Bab ${chapterCount})
- Estimasi Panjang per Bab: minimal ${minWordsPerChapter} kata per bab (jadi setiap ringkasan adegan harus cukup kaya untuk dikembangkan menjadi minimal ${minWordsPerChapter} kata!)
- Panduan Gaya: ${audienceGuide}

SINOPSIS DARI PENULIS:
"""
${synopsis}
"""

INSTRUKSI:
1. Buat "judul_novel" yang memikat, puitis/kuat, dan sesuai genre serta target pembaca.
2. Buat "premisa_singkat" berupa 1-2 kalimat pengait cerita yang elegan.
3. Buat array "daftar_bab" berisi TEPAT ${chapterCount} objek berurutan dari nomor_bab 1 hingga ${chapterCount}.
4. Setiap bab harus memiliki:
   - "nomor_bab": angka urut 1..${chapterCount}
   - "judul_bab": judul bab yang menggugah rasa ingin tahu (tanpa prefix "Bab X:")
   - "ringkasan_adegan": uraian adegan mendetail (3-5 kalimat) yang mencakup titik awal adegan, konflik/interaksi tokoh utama, detail latar, dan cliffhanger atau transisi menuju bab berikutnya. Pastikan alur keseluruhan memiliki eksposisi, eskalasi konflik, klimaks, dan resolusi yang memuaskan di Bab ${chapterCount}.`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction:
              'Anda adalah perancang struktur novel profesional Indonesia. Selalu keluarkan JSON valid sesuai skema tanpa teks tambahan.',
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingLevel:
                chapterCount > 30 ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
            },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                judul_novel: {
                  type: Type.STRING,
                  description: 'Judul novel yang menarik dalam Bahasa Indonesia.',
                },
                premisa_singkat: {
                  type: Type.STRING,
                  description: 'Premis singkat 1-2 kalimat yang merangkum inti cerita.',
                },
                daftar_bab: {
                  type: Type.ARRAY,
                  description: `Daftar tepat ${chapterCount} bab berurutan.`,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      nomor_bab: {
                        type: Type.INTEGER,
                        description: 'Nomor urut bab mulai dari 1.',
                      },
                      judul_bab: {
                        type: Type.STRING,
                        description: 'Judul bab tanpa kata Bab dan nomor.',
                      },
                      ringkasan_adegan: {
                        type: Type.STRING,
                        description:
                          'Ringkasan adegan mendetail mencakup konflik, tokoh, latar, dan transisi ke bab berikutnya.',
                      },
                    },
                    required: ['nomor_bab', 'judul_bab', 'ringkasan_adegan'],
                  },
                },
              },
              required: ['judul_novel', 'premisa_singkat', 'daftar_bab'],
            },
          },
        })
      );

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        judul_novel?: string;
        premisa_singkat?: string;
        daftar_bab?: OutlineChapterItem[];
      };

      const rawChapters = Array.isArray(parsed.daftar_bab) ? parsed.daftar_bab : [];
      if (rawChapters.length === 0) {
        return res.status(502).json({
          error: 'AI gagal menyusun daftar bab dari sinopsis tersebut. Silakan coba lagi.',
        });
      }

      // Normalize strictly to requested chapterCount
      const normalizedChapters: OutlineChapterItem[] = [];
      for (let i = 0; i < chapterCount; i++) {
        const item = rawChapters[i];
        normalizedChapters.push({
          nomor_bab: i + 1,
          judul_bab: item?.judul_bab
            ? String(item.judul_bab).replace(/^(?:Bab|BAB)\s+\d+\s*[:\-–—.]?\s*/i, '').trim()
            : `Bagian ${i + 1}`,
          ringkasan_adegan: item?.ringkasan_adegan
            ? String(item.ringkasan_adegan).trim()
            : `Melanjutkan perkembangan konflik utama dari bab sebelumnya menuju fase cerita berikutnya.`,
        });
      }

      return res.json({
        judul_novel: String(parsed.judul_novel || 'Naskah Tanpa Judul').trim(),
        premisa_singkat: String(parsed.premisa_singkat || '').trim(),
        daftar_bab: normalizedChapters,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/novel/chapter', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(403).json({
          error: 'GEMINI_API_KEY belum tersedia di environment server. Periksa Settings > Secrets.',
        });
      }

      const body = req.body as Partial<ChapterPayload>;
      const novelTitle = String(body.novelTitle ?? '').trim();
      const novelPremise = String(body.novelPremise ?? '').trim();
      const genre = String(body.genre ?? '').trim();
      const targetAudience = String(body.targetAudience ?? '').trim();
      const minWordsPerChapter = Math.min(
        6000,
        Math.max(200, Math.round(Number(body.minWordsPerChapter) || 1500))
      );
      const synopsis = String(body.synopsis ?? '').trim();
      const outline = Array.isArray(body.outline) ? body.outline : [];
      const currentChapterNumber = Number(body.currentChapterNumber) || 1;
      const previousChaptersSummary = Array.isArray(body.previousChaptersSummary)
        ? body.previousChaptersSummary
        : [];
      const previousChapterEnding = String(body.previousChapterEnding ?? '').trim();

      const currentOutline = outline.find((c) => Number(c.nomor_bab) === currentChapterNumber);
      if (!currentOutline) {
        return res.status(400).json({
          error: `Outline untuk Bab ${currentChapterNumber} tidak ditemukan.`,
        });
      }

      const nextOutline = outline.find((c) => Number(c.nomor_bab) === currentChapterNumber + 1);
      const totalChapters = outline.length;
      const audienceGuide = getAudienceStyleGuide(targetAudience);

      const outlineOverviewText =
        outline.length <= 25
          ? outline
              .map((c) => `Bab ${c.nomor_bab}: ${c.judul_bab} — ${c.ringkasan_adegan}`)
              .join('\n')
          : outline
              .map((c) => {
                const isNearCurrent =
                  Math.abs(Number(c.nomor_bab) - currentChapterNumber) <= 8;
                return isNearCurrent
                  ? `Bab ${c.nomor_bab}: ${c.judul_bab} — ${c.ringkasan_adegan}`
                  : `Bab ${c.nomor_bab}: ${c.judul_bab}`;
              })
              .join('\n');

      const recentSummaries = previousChaptersSummary.slice(-12);
      const previousSummaryText =
        recentSummaries.length > 0
          ? recentSummaries
              .map((p) => `- Bab ${p.nomor_bab} (${p.judul_bab}): ${p.ringkasan}`)
              .join('\n')
          : 'Ini adalah Bab 1 (bab pembuka novel).';

      const targetPromptWords = Math.ceil(minWordsPerChapter * 1.12);

      const systemInstruction = `Anda adalah novelis Web Novel / Novel Online berpengalaman berbahasa Indonesia dengan spesialisasi genre ${genre}. Tulis naskah ini 100% alami, cepat, adiktif, dan ringan dibaca seperti karya penulis novel online profesional—jauh dari pola tulisan AI atau gaya terjemahan kaku.

STANDAR PENULISAN WEB NOVEL & ATURAN KETAT (WAJIB DIPATUHI):
1. DOMINASI DIALOG (60–70% DIALOG):
   - Sekitar 60% hingga 70% isi setiap bab WAJIB berupa dialog dan interaksi langsung antartokoh.
   - Gerakkan alur cerita melalui percakapan, perdebatan, sindiran, atau negosiasi langsung—hindari narasi penjelasan latar belakang yang panjang lebar. Sampaikan informasi, konflik, dan karakterisasi lewat obrolan tokoh.

2. PARAGRAF PENDEK & RINGAN DI MATA:
   - Batasi setiap paragraf narasi MAKSIMAL 2 hingga 3 kalimat saja. Dilarang membuat paragraf panjang atau tembok teks.
   - Pisahkan SETIAP dialog dari pembicara yang berbeda ke baris/paragraf baru agar ritme baca nyaman dan lega di layar ponsel.

3. LANGSUNG KE INTI ADEGAN (NO INFO-DUMPING):
   - JANGAN jelaskan sejarah tempat, ciri fisik atau pakaian tokoh dari atas ke bawah, maupun monolog/pemikiran batin yang berputar-putar.
   - Langsung masuk ke aksi, situasi mendesak, dan interaksi tokoh sejak kalimat pertama.

4. TEK-TOK YANG HIDUP & EMOSI NATURAL:
   - Buat dialog antartokoh terasa cepat, tajam, alami, dan emosional: gunakan potongan kalimat yang terputus, interupsi, jeda, jawaban mengelak, atau bahasa percakapan sehari-hari yang sesuai usia karakter (tetap gunakan tanda petik ganda "..." yang rapi).
   - Sisipkan tindakan fisik singkat yang spesifik di sela-sela dialog (misal: meletakkan cangkir, menyeringai, membuang muka, menggaruk tengkuk, memutar gelas, menatap lantai), BUKAN paragraf deskripsi yang berdiri sendiri dan BUKAN menyebut nama emosinya secara langsung.

5. GANTUNG DI AKHIR BAB (CLIFFHANGER):
   - JANGAN pernah menutup bab dengan kalimat kesimpulan moral, hikmah kehidupan, rangkuman perasaan, atau perenungan filosofis.
   - Tutup setiap bab tepat di tengah dialog mengejutkan, pengungkapan mendadak, atau kejadian tak terduga agar pembaca langsung penasaran ke bab berikutnya.

6. VARIASI RITME KALIMAT (BURSTINESS):
   - Campurkan kalimat pendek yang tajam (3–6 kata) dengan kalimat aksi yang sedikit lebih panjang secara tidak beraturan. Jangan biarkan setiap baris atau paragraf memiliki pola yang seragam.

7. DAFTAR KATA & FRASA TERLARANG (JANGAN PERNAH DIGUNAKAN DALAM BENTUK APA PUN):
   - Dilarang keras memakai klise AI: "bukan hanya... melainkan juga" (termasuk "bukan sekadar... melainkan..."), "di sisi lain", "simfoni", "permadani", "menyelami", "terukir", "menyulam", "tak terelakkan", "memecah keheningan", "jantung berdegup kencang", "napas tercekat", "mengembuskan napas panjang" (maupun "menghembuskan napas panjang"), "seolah-olah", "bayang-bayang", dan "kilatan cahaya".
   - Dilarang keras memakai kata sambung kaku: "oleh karena itu", "selanjutnya", "dengan demikian".

8. KESESUAIAN AUDIENS & FORMAT BERSIH:
   - ${audienceGuide}
   - JANGAN menulis judul bab, nomor bab, markdown heading (#), daftar poin, atau catatan penulis. Tulis murni teks prosa web novel dengan paragraf pendek dan dialog terpisah tiap baris.`;

      const initialPrompt = `Tuliskan ISI LENGKAP bergaya Web Novel / Novel Online untuk Bab ${currentChapterNumber} dari ${totalChapters} dari novel berjudul "${novelTitle}".

INFORMASI CERITA:
- Genre: ${genre}
- Target Usia Pembaca: ${targetAudience}
- Premis: ${novelPremise || synopsis}
- Sinopsis Utama: ${synopsis}

KERANGKA KESELURUHAN NOVEL:
${outlineOverviewText}

KONTEKS BAB SEBELUMNYA:
${previousSummaryText}
${
  previousChapterEnding
    ? `\nCUPLIKAN PENUTUP BAB ${currentChapterNumber - 1} (sambungkan langsung adegan dan percakapan dari titik ini tanpa mengulang):\n"""\n${previousChapterEnding}\n"""`
    : ''
}

TUGAS KHUSUS UNTUK BAB ${currentChapterNumber} ("${currentOutline.judul_bab}"):
Rencana Adegan: ${currentOutline.ringkasan_adegan}
${
  nextOutline
    ? `Arah Cliffhanger: Tutup bab ini tepat di tengah dialog mengejutkan atau kejadian tak terduga yang langsung memancing ke Bab ${nextOutline.nomor_bab} ("${nextOutline.judul_bab}")—tanpa kalimat kesimpulan atau perenungan.`
    : `Arah Penutup: Ini adalah bab terakhir novel. Selesaikan konflik utama lewat konfrontasi dialog yang tajam dan aksi nyata yang mengena, tetap dengan paragraf pendek dan tanpa kalimat moral klise.`
}

SYARAT PANJANG & GAYA WEB NOVEL (KRITIS):
- Panjang tulisan bab ini WAJIB memenuhi atau melebihi ${minWordsPerChapter} kata (target ideal: ${targetPromptWords} kata).
- Penuhi target kata melalui percakapan tek-tok yang hidup (60–70% dialog), konflik interpersonal, debat, ketegangan adegan nyata, serta tindakan fisik singkat di sela dialog—BUKAN dengan memperpanjang deskripsi atau info-dumping.
- Pastikan setiap paragraf narasi maksimal 2–3 kalimat dan setiap pergantian pembicara berada di baris baru.
- Patuhi daftar kata terlarang tanpa pengecualian sedikit pun.
- Langsung mulai di tengah aksi/dialog tanpa menulis ulang "Bab ${currentChapterNumber}" atau judul bab.`;

      const firstPass = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: initialPrompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      let chapterProse = cleanChapterText(firstPass.text ?? '');
      let wordCount = countWords(chapterProse);

      // Seamless continuation passes if the chapter is shorter than minWordsPerChapter
      let continuationAttempt = 0;
      const maxContinuations = 2;

      while (wordCount < minWordsPerChapter && continuationAttempt < maxContinuations) {
        continuationAttempt += 1;
        const missingWords = minWordsPerChapter - wordCount;
        const requestedExtension = Math.max(missingWords + 250, 450);
        const tailContext = extractEndingExcerpt(chapterProse, 550);

        const continuationPrompt = `Lanjutkan penulisan gaya Web Novel untuk Bab ${currentChapterNumber} ("${currentOutline.judul_bab}") dari novel "${novelTitle}".

KONTEKS ADEGAN YANG HARUS DITUJU:
${currentOutline.ringkasan_adegan}

TEKS TERAKHIR YANG SUDAH DITULIS (lanjutkan LANGSUNG dari kalimat terakhir di bawah ini tanpa mengulang kata/paragraf sebelumnya):
"""
${tailContext}
"""

INSTRUKSI LANJUTAN:
- Tulisan saat ini baru mencapai ${wordCount} kata dan masih kurang ${missingWords} kata dari batas minimal ${minWordsPerChapter} kata.
- Lanjutkan adegan secara mulus dengan menambahkan minimal ${requestedExtension} kata lagi yang didominasi tek-tok dialog hidup (60–70% dialog), tindakan fisik singkat di sela dialog, dan paragraf narasi pendek (maksimal 2–3 kalimat per paragraf).
- Tanpa info-dumping, patuhi seluruh daftar kata terlarang, dan akhiri bab tepat di tengah cliffhanger (dialog mengejutkan atau kejadian tak terduga).
- JANGAN menulis ringkasan, JANGAN menulis ulang bagian awal bab, dan JANGAN menyertakan nomor/judul bab. Langsung sambung dialog atau aksi berikutnya.`;

        const extPass = await withRetry(() =>
          ai.models.generateContent({
            model: MODEL_NAME,
            contents: continuationPrompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        );

        const extensionText = cleanChapterText(extPass.text ?? '');
        if (!extensionText) break;

        chapterProse = `${chapterProse}\n\n${extensionText}`.trim();
        wordCount = countWords(chapterProse);
      }

      const endingExcerpt = extractEndingExcerpt(chapterProse, 320);

      return res.json({
        nomor_bab: currentChapterNumber,
        judul_bab: String(currentOutline.judul_bab),
        isi_cerita: chapterProse,
        jumlah_kata: wordCount,
        ringkasan_terakhir: endingExcerpt,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KaryaNaskah server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
