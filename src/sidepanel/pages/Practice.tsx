import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { send } from "@shared/messaging";
import type { Settings, VocabularyEntry } from "@shared/types";
import { sideUi } from "./ui";

interface Turn {
  id: string;
  role: "system" | "user" | "assistant";
  text: string;
  streaming?: boolean;
}

interface Scenario {
  id: string;
  label: string;
  seed: string;
  mode: "casual" | "ielts";
  ieltsPart?: 1 | 2 | 3;
  group: "常规" | "雅思口语";
}

const SCENARIOS: Scenario[] = [
  {
    id: "cafe",
    label: "咖啡馆闲聊",
    group: "常规",
    mode: "casual",
    seed: "You are sitting in a cozy coffee shop. Greet the user warmly and ask what they would like to order. Keep the tone casual and friendly.",
  },
  {
    id: "interview",
    label: "英文面试",
    group: "常规",
    mode: "casual",
    seed: "You are a senior interviewer for a tech company. Welcome the candidate, then ask your first behavioral question. Stay professional but kind.",
  },
  {
    id: "travel",
    label: "旅行问路",
    group: "常规",
    mode: "casual",
    seed: "You are a helpful local in a foreign city. The user has just approached you looking a bit lost. Start a friendly conversation about where they want to go.",
  },
  {
    id: "casual",
    label: "日常聊天",
    group: "常规",
    mode: "casual",
    seed: "You and the user are old friends meeting after a long time. Start with a warm greeting and ask how life has been.",
  },
  {
    id: "ielts-p1",
    label: "IELTS Part 1 (日常话题)",
    group: "雅思口语",
    mode: "ielts",
    ieltsPart: 1,
    seed: "Start IELTS Speaking Part 1. Greet the candidate as an examiner would. Then pick ONE everyday topic (hometown, work/study, hobbies, food, weather, music, shopping, etc.) and ask your first short question. Subsequent questions stay on the SAME topic with 4-5 total exchanges before moving on.",
  },
  {
    id: "ielts-p2",
    label: "IELTS Part 2 (卡片独白)",
    group: "雅思口语",
    mode: "ielts",
    ieltsPart: 2,
    seed: "Give the candidate ONE IELTS Speaking Part 2 cue card. Format: `Describe a [topic]. You should say: ...; ...; ...; and explain ...`. After delivering the card, prompt them: 'You have 1 minute to prepare, then speak for 1-2 minutes. When you are ready, type or paste your answer.' When they respond, evaluate their monologue.",
  },
  {
    id: "ielts-p3",
    label: "IELTS Part 3 (深度讨论)",
    group: "雅思口语",
    mode: "ielts",
    ieltsPart: 3,
    seed: "Start IELTS Speaking Part 3. Pick an abstract discussion topic (e.g. social change, education, technology's impact, environmental issues). Ask a thought-provoking opening question requiring opinion + justification. Continue with follow-ups probing the candidate's reasoning.",
  },
];

