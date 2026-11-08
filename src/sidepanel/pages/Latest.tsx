import { useEffect, useRef, useState } from "react";
import type { TranslationResult } from "@shared/types";
import { send } from "@shared/messaging";
import { chooseRetryProvider, hasDeepDetails, mergeDeepDetails } from "./latest-utils";

export type LatestPayload = TranslationResult & {
  from?: string;
  to?: string;
  ts?: number;
  context?: string;
  url?: string | null;
  pageTitle?: string | null;
  domain?: string | null;
};

type Action = "save" | "speak" | "retry" | "deep";

interface LatestTabProps {
  onNavigate?: (tab: "history" | "vocab") => void;
}

export function LatestTab({ onNavigate }: LatestTabProps) {
  const [data, setData] = useState<LatestPayload | null>(null);
  const [saved, setSaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    void chrome.storage.local.get("latestSidePanelResult").then((res) => {
      setData((res.latestSidePanelResult as LatestPayload) || null);
    });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local" || !changes.latestSidePanelResult) return;
      setData((changes.latestSidePanelResult.newValue as LatestPayload) || null);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    setDetailsOpen(false);
    setBusy(null);
    setSaved(false);
    if (!data?.originalText) return;

    let cancelled = false;
    void send("vocabulary:list", { limit: 500 })
      .then((items) => {
        if (cancelled) return;
        const normalized = data.originalText.trim().toLocaleLowerCase();
        setSaved(items.some((item) => item.word.trim().toLocaleLowerCase() === normalized));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data?.originalText, data?.ts]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (message: string, error = false) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  if (!data?.originalText) {
    return (
      <section className="foliole-result">
        <SectionHeading />
        <div className="foliole-empty">
          <strong>从一次划词开始</strong>
          在网页中选中文字并点击“译”，结果会连同原句语境一起出现在这里。
        </div>
      </section>
    );
  }

  const context = data.context?.trim();
  const sourceQuote = context && context !== data.originalText.trim() ? context : "";
  const meta = [
    data.phonetic,
    `${(data.from || "auto").toUpperCase()} → ${(data.to || "zh-CN").toUpperCase()}`,
    data.provider ? `由 ${data.provider} 翻译` : "",
  ].filter(Boolean);

  const copyTranslation = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(data.translatedText || data.errorMessage || "");
      showToast("译文已复制");
    } catch {
      showToast("复制失败，请重试", true);
    }
  };

  const speakSource = async () => {
    setBusy("speak");
    try {
      await send("tts:speak", {
        text: data.originalText,
        lang: data.from && data.from !== "auto" ? data.from : undefined,
      });
      showToast("正在朗读原文");
    } catch {
      showToast("朗读暂时不可用", true);
    } finally {
      setBusy(null);
    }
  };

  const saveWord = async () => {
    if (saved) return;
    setBusy("save");
    try {
      await send("vocabulary:add", {
        word: data.originalText,
        translation: data.translatedText,
        context: data.context,
        url: data.url,
        pageTitle: data.pageTitle,
        domain: data.domain,
        phonetic: data.phonetic,
      });
      setSaved(true);
      showToast("已加入 Foliole 生词本");
    } catch {
      showToast("加入生词本失败，请重试", true);
    } finally {
      setBusy(null);
    }
  };

  const retryTranslation = async () => {
    setBusy("retry");
    try {
      const settings = await send("settings:get");
      const providerId = chooseRetryProvider(settings, data.provider);
      const result = await send("translate:selection", {
        text: data.originalText,
        from: data.from || "auto",
        to: data.to || "zh-CN",
        context: data.context,
        url: data.url,
        pageTitle: data.pageTitle,
        domain: data.domain,
        mode: "quick",
        providerId,
      });
      const next: LatestPayload = {
        ...result,
        from: data.from,
        to: data.to,
        context: data.context,
        url: data.url,
        pageTitle: data.pageTitle,
        domain: data.domain,
        ts: Date.now(),
      };
      setData(next);
      showToast(`已改用 ${result.provider} 重新翻译`);
    } catch {
      showToast("重试失败，请到设置检查翻译服务", true);
    } finally {
      setBusy(null);
    }
  };

  const toggleDeepDetails = async () => {
    if (detailsOpen) {
      setDetailsOpen(false);
      return;
    }
    if (hasDeepDetails(data)) {
      setDetailsOpen(true);
      return;
    }

    setBusy("deep");
    try {
      const settings = await send("settings:get");
      const result = await send("translate:request", {
        text: data.originalText,
        from: data.from || "auto",
        to: data.to || "zh-CN",
        context: data.context,
        url: data.url,
        pageTitle: data.pageTitle,
        domain: data.domain,
        mode: "deep",
        providerId: settings.deepProvider,
        ieltsMode: settings.ieltsMode,
        ieltsTarget: settings.ieltsTarget,
      });
      const next = mergeDeepDetails(data, result);
      setData(next);
      await chrome.storage.local.set({ latestSidePanelResult: next });
      if (hasDeepDetails(next)) {
        setDetailsOpen(true);
      } else {
        showToast("当前引擎没有返回更多解读", true);
      }
    } catch {
      showToast("深度解读失败，请到设置检查深度解读服务", true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="foliole-result" data-testid="latest-result">
      <SectionHeading />
      <div className="foliole-result-card">
        <div className="foliole-result-top">
          <div>
            <div className="foliole-result-word">{data.originalText}</div>
            <div className="foliole-result-meta">{meta.join(" · ")}</div>
          </div>
          <button
            type="button"
            className="foliole-text-button"
            onClick={() => onNavigate?.("history")}
          >
            查看记录
          </button>
        </div>

        <div className={`foliole-result-translation ${data.isError ? "foliole-result-error" : ""}`}>
          {data.translatedText || data.errorMessage || "翻译暂时不可用"}
        </div>
        {sourceQuote && <blockquote className="foliole-source-quote">{sourceQuote}</blockquote>}

        <div className="foliole-result-actions">
          <button type="button" className="foliole-action" onClick={() => void copyTranslation()}>
            复制
          </button>
          <button
            type="button"
            className="foliole-action"
            disabled={busy === "speak"}
            onClick={() => void speakSource()}
          >
            {busy === "speak" ? "朗读中…" : "朗读"}
          </button>
          <button
            type="button"
            className={`foliole-action is-primary ${saved ? "is-saved" : ""}`}
            disabled={saved || busy === "save" || !data.translatedText}
            onClick={() => void saveWord()}
          >
            {busy === "save" ? "正在加入…" : saved ? "已加入生词本" : "加入生词本"}
          </button>
        </div>

        <div className="foliole-result-more">
          <button
            type="button"
            className="foliole-text-button"
            aria-expanded={detailsOpen}
            disabled={busy === "deep"}
            onClick={() => void toggleDeepDetails()}
          >
            {busy === "deep" ? "正在解读…" : detailsOpen ? "收起深度解读" : "查看深度解读"}
          </button>
          <button
            type="button"
            className="foliole-text-button"
            disabled={busy === "retry"}
            onClick={() => void retryTranslation()}
          >
            {busy === "retry" ? "正在重试…" : "翻译不准？重试"}
          </button>
        </div>
      </div>

      {detailsOpen && <DeepDetails data={data} />}

      <div className="foliole-next-step">
        <strong>下一步</strong>
        <button type="button" onClick={() => onNavigate?.("vocab")}>
          {saved
            ? "打开生词本，今天就能复习这张卡。"
            : "加入生词本后，Foliole 会保留原句和复习安排。"}
        </button>
      </div>

      {toast && (
        <div
          className={`foliole-toast ${toast.error ? "is-error" : ""}`}
          role={toast.error ? "alert" : "status"}
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}

function SectionHeading() {
  return (
    <div className="foliole-section-heading">
      <div>
        <h1>划词结果</h1>
        <p>保留语境，减少干扰。</p>
      </div>
      <span className="foliole-status">
        <span aria-hidden />
        即时结果
      </span>
    </div>
  );
}

function DeepDetails({ data }: { data: LatestPayload }) {
  return (
    <section className="foliole-deep-card">
      <div className="foliole-deep-label">深度解读</div>
      {data.explanation && <p>{data.explanation}</p>}
      {data.partOfSpeech && data.partOfSpeech.length > 0 && (
        <ul>
          {data.partOfSpeech.map((item, index) => (
            <li key={`${item.pos}-${index}`}>
              <strong>{item.pos}</strong> · {item.definition}
            </li>
          ))}
        </ul>
      )}
      {data.alternatives && data.alternatives.length > 0 && (
        <p>近义表达：{data.alternatives.join(" · ")}</p>
      )}
      {data.examples && data.examples.length > 0 && (
        <ul>
          {data.examples.map((example, index) => (
            <li key={`${example.src}-${index}`}>
              {example.src} — {example.tgt}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
