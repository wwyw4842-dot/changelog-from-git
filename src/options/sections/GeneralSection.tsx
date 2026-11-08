import type { Settings } from "@shared/types";
import { optionUi } from "./ui";

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void | Promise<void>;
}

const LANGS: { code: string; label: string }[] = [
  { code: "auto", label: "自动识别" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
];

export function GeneralSection({ settings, onUpdate }: Props) {
  return (
    <div className={optionUi.pageStack}>
      <Card title="划词与朗读" description="决定何时显示翻译入口，以及翻译完成后的朗读方式。">
        <Field label="划词方式">
          <select
            value={settings.triggerMode}
            onChange={(e) => onUpdate({ triggerMode: e.target.value as Settings["triggerMode"] })}
            className={optionUi.input}
          >
            <option value="selection">划词即出按钮</option>
            <option value="altSelection">按住 Alt 划词</option>
            <option value="shortcut">只通过快捷键</option>
          </select>
        </Field>
        <Field label="自动朗读原文">
          <input
            type="checkbox"
            checked={settings.autoRead}
            onChange={(e) => onUpdate({ autoRead: e.target.checked })}
          />
        </Field>
      </Card>

      <Card title="翻译语言" description="源语言通常保持自动识别，只需选择最常用的目标语言。">
        <Field label="源语言">
          <LangPicker value={settings.sourceLang} onChange={(v) => onUpdate({ sourceLang: v })} />
        </Field>
        <Field label="目标语言">
          <LangPicker value={settings.targetLang} onChange={(v) => onUpdate({ targetLang: v })} />
        </Field>
      </Card>

      <Card title="外观" description="这些设置会同时影响网页翻译气泡和学习侧栏。">
        <Field label="主题">
          <select
            value={settings.theme}
            onChange={(e) => onUpdate({ theme: e.target.value as Settings["theme"] })}
            className={optionUi.input}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </Field>
        <Field label="气泡字号">
          <input
            type="number"
            min={12}
            max={22}
            value={settings.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            className={optionUi.inputW24}
          />
        </Field>
        <Field label="气泡透明度">
          <input
            type="number"
            step={0.01}
            min={0.4}
            max={1}
            value={settings.bubbleOpacity}
            onChange={(e) => onUpdate({ bubbleOpacity: Number(e.target.value) })}
            className={optionUi.inputW24}
          />
        </Field>
      </Card>

      <Card title="雅思学习" description="开启后会显示更多雅思词汇、口语和写作辅助。">
        <Field label="雅思模式">
          <input
            type="checkbox"
            checked={settings.ieltsMode || false}
            onChange={(e) => onUpdate({ ieltsMode: e.target.checked })}
          />
          <span className={optionUi.hintInline}>
            深度解读会补充同义替换、词汇等级和学术例句；学习侧栏会显示雅思口语与写作功能。
          </span>
        </Field>
        <Field label="目标分数">
          <select
            value={settings.ieltsTarget || "7.0"}
            onChange={(e) => onUpdate({ ieltsTarget: e.target.value as Settings["ieltsTarget"] })}
            className={optionUi.input}
            disabled={!settings.ieltsMode}
          >
            <option value="6.0">6.0</option>
            <option value="6.5">6.5</option>
            <option value="7.0">7.0</option>
            <option value="7.5">7.5</option>
            <option value="8.0+">8.0+</option>
          </select>
        </Field>
      </Card>

      <Card
        title="不启用 Foliole 的网站"
        description="每行填写一个域名以停用整站，或填写完整网址以只停用该页面。"
      >
        <textarea
          value={(settings.whitelist || []).join("\n")}
          onChange={(e) =>
            onUpdate({
              whitelist: e.target.value
                .split("\n")
                .map((s) => {
                  const t = s.trim();
                  if (!t) return "";
                  return t.includes("://") ? t : t.toLowerCase();
                })
                .filter(Boolean),
            })
          }
          placeholder={"example.com\nhttps://example.com/article"}
          className={optionUi.inputH88}
        />
      </Card>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={optionUi.card}>
      <h3 className={optionUi.cardTitle}>{title}</h3>
      {description ? <p className={optionUi.cardNote}>{description}</p> : null}
      <div className={optionUi.cardBody}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={optionUi.fieldRow}>
      <span className={optionUi.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function LangPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={optionUi.input}>
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label} ({l.code})
        </option>
      ))}
    </select>
  );
}
