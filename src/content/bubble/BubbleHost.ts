import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import bubbleCss from "./bubble.css?inline";
import { Bubble, type BubbleController, type BubbleProps } from "./Bubble";

export interface BubbleHandle {
  show(props: BubbleProps): void;
  showTrigger(position: { x: number; y: number }, label: string, onClick: () => void): void;
  hideTrigger(): void;
  hide(): void;
  updateStream(chunk: { translatedText?: string; isError?: boolean; errorMessage?: string }): void;
  isVisible(): boolean;
  isPinned(): boolean;
  unpin(): void;
  setTheme(theme: string): void;
}

export function createBubbleHost(): BubbleHandle {
  const hostElement = document.createElement("div");
  hostElement.id = "__polyglot_host__";
  hostElement.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
  const shadow = hostElement.attachShadow({ mode: "open" });

  const sheet = new CSSStyleSheet();
  try {
    sheet.replaceSync(bubbleCss);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = bubbleCss;
    shadow.appendChild(style);
  }

  const mount = document.createElement("div");
  mount.className = "poly-root";
  mount.style.position = "absolute";
  mount.style.inset = "0";
  mount.style.pointerEvents = "none";
  shadow.appendChild(mount);
  document.documentElement.appendChild(hostElement);

  const root: Root = createRoot(mount);
  let state: BubbleController = {
    visible: false,
    pinned: false,
    trigger: null,
    bubble: null,
  };

  const render = () => {
    root.render(createElement(Bubble, { controller: state, onPinChange: setPinned, onClose: hide }));
  };

  const setPinned = (value: boolean) => {
    state = { ...state, pinned: value };
    render();
  };

  const hide = () => {
    state = { ...state, visible: false, bubble: null, pinned: false };
    render();
  };

  render();

  return {
    show(props) {
      state = { ...state, visible: true, bubble: props };
      render();
    },
    showTrigger(position, label, onClick) {
      state = { ...state, trigger: { position, label, onClick } };
      render();
    },
    hideTrigger() {
      state = { ...state, trigger: null };
      render();
    },
    hide,
    updateStream(chunk) {
      if (!state.bubble) return;
      state = {
        ...state,
        bubble: {
          ...state.bubble,
          translatedText: chunk.translatedText ?? state.bubble.translatedText,
          state: chunk.isError ? "error" : state.bubble.state === "streaming" ? "streaming" : state.bubble.state,
          errorMessage: chunk.errorMessage,
        },
      };
      render();
    },
    isVisible: () => state.visible,
    isPinned: () => state.pinned,
    unpin: () => setPinned(false),
    setTheme(theme: string) {
      if (theme === 'system') {
        hostElement.removeAttribute('data-poly-theme');
      } else {
        hostElement.setAttribute('data-poly-theme', theme);
      }
    },
  };
}
