import type { Settings } from "@shared/types";

export interface ShowCardParams {
  originalText: string;
  translatedText: string;
  phonetic?: string;
  provider: string;
  fromCache?: boolean;
  isError?: boolean;
  errorMessage?: string;
  explanation?: string;
  examples?: Array<{ src: string; tgt: string }>;
  partOfSpeech?: Array<{ pos: string; definition: string }>;
  alternatives?: string[];
  state: "loading" | "streaming" | "done" | "error";
  position: { x: number; y: number };
}

export interface SettingsAccessor {
  getSettings: () => Settings | null;
  setSettings: (settings: Settings) => void;
}
