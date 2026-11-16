import { jsPDF } from 'jspdf';
import type { GeneratedChapter } from '../types/novel';

interface PdfExportOptions {
  title: string;
  premise?: string;
  genre: string;
  targetAudience: string;
  chapters: GeneratedChapter[];
}

function sanitizeForPdf(input: string): string {
  return input
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '');
}

function slugifyFilename(title: string): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'novel-karyanaskah';
}

export function exportNovelToPdf({
  title,
  premise,
  genre,
  targetAudience,
  chapters,
}: PdfExportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 24;
  const marginTop = 26;
  const marginBottom = 22;
  const contentWidth = pageWidth - marginX * 2;
  const totalWords = chapters.reduce((acc, ch) => acc + ch.jumlah_kata, 0);

  // --- COVER / TITLE PAGE ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 118);
  doc.text(
    sanitizeForPdf(`${genre.toUpperCase()}  |  ${targetAudience.toUpperCase()}`),
    pageWidth / 2,
    72,
    { align: 'center' }
  );

  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(24, 24, 27);
  const titleLines = doc.splitTextToSize(sanitizeForPdf(title), contentWidth - 10) as string[];
  let titleY = 92;
  for (const line of titleLines) {
    doc.text(line, pageWidth / 2, titleY, { align: 'center' });
    titleY += 11;
  }

  // Subtle decorative divider on cover
  doc.setDrawColor(212, 212, 216);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - 24, titleY + 4, pageWidth / 2 + 24, titleY + 4);

  if (premise && premise.trim()) {
    doc.setFont('times', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(82, 82, 91);
    const premiseLines = doc.splitTextToSize(
      sanitizeForPdf(premise.trim()),
      contentWidth - 16
    ) as string[];
    let premiseY = titleY + 18;
    for (const line of premiseLines) {
      doc.text(line, pageWidth / 2, premiseY, { align: 'center' });
      premiseY += 6.5;
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 122);
  doc.text(
    sanitizeForPdf(
      `${chapters.length} Bab  -  ${totalWords.toLocaleString('id-ID')} Kata`
    ),
    pageWidth / 2,
    pageHeight - 36,
    { align: 'center' }
  );

  // --- CHAPTERS (EACH STARTS ON A NEW PAGE) ---
  chapters.forEach((chapter) => {
    doc.addPage();
    let cursorY = marginTop;

    // Chapter Number label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(113, 113, 122);
    doc.text(`BAB ${chapter.nomor_bab}`, marginX, cursorY);
    cursorY += 8;

    // Chapter Title
    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(24, 24, 27);
    const chTitleLines = doc.splitTextToSize(
      sanitizeForPdf(chapter.judul_bab),
      contentWidth
    ) as string[];
    for (const line of chTitleLines) {
      doc.text(line, marginX, cursorY);
      cursorY += 8;
    }

    // Divider below chapter heading
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.3);
    doc.line(marginX, cursorY + 2, pageWidth - marginX, cursorY + 2);
    cursorY += 12;

    // Chapter Body Paragraphs
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(39, 39, 42);
    const lineHeight = 6.2;
    const paragraphSpacing = 3.5;

    const paragraphs = sanitizeForPdf(chapter.isi_cerita)
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const para of paragraphs) {
      const wrappedLines = doc.splitTextToSize(para, contentWidth) as string[];
      for (const line of wrappedLines) {
        if (cursorY + lineHeight > pageHeight - marginBottom) {
          doc.addPage();
          cursorY = marginTop;
          doc.setFont('times', 'normal');
          doc.setFontSize(11.5);
          doc.setTextColor(39, 39, 42);
        }
        doc.text(line, marginX, cursorY);
        cursorY += lineHeight;
      }
      cursorY += paragraphSpacing;
    }
  });

  // --- RUNNING PAGE NUMBERS (SKIP COVER PAGE 1) ---
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(161, 161, 170);
    doc.text(sanitizeForPdf(title), marginX, 14);
    doc.text(`Halaman ${pageNum - 1}`, pageWidth / 2, pageHeight - 12, {
      align: 'center',
    });
  }

  doc.save(`${slugifyFilename(title)}.pdf`);
}
