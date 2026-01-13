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
    const pageText = (content.items as any[])
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean)
      .join(" ");
    pages.push(pageText);
  }

  try {
    await (pdf as any).destroy?.();
  } catch {
    // ignore
  }

  return pages.join("\n\n");
}
