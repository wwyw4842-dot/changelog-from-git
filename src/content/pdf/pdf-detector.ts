/**
 * Detect if the current page is hosting a PDF (either native browser viewer
 * or a pdf.js based viewer). For native Chrome viewers we rely on the
 * embed/iframe element of type `application/pdf`. For browser-rendered pdfs
 * (arxiv, web-view) we watch the document's text-layer nodes that pdf.js
 * generates.
 */

const TEXT_LAYER_SELECTORS = [
  ".textLayer",
  ".textlayer",
  "[data-pdfjs-text-layer]",
];

export function isPdfPage(): boolean {
  if (document.contentType === "application/pdf") return true;
  const hint = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
  if (hint) return true;
  for (const selector of TEXT_LAYER_SELECTORS) {
    if (document.querySelector(selector)) return true;
  }
  return false;
}

export function observePdfTextLayers(callback: (layer: HTMLElement) => void): () => void {
  const handleLayer = (node: Element) => {
    if (!(node instanceof HTMLElement)) return;
    if (TEXT_LAYER_SELECTORS.some((sel) => node.matches(sel))) {
      callback(node);
    }
    TEXT_LAYER_SELECTORS.forEach((sel) =>
      node.querySelectorAll(sel).forEach((child) => {
        if (child instanceof HTMLElement) callback(child);
      })
    );
  };

  document.querySelectorAll(TEXT_LAYER_SELECTORS.join(",")).forEach((node) => {
    if (node instanceof HTMLElement) callback(node);
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) handleLayer(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
