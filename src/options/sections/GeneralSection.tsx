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
      <Card title="触发方式">
        <Field label="触发模式">
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
        <Field label="翻译后自动朗读原文">
          <input
            type="checkbox"
            checked={settings.autoRead}
            onChange={(e) => onUpdate({ autoRead: e.target.checked })}
          />
        </Field>
      </Card>

      <Card title="语言">
        <Field label="源语言">
          <LangPicker
            value={settings.sourceLang}
            onChange={(v) => onUpdate({ sourceLang: v })}
          />
        </Field>
        <Field label="目标语言">
          <LangPicker
            value={settings.targetLang}
            onChange={(v) => onUpdate({ targetLang: v })}
          />
        </Field>
      </Card>

      <Card title="外观">
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
        <Field label="气泡不透明度 (0.4-1)">
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

      <Card title="考试模式">
        <Field label="开启雅思模式">
          <input
            type="checkbox"
            checked={settings.ieltsMode || false}
            onChange={(e) => onUpdate({ ieltsMode: e.target.checked })}
          />
          <span className={optionUi.hintInline}>
            启用后「深度解读」返回同义替换、词汇等级、学术例句；口语陪练加入雅思 P1/P2/P3；
            侧边栏新增「写作批改」Tab。
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

      <Card title="白名单（域名整站，或完整 URL 仅单页）">
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
          placeholder={"example.com\n或完整页面地址（从气泡「本页白名单」可一键添加）"}
          className={optionUi.inputH88}
        />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={optionUi.card}>
      <h3 className={optionUi.cardTitle}>{title}</h3>
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
