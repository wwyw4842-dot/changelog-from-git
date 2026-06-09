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
  fields?: Array<{ key: "apiKey" | "apiUser" | "apiBase" | "model"; label: string; placeholder?: string }>;
}

const LLM_ENGINES = ["openai", "claude", "gemini", "ollama", "deepseek", "deepseek-reason"] as const;

const PROVIDERS: ProviderMeta[] = [
  { id: "mymemory", name: "MyMemory", note: "免费兜底，质量波动大", needsKey: false, fields: [
    { key: "apiKey", label: "API Key (可选)" },
    { key: "apiUser", label: "注册邮箱 (可选)" },
  ] },
  { id: "google", name: "Google 翻译", note: "Web 免费端点，速度快", needsKey: false },
  { id: "bing", name: "Bing 翻译", note: "Web 免费端点，质量高", needsKey: false },
  { id: "deepl", name: "DeepL Free", note: "需要 API Key，欧美质量最佳", needsKey: true, fields: [
    { key: "apiKey", label: "DeepL API Key" },
    { key: "apiBase", label: "API Base", placeholder: "https://api-free.deepl.com" },
  ] },
  { id: "volcano", name: "火山引擎", note: "国内稳定，中文领域优秀", needsKey: true, fields: [
    { key: "apiKey", label: "Access Key" },
    { key: "apiUser", label: "Secret Key" },
  ] },
  { id: "openai", name: "OpenAI GPT", note: "LLM 深度解读", needsKey: true, fields: [
    { key: "apiKey", label: "API Key" },
    { key: "apiBase", label: "API Base", placeholder: "https://api.openai.com/v1" },
    { key: "model", label: "模型", placeholder: "gpt-4o-mini" },
  ] },
  { id: "deepseek", name: "DeepSeek (Chat / Reason 共用凭据)", note: "国内常用；深度翻译、例句、Reasoner 可共用同一 API Key", needsKey: true, fields: [
    { key: "apiKey", label: "API Key" },
    { key: "apiBase", label: "API Base", placeholder: "https://api.deepseek.com/v1" },
    { key: "model", label: "默认模型 (Chat)", placeholder: "deepseek-chat" },
  ] },
  { id: "deepseek-reason", name: "DeepSeek (Reasoner)", note: "与 DeepSeek(Chat) 共用 API Key；可在引擎调度中单独选 deepseek-reason 作为推理档", needsKey: true, hideConfig: true },
  { id: "claude", name: "Anthropic Claude", note: "LLM", needsKey: true, fields: [
    { key: "apiKey", label: "API Key" },
    { key: "model", label: "模型", placeholder: "claude-3-5-haiku-latest" },
  ] },
  { id: "gemini", name: "Google Gemini", note: "LLM", needsKey: true, fields: [
    { key: "apiKey", label: "API Key" },
    { key: "model", label: "模型", placeholder: "gemini-1.5-flash" },
  ] },
  { id: "ollama", name: "Ollama (本地)", note: "本地 LLM，零成本", needsKey: false, fields: [
    { key: "apiBase", label: "Endpoint", placeholder: "http://localhost:11434" },
    { key: "model", label: "模型", placeholder: "qwen2.5:7b" },
  ] },
];

export function ProvidersSection({ settings, onUpdate }: Props) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const credentials = settings.credentials || {};
  const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name || id;

  const fallback = useMemo(() => (settings.fallbackChain || []).join(","), [settings.fallbackChain]);

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
        <h3 className={optionUi.cardTitle}>引擎调度</h3>
        <div className={optionUi.sectionBody}>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>主引擎</span>
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
            <span className={optionUi.fieldLabel}>深度解读引擎</span>
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
            <span className={optionUi.fieldLabel}>高级/推理（口语批改、作文、侧栏长对话、重组文章默认可用）</span>
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
            <span className={optionUi.fieldLabel}>生词例句生成</span>
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
            例句、重组文章、雅思口语/作文等会优先使用「高级/推理」引擎；深度翻译使用「深度解读」引擎。DeepSeek 的 Chat / Reasoner 可共用
            同一 API Key，只需在「DeepSeek (Chat)」里填写。
          </p>
          <label className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>失败降级链</span>
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
        </div>
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
                <span className={optionUi.cardTextMuted}>{testResult[p.id] || ""}</span>
                <button
                  onClick={() => testProvider(p.id)}
                  disabled={testing === p.id}
                  className={optionUi.subtleButtonSm}
                >
                  测试
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