export function PracticeTab() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [scenario, setScenario] = useState<string>("cafe");
  const [vocab, setVocab] = useState<VocabularyEntry[]>([]);
  const [selectedVocab, setSelectedVocab] = useState<Set<string>>(new Set());
  const [useAll, setUseAll] = useState(true);
  const [started, setStarted] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void send("vocabulary:list", { limit: 200 }).then(setVocab);
    void send("settings:get").then(setSettings);
    return () => {
      portRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (settings?.ieltsMode && scenario.startsWith("ielts") === false) {
      setScenario("ielts-p1");
    }
  }, [settings?.ieltsMode, scenario]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const activeVocab = useMemo(() => {
    if (useAll) return vocab.slice(0, 40);
    return vocab.filter((item) => selectedVocab.has(String(item.id)));
  }, [vocab, selectedVocab, useAll]);

  const systemPrompt = useMemo(() => {
    const sc = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];
    const wordList = activeVocab
      .map((item) => `  - "${item.word}" (${item.translation})`)
      .join("\n");

    if (sc.mode === "ielts") {
      const target = settings?.ieltsTarget || "7.0";
      return [
        "You are an official IELTS Speaking examiner running a mock test.",
        `The candidate is aiming for band ${target}.`,
        "",
        `Scenario: ${sc.seed}`,
        "",
        "Behaviour rules:",
        "1. STAY IN CHARACTER as the examiner until the candidate ends the session.",
        "2. Ask ONE question at a time. Keep your question crisp.",
        "3. Naturally use the candidate's target vocabulary when appropriate (marked with **bold**).",
        "4. After each candidate response, produce in this exact format:",
        "",
        "   [下一个问题 / Next question]",
        "   Your next examiner question here.",
        "",
        "   [评分反馈 / Feedback on previous answer]",
        "   - Fluency & Coherence: x.x — one-sentence comment",
        "   - Lexical Resource: x.x — point out 1 weak word choice + suggest a band-7+ alternative",
        "   - Grammar: x.x — highlight ONE grammar issue with correction (or 'Accurate' if none)",
        "   - Pronunciation hint: one tip (stress/link/intonation) [only for IELTS Part 1]",
        "   - Estimated Band: x.x",
        "",
        "   [范答 / Band-7+ sample answer]",
        "   One polished sentence or short paragraph the candidate could have said.",
        "",
        "   [中文点评]",
        "   用中文一句话总结提升方向。",
        "",
        "5. Scores use 0.5 increments (e.g. 6.5, 7.0).",
        "6. On the FIRST turn (before the candidate speaks), skip the feedback block and only ask your opening question.",
        "7. Do NOT output <think> tags or reasoning scaffolding.",
        "",
        activeVocab.length > 0
          ? `Candidate's target vocabulary:\n${wordList}`
          : "Candidate has no saved vocabulary yet.",
      ].join("\n");
    }

    return [
      "You are an English-speaking language partner helping a Chinese learner practice conversation.",
      "",
      `Scenario: ${sc.seed}`,
      "",
      "Strict rules for every reply:",
      "1. Keep responses SHORT (1-3 sentences).",
      "2. Sound natural and conversational, like a real native speaker.",
      "3. Try to naturally weave in the learner's vocabulary below (marked with **bold**) — but only when it fits the flow.",
      "4. After your English reply, add two lines:",
      "   - 中文翻译: (a natural Chinese translation of your reply)",
      "   - 建议: (If the user's previous English had any errors, kindly correct the most important one. If the user wrote in Chinese, gently suggest an English version. If perfect, say 'Great sentence!')",
      "5. Do not break character. Do not output <think> tags or reasoning.",
      "",
      activeVocab.length > 0
        ? `Learner's recent vocabulary to practice:\n${wordList}`
        : "Learner has no saved vocabulary yet. Focus on common useful phrases.",
    ].join("\n");
  }, [scenario, activeVocab, settings?.ieltsTarget]);

  const ensurePort = useCallback(() => {
    if (portRef.current) return portRef.current;
    const port = chrome.runtime.connect({ name: "polyglot-stream" });
    port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
      const id = activeIdRef.current;
      if (!id) return;
      setTurns((prev) =>
        prev.map((turn) => {
          if (turn.id !== id) return turn;
          if (message.type === "chunk") {
            const chunk = message.payload as { translatedText?: string };
            return { ...turn, text: chunk.translatedText || turn.text };
          }
          if (message.type === "done") {
            return { ...turn, streaming: false };
          }
          if (message.type === "error") {
            const err = message.payload as { message?: string };
            return {
              ...turn,
              text: `出错：${err?.message || "unknown"}`,
              streaming: false,
            };
          }
          return turn;
        })
      );
      if (message.type === "done" || message.type === "error") {
        activeIdRef.current = null;
      }
    });
    port.onDisconnect.addListener(() => {
      portRef.current = null;
    });
    portRef.current = port;
    return port;
  }, []);

  const send_ = (userText: string) => {
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    const nextTurns: Turn[] = [...turns];
    if (userText) nextTurns.push({ id: userId, role: "user", text: userText });
    nextTurns.push({ id: assistantId, role: "assistant", text: "...", streaming: true });
    setTurns(nextTurns);
    activeIdRef.current = assistantId;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...nextTurns
        .filter((turn) => turn.role !== "system" && !turn.streaming)
        .map((turn) => ({
          role: turn.role as "user" | "assistant",
          content: turn.text,
        })),
    ];

    const port = ensurePort();
    port.postMessage({
      type: "llm:prompt",
      payload: { messages },
    });
  };

  const start = () => {
    setTurns([]);
    setStarted(true);
    send_("");
  };

  const submit = () => {
    const value = input.trim();
    if (!value) return;
    setInput("");
    if (!started) {
      setStarted(true);
    }
    send_(value);
  };

  const stop = () => {
    portRef.current?.postMessage({ type: "translate:stream:abort" });
  };

  const reset = () => {
    stop();
    setTurns([]);
    setStarted(false);
  };

  const toggleVocabSelection = (id: number) => {
    setUseAll(false);
    setSelectedVocab((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={sideUi.practiceShell}>
      <header className={sideUi.practiceHeaderCard}>
        <div className={sideUi.practiceTopRow}>
          <span className={sideUi.practiceScenarioLabel}>
            场景
            {settings?.ieltsMode && (
              <span className={sideUi.targetBadge}>
                IELTS {settings.ieltsTarget}
              </span>
            )}
          </span>
          <span className={sideUi.practiceHeaderHint}>
            使用 {activeVocab.length} 个生词进行对话
          </span>
        </div>
        {(["常规", "雅思口语"] as const).map((group) => (
          <div key={group} className={sideUi.practiceGroupWrap}>
            <div className={sideUi.practiceGroupTitle}>
              {group}
            </div>
            <div className={sideUi.practiceScenarioTabs}>
              {SCENARIOS.filter((s) => s.group === group).map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setScenario(sc.id)}
                  className={`${sideUi.practiceScenarioButton} ${
                    scenario === sc.id ? sideUi.practiceScenarioActive : sideUi.practiceScenarioIdle
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {!started && vocab.length > 0 && (
          <div className={sideUi.practiceVocabPanel}>
            <div className={sideUi.practiceVocabHeader}>
              <span>使用哪些生词</span>
              <button
                onClick={() => setUseAll(true)}
                className={useAll ? sideUi.practiceUseAllActive : sideUi.practiceUseAllIdle}
              >
                使用最近 40 个
              </button>
            </div>
            <div className={sideUi.practiceVocabList}>
              {vocab.slice(0, 80).map((item) => {
                const active = !useAll && selectedVocab.has(String(item.id));
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleVocabSelection(item.id!)}
                    className={`${sideUi.practiceVocabChip} ${
                      active ? sideUi.practiceVocabChipActive : sideUi.practiceVocabChipIdle
                    }`}
                    title={item.translation}
                  >
                    {item.word}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {!started ? (
        <div className={sideUi.practiceEmptyCard}>
          <p>选好场景和生词后点「开始对话」。AI 会扮演对应角色，并自然地使用你最近的生词与你对话。</p>
          <p className={sideUi.practiceTip}>
            小技巧：你可以用中文回答，AI 会给你英文版建议和纠错。
          </p>
          <button
            onClick={start}
            disabled={vocab.length === 0}
            className={sideUi.practiceStartButton}
          >
            {vocab.length === 0 ? "请先添加一些生词" : "开始对话"}
          </button>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className={sideUi.practiceChatPanel}
          >
            {turns
              .filter((turn) => turn.role !== "system")
              .map((turn) => (
                <div
                  key={turn.id}
                  className={`${sideUi.practiceTurnBubble} ${
                    turn.role === "user" ? sideUi.practiceTurnUser : sideUi.practiceTurnAssistant
                  }`}
                >
                  <div className={sideUi.cardTopRow}>
                    <span>{turn.role === "user" ? "你" : "AI"}</span>
                    {turn.streaming && <span>{sideUi.stateStreaming}</span>}
                  </div>
                  <p className={sideUi.practiceMessageText}>{turn.text}</p>
                </div>
              ))}
          </div>

          <div className={sideUi.practiceComposer}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="中英文都行，按 Enter 发送"
              className={sideUi.practiceComposerInputField}
            />
            <div className={sideUi.practiceInputActions}>
              <button
                onClick={submit}
                className={sideUi.practiceSendButton}
              >
                发送
              </button>
              <button
                onClick={stop}
                className={sideUi.practiceStopButton}
              >
                停止
              </button>
              <button
                onClick={reset}
                className={sideUi.practiceResetButton}
              >
                重置
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
