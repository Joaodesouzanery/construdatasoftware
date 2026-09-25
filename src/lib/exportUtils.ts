// Utilitário de download de blob compartilhado, extraído do padrão já
// endurecido em src/lib/rdoSabespPdfGenerator.ts (e duplicado em
// RDOHistoryView.tsx): âncora + requestAnimationFrame + revokeObjectURL
// adiado, para evitar downloads quebrados em alguns navegadores.

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

export const triggerBlobDownload = async (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);

  try {
    await waitForNextFrame();
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
};

export const downloadJson = async (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  await triggerBlobDownload(blob, filename);
};

export const downloadMarkdown = async (markdown: string, filename: string) => {
  const blob = new Blob([markdown], { type: "text/markdown" });
  await triggerBlobDownload(blob, filename);
};
