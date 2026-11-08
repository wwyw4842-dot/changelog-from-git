import { useMemo, useState } from "react";
import type { Settings } from "@shared/types";
import { send } from "@shared/messaging";
import { optionUi } from "./ui";

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void | Promise<void>;
}

interface ProviderMeta {
  id: string;
  name: string;
  note: string;
  needsKey: boolean;
  /** 不在下方展示配置卡片（与另一条引擎共享凭据，例如 deepseek-reason 复用 deepseek） */
  hideConfig?: boolean;
  fields?: Array<{
    key: "apiKey" | "apiUser" | "apiBase" | "model";
    label: string;
    placeholder?: string;
  }>;
}

const LLM_ENGINES = [
  "openai",
  "claude",
  "gemini",
  "ollama",
  "deepseek",
  "deepseek-reason",
  "mimo",
  "mimo-pro",
] as const;

const PROVIDERS: ProviderMeta[] = [
  {
    id: "mymemory",
    name: "MyMemory",
    note: "无需配置即可使用，也可填写账户信息提高额度。",
    needsKey: false,
    fields: [
      { key: "apiKey", label: "API Key（可选）" },
      { key: "apiUser", label: "注册邮箱（可选）" },
    ],
  },
  { id: "google", name: "Google 翻译", note: "无需配置，适合快速翻译。", needsKey: false },
  { id: "bing", name: "Bing 翻译", note: "无需配置，可作为备用翻译服务。", needsKey: false },
  {
    id: "deepl",
    name: "DeepL Free",
    note: "需要 API Key，适合欧洲语言翻译。",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "DeepL API Key" },
      { key: "apiBase", label: "服务地址（API Base）", placeholder: "https://api-free.deepl.com" },
    ],
  },
  {
    id: "volcano",
    name: "火山引擎",
    note: "国内稳定，中文领域优秀",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "Access Key" },
      { key: "apiUser", label: "Secret Key" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    note: "用于深度解读、例句和学习辅助。",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiBase", label: "服务地址（API Base）", placeholder: "https://api.openai.com/v1" },
      { key: "model", label: "模型", placeholder: "gpt-4o-mini" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    note: "一份凭据可同时用于 V4 Flash 和 V4 Pro。",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiBase", label: "服务地址（API Base）", placeholder: "https://api.deepseek.com/v1" },
      { key: "model", label: "默认模型（V4 Flash）", placeholder: "deepseek-v4-flash" },
    ],
  },
  {
    id: "deepseek-reason",
    name: "DeepSeek V4 Pro",
    note: "与 DeepSeek 共用凭据。",
    needsKey: true,
    hideConfig: true,
  },
  {
    id: "mimo",
    name: "小米 MiMo",
    note: "一份凭据可同时用于 V2.5 和 V2.5 Pro。",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "API Key" },
      {
        key: "apiBase",
        label: "服务地址（API Base）",
        placeholder: "https://api.xiaomimimo.com/v1",
      },
      { key: "model", label: "默认模型（V2.5）", placeholder: "mimo-v2.5" },
    ],
  },
  {
    id: "mimo-pro",
    name: "小米 MiMo V2.5 Pro",
    note: "与小米 MiMo 共用凭据。",
    needsKey: true,
    hideConfig: true,
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    note: "LLM",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "model", label: "模型", placeholder: "claude-3-5-haiku-latest" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    note: "LLM",
    needsKey: true,
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "model", label: "模型", placeholder: "gemini-1.5-flash" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (本地)",
    note: "所有在线翻译都失败时，自动使用本机 Qwen 保障。",
    needsKey: false,
    fields: [
      { key: "apiBase", label: "本地服务地址", placeholder: "http://127.0.0.1:11434" },
      { key: "model", label: "模型", placeholder: "qwen2.5:0.5b" },
    ],
  },
];

