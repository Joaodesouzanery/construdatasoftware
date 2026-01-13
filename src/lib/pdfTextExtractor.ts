import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";

let workerConfigured = false;

const ensureWorker = () => {
  if (workerConfigured) return;
  // Vite will bundle and serve the worker from this URL.
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  workerConfigured = true;
};

export async function extractPdfText(file: File): Promise<string> {
  ensureWorker();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;

  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // pdfjs returns positioned text chunks; to preserve table rows we must rebuild lines
    // using the Y coordinate (otherwise everything vira uma “linha gigante”).
    const rawItems = (content.items as any[])
      .map((it) => {
        const str = typeof it?.str === "string" ? it.str : "";
        const t = Array.isArray(it?.transform) ? it.transform : null;
        const x = t ? Number(t[4]) : 0;
        const y = t ? Number(t[5]) : 0;
        return { str: str.trim(), x, y };
      })
      .filter((it) => it.str);

    // Sort: top-to-bottom (y desc), then left-to-right (x asc)
    rawItems.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines: string[] = [];
    const LINE_Y_THRESHOLD = 2.8; // works well for typical PDF table text

    let currentY: number | null = null;
    let currentLine: { str: string; x: number }[] = [];

    const flush = () => {
      if (!currentLine.length) return;
      currentLine.sort((a, b) => a.x - b.x);
      const lineText = currentLine.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
      if (lineText) lines.push(lineText);
      currentLine = [];
    };

    for (const it of rawItems) {
      if (currentY === null) {
        currentY = it.y;
        currentLine.push({ str: it.str, x: it.x });
        continue;
      }

      if (Math.abs(it.y - currentY) <= LINE_Y_THRESHOLD) {
        currentLine.push({ str: it.str, x: it.x });
      } else {
        flush();
        currentY = it.y;
        currentLine.push({ str: it.str, x: it.x });
      }
    }

    flush();

    try {
      await (page as any).cleanup?.();
    } catch {
      // ignore
    }

    pages.push(lines.join("\n"));
  }

  try {
    await (pdf as any).destroy?.();
  } catch {
    // ignore
  }

  return pages.join("\n\n");
}
