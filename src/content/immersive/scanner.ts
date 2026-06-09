const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, figcaption";
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "SVG",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "BUTTON",
  "CANVAS",
  "VIDEO",
  "AUDIO",
  "OBJECT",
  "IFRAME",
]);
const IGNORE_CLASS = "polyglot-immersive-ignore";
const TRANSLATION_ATTR = "data-polyglot-translation-host";

export interface ImmersiveBlock {
  node: HTMLElement;
  text: string;
}

export function isSkippable(node: Element): boolean {
  if (SKIP_TAGS.has(node.tagName)) return true;
  if (node.classList.contains(IGNORE_CLASS)) return true;
  if ((node as HTMLElement).closest?.(`[${TRANSLATION_ATTR}]`)) return true;
  return false;
}

export function collectBlocks(root: HTMLElement | Document = document): ImmersiveBlock[] {
  const blocks: ImmersiveBlock[] = [];
  const elements = root instanceof Document ? root.body : root;
  if (!elements) return blocks;
  const scope = elements.querySelectorAll(BLOCK_SELECTOR);
  scope.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (isSkippable(node)) return;
    const text = extractText(node);
    if (!text) return;
    if (text.length < 2) return;
    if (text.length > 4000) return;
    blocks.push({ node, text });
  });
  return blocks;
}

function extractText(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  const text = (clone.innerText || clone.textContent || "").trim();
  return text.replace(/\s+/g, " ");
}

export function markTranslationHost(host: HTMLElement): void {
  host.setAttribute(TRANSLATION_ATTR, "true");
  host.classList.add(IGNORE_CLASS);
}

export function clearImmersive(): void {
  document.querySelectorAll(`[${TRANSLATION_ATTR}]`).forEach((el) => el.remove());
  document.querySelectorAll("[data-polyglot-original]").forEach((el) => {
    el.removeAttribute("data-polyglot-original");
  });
}