export function ProvidersSection({ settings, onUpdate }: Props) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const credentials = settings.credentials || {};
  const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name || id;

  const fallback = useMemo(
    () => (settings.fallbackChain || []).join(","),
    [settings.fallbackChain]
  );

  const updateCreds = async (providerId: string, patch: Record<string, string>) => {
    const nextCreds = {
      ...credentials,
      [providerId]: { ...(credentials[providerId] || {}), ...patch },
    };
    await onUpdate({ credentials: nextCreds });
  };

  const testProvider = async (providerId: string) => {
    setTesting(providerId);
    setTestResult((prev) => ({ ...prev, [providerId]: "测试中..." }));
    try {
      const res = await send("provider:test", { providerId });
      setTestResult((prev) => ({
        ...prev,
        [providerId]: res.ok ? `✓ ${res.message || "通过"}` : `✗ ${res.message || "失败"}`,
      }));
    } catch (error) {
      setTestResult((prev) => ({
        ...prev,
        [providerId]: `✗ ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className={optionUi.pageStack}>
      <div className={optionUi.card}>
        <h3 className={optionUi.cardTitle}>各项功能使用哪个服务</h3>
        <p className={optionUi.cardNote}>
          可以先沿用默认选择；只有带有 API Key 的服务需要在下方连接。
        </p>
        <div className={optionUi.sectionBody}>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>快速翻译</span>
            <select
              value={settings.primaryProvider}
              onChange={(e) => onUpdate({ primaryProvider: e.target.value })}
              className={optionUi.input}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>深度解读</span>
            <select
              value={settings.deepProvider}
              onChange={(e) => onUpdate({ deepProvider: e.target.value })}
              className={optionUi.input}
            >
              {LLM_ENGINES.map((id) => (
                <option key={id} value={id}>
                  {providerName(id)}
                </option>
              ))}
            </select>
          </label>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>学习与写作</span>
            <select
              value={settings.llmProProvider}
              onChange={(e) => onUpdate({ llmProProvider: e.target.value })}
              className={optionUi.inputMax320}
            >
              {LLM_ENGINES.map((id) => (
                <option key={id} value={id}>
                  {providerName(id)}
                </option>
              ))}
            </select>
          </label>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>例句生成</span>
            <select
              value={settings.vocabExampleProvider}
              onChange={(e) => onUpdate({ vocabExampleProvider: e.target.value })}
              className={optionUi.inputMax320}
            >
              {LLM_ENGINES.map((id) => (
                <option key={id} value={id}>
                  {providerName(id)}
                </option>
              ))}
            </select>
          </label>
          <p className={optionUi.cardTextMuted}>
            口语反馈、作文批改、长对话和重组文章会使用「学习与写作」服务。DeepSeek 和 MiMo
            的普通版与 Pro 版各自共用一份凭据，无需重复填写。
          </p>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>在线备用服务顺序</span>
            <input
              type="text"
              value={fallback}
              onChange={(e) =>
                onUpdate({
                  fallbackChain: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className={optionUi.inputW80}
              placeholder="google,bing,mymemory"
            />
          </label>
          <p className={optionUi.cardTextMuted}>
            本地保障：Qwen（固定最后尝试，不需要填写到上面的顺序中）。
          </p>
        </div>
      </div>

      <div className={optionUi.groupHeading}>
        <h2>连接服务</h2>
        <p>填写你准备使用的服务凭据，并通过“测试连接”确认是否可用。</p>
      </div>

      <div className={optionUi.cardsStack}>
        {PROVIDERS.filter((p) => !p.hideConfig).map((p) => (
          <div key={p.id} className={optionUi.card}>
            <div className={optionUi.rowBetween}>
              <div>
                <p className={optionUi.cardTitleStrong}>{p.name}</p>
                <p className={optionUi.cardNote}>{p.note}</p>
              </div>
              <div className={optionUi.rowInlineMeta}>
                <span className={optionUi.cardTextMuted} role="status" aria-live="polite">
                  {testResult[p.id] || ""}
                </span>
                <button
                  type="button"
                  onClick={() => testProvider(p.id)}
                  disabled={testing === p.id}
                  className={optionUi.subtleButtonSm}
                >
                  {testing === p.id ? "测试中…" : "测试连接"}
                </button>
              </div>
            </div>
            {p.fields && (
              <div className={optionUi.credentialsGrid}>
                {p.fields.map((f) => (
                  <label key={f.key} className={optionUi.fieldColumn}>
                    <span>{f.label}</span>
                    <input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      value={(credentials[p.id]?.[f.key] as string | undefined) || ""}
                      placeholder={f.placeholder}
                      onChange={(e) => updateCreds(p.id, { [f.key]: e.target.value })}
                      className={optionUi.inputMono}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
