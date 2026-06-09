import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRipple } from "@shared/useRipple";
import { uiText } from "@shared/ui-text";

export interface BubbleProps {
  originalText: string;
  translatedText: string;
  phonetic?: string;
  provider: string;
  fromCache?: boolean;
  isError?: boolean;
  errorMessage?: string;
  state: "loading" | "streaming" | "done" | "error";
  explanation?: string;
  examples?: Array<{ src: string; tgt: string }>;
  partOfSpeech?: Array<{ pos: string; definition: string }>;
  alternatives?: string[];
  position: { x: number; y: number };
  opacity?: number;
  fontSize?: number;
  onCopySource?: () => void;
  onCopyTarget?: () => void;
  onSpeak?: () => void;
  onStop?: () => void;
  onSave?: () => void;
  onRetry?: () => void;
  onDeep?: () => void;
  onOpenPanel?: () => void;
  onSwitchProvider?: () => void;
  currentPageWhitelisted?: boolean;
  onTogglePageWhitelist?: (enabled: boolean) => void;
}

export interface BubbleController {
  visible: boolean;
  pinned: boolean;
  trigger: { position: { x: number; y: number }; label: string; onClick: () => void } | null;
  bubble: BubbleProps | null;
}

interface Props {
  controller: BubbleController;
  onPinChange: (pinned: boolean) => void;
  onClose: () => void;
}

const BUBBLE_MARGIN = 12;
const UI = {
  trigger: "poly-trigger-base",
  bubble: "poly-bubble-base poly-surface flex flex-col overflow-hidden",
  header:
    "poly-drag-handle flex items-center justify-between border-b border-[rgba(120,90,80,0.12)] px-3 py-2 text-[11px] uppercase tracking-[0.14em]",
  rowInline: "flex items-center gap-2",
  rowInlineTight: "flex items-center gap-1",
  brandDot: "poly-brand-dot",
  text70:
    "poly-serif text-[11px] font-semibold tracking-[0.18em] text-[#9a4a3d]",
  text50: "text-[10px] font-medium tracking-[0.12em] text-[#867566]",
  body: "poly-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3",
  detailsPanel:
    "mt-2 space-y-3 rounded-xl border border-[rgba(120,90,80,0.10)] bg-[#fbf6f1] p-3 text-[12.5px]",
  sectionTitle:
    "poly-serif mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a4a3d]",
  tagsWrap: "flex flex-wrap gap-1",
  altTag:
    "rounded-full border border-[rgba(184,95,80,0.30)] bg-[#fbf0eb] px-2 py-0.5 text-[11px] font-medium text-[#9a4a3d] transition hover:bg-[#f4dcd1]",
  explanationText:
    "poly-prose m-0 text-[13.5px] !leading-[1.75] text-[#43382e]",
  listTight: "m-0 list-none space-y-0.5 p-0",
  posItem: "flex gap-2 text-[12px]",
  posLabel: "poly-serif font-semibold text-[#9a4a3d]",
  examplesList: "m-0 list-none space-y-1.5 p-0",
  exampleTgt: "text-[#867566]",
  footer:
    "flex flex-wrap items-center gap-1 border-t border-[rgba(120,90,80,0.12)] bg-[rgba(244,236,230,0.4)] px-3 py-2",
  whitelistWrap:
    "mr-1 flex select-none items-center gap-1.5 text-[11px] text-[#867566]",
  nowrap: "whitespace-nowrap",
  rightTools: "ml-auto flex items-center gap-1",
  subtleToolBtn:
    "rounded-md px-2 py-1 text-[11px] text-[#867566] transition hover:bg-[rgba(244,236,230,0.7)] hover:text-[#43382e] active:scale-95",
  valueRow: "flex gap-2 text-[13px]",
  valueLabel:
    "min-w-[40px] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a89886]",
  valueBase: "whitespace-pre-wrap break-words",
  valueEmphasized:
    "poly-serif whitespace-pre-wrap break-words font-semibold text-[15px] text-[#1a1612]",
  valueSmall: "whitespace-pre-wrap break-words text-[12px] text-[#5e4f43]",
  valueMuted: "whitespace-pre-wrap break-words text-[#867566]",
  valueError: "whitespace-pre-wrap break-words text-rose-600",
  valueEmphasizedMuted:
    "poly-serif whitespace-pre-wrap break-words font-semibold text-[15px] text-[#867566]",
  valueEmphasizedError:
    "poly-serif whitespace-pre-wrap break-words font-semibold text-[15px] text-rose-600",
  valueSmallMuted: "whitespace-pre-wrap break-words text-[12px] text-[#a89886]",
  valueSmallError: "whitespace-pre-wrap break-words text-[12px] text-rose-600",
  valueMutedError: "whitespace-pre-wrap break-words text-rose-500",
  iconBtnActive:
    "rounded-md px-1.5 py-0.5 text-[12px] transition bg-[#fbf0eb] text-[#9a4a3d] ring-1 ring-inset ring-[rgba(184,95,80,0.30)]",
  iconBtnIdle:
    "rounded-md px-1.5 py-0.5 text-[12px] transition text-[#867566] hover:bg-[rgba(244,236,230,0.7)] hover:text-[#43382e] active:scale-95",
  whitelistSwitchOn:
    "relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full p-[3px] transition-all duration-200 bg-gradient-to-r from-[#d99989] via-[#b85f50] to-[#9a4a3d] shadow-[0_4px_12px_-2px_rgba(184,95,80,0.40)]",
  whitelistSwitchOff:
    "relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full p-[3px] transition-all duration-200 bg-[#dfd3c8] dark:bg-[#43382e]",
  whitelistKnobOn:
    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-[0_2px_6px_rgba(184,95,80,0.40)] transition-transform duration-200 ease-out translate-x-[18px]",
  whitelistKnobOff:
    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out translate-x-0",
  actionBtnAccent:
    "poly-ripple rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white bg-gradient-to-r from-[#d99989] via-[#b85f50] to-[#9a4a3d] shadow-[0_4px_14px_-4px_rgba(184,95,80,0.50)] transition hover:brightness-105 active:scale-95",
  actionBtnDefault:
    "rounded-lg px-2.5 py-1 text-[12px] text-[#43382e] bg-[#fbf6f1] border border-[rgba(120,90,80,0.15)] transition hover:border-[rgba(184,95,80,0.30)] hover:bg-[#fbf0eb] hover:text-[#9a4a3d] active:scale-95 dark:bg-[#43382e] dark:border-[rgba(255,230,210,0.15)] dark:text-[#f1ede8]",
} as const;

export function Bubble({ controller, onPinChange, onClose }: Props) {
  // 在 content script 的 document 上挂 ripple 监听（用 composedPath 跨 Shadow DOM）
  useRipple();
  return (
    <>
      {controller.trigger && <Trigger {...controller.trigger} />}
      {controller.visible && controller.bubble && (
        <BubbleCard
          {...controller.bubble}
          pinned={controller.pinned}
          onTogglePin={() => onPinChange(!controller.pinned)}
          onClose={onClose}
        />
      )}
    </>
  );
}

function Trigger({
  position,
  label,
  onClick,
}: {
  position: { x: number; y: number };
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        pointerEvents: "auto",
      }}
      className={UI.trigger}
    >
      {label}
    </button>
  );
}

interface CardProps extends BubbleProps {
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

function BubbleCard(props: CardProps) {
  const {
    originalText,
    translatedText,
    phonetic,
    fromCache,
    isError,
    errorMessage,
    state,
    explanation,
    examples,
    partOfSpeech,
    opacity = 0.97,
    fontSize = 14,
  } = props;
  const [showDetails, setShowDetails] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const startPosRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  const style = useMemo(() => {
    const { x, y, width, height } = clampPosition(props.position, dragOffset);
    return {
      position: "fixed" as const,
      left: x,
      top: y,
      width,
      maxHeight: height,
      pointerEvents: "auto" as const,
      "--poly-bubble-opacity": opacity,
      fontSize,
    };
  }, [props.position, dragOffset, opacity, fontSize]);

  useEffect(() => {
    setDragOffset({ dx: 0, dy: 0 });
  }, [props.position.x, props.position.y]);

  const startDrag = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startPosRef.current = {
        x: event.clientX,
        y: event.clientY,
        dx: dragOffset.dx,
        dy: dragOffset.dy,
      };
      const onMove = (e: MouseEvent) => {
        if (!startPosRef.current) return;
        setDragOffset({
          dx: startPosRef.current.dx + (e.clientX - startPosRef.current.x),
          dy: startPosRef.current.dy + (e.clientY - startPosRef.current.y),
        });
      };
      const onUp = () => {
        startPosRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [dragOffset]
  );

  const { alternatives } = props;
  const hasDetails = Boolean(
    explanation ||
      (examples && examples.length) ||
      (partOfSpeech && partOfSpeech.length) ||
      (alternatives && alternatives.length)
  );

  return (
    <div style={style} className={UI.bubble} onMouseDown={(e) => e.stopPropagation()}>
      <header onMouseDown={startDrag} className={UI.header}>
        <div className={UI.rowInline}>
          <span className={UI.brandDot} />
          <span className={UI.text70}>Polyglot</span>
          {(state === "streaming" || fromCache) && (
            <span className={UI.text50}>
              · {state === "streaming" ? "流式中" : "缓存"}
            </span>
          )}
        </div>
        <div className={UI.rowInlineTight}>
          <IconBtn title="固定" active={props.pinned} onClick={props.onTogglePin}>
            <PinIcon />
          </IconBtn>
          <IconBtn title="关闭" onClick={props.onClose}>
            <CloseIcon />
          </IconBtn>
        </div>
      </header>

      <div className={UI.body} onWheel={(e) => e.stopPropagation()}>
        <Row
          value={translatedText || (state === "loading" ? uiText.translating : "")}
          emphasized
          error={isError}
        />
        <Row value={originalText} muted />
        {phonetic && <Row label="音标" value={phonetic} small />}
        {isError && errorMessage && <Row label="错误" value={errorMessage} error />}

        {hasDetails && showDetails && (
          <div className={UI.detailsPanel}>
            {alternatives && alternatives.length > 0 && (
              <section>
                <div className={UI.sectionTitle}>同义替换 / Paraphrase</div>
                <div className={UI.tagsWrap}>
                  {alternatives.map((alt, idx) => (
                    <span key={idx} className={UI.altTag}>
                      {alt}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {explanation && (
              <section>
                <div className={UI.sectionTitle}>解读</div>
                <p className={UI.explanationText}>{explanation}</p>
              </section>
            )}
            {partOfSpeech && partOfSpeech.length > 0 && (
              <section>
                <div className={UI.sectionTitle}>词性</div>
                <ul className={UI.listTight}>
                  {partOfSpeech.map((p, idx) => (
                    <li key={idx} className={UI.posItem}>
                      <span className={UI.posLabel}>{p.pos}</span>
                      <span>{p.definition}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {examples && examples.length > 0 && (
              <section>
                <div className={UI.sectionTitle}>例句</div>
                <ul className={UI.examplesList}>
                  {examples.map((ex, idx) => (
                    <li key={idx}>
                      <div>{ex.src}</div>
                      <div className={UI.exampleTgt}>{ex.tgt}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      <footer className={UI.footer}>
        {props.onTogglePageWhitelist && (
          <div className={UI.whitelistWrap}>
            <span className={UI.nowrap}>本页白名单</span>
            <PageWhitelistSwitch
              enabled={Boolean(props.currentPageWhitelisted)}
              onChange={props.onTogglePageWhitelist}
            />
          </div>
        )}
        <ActionBtn onClick={props.onCopyTarget} hint="copy target">
          复制
        </ActionBtn>
        <ActionBtn onClick={props.onSpeak} hint="speak">
          朗读
        </ActionBtn>
        <ActionBtn onClick={props.onSave} hint="save">
          生词本
        </ActionBtn>
        <ActionBtn onClick={props.onDeep} hint="deep" accent>
          深度
        </ActionBtn>
        {isError && (
          <ActionBtn onClick={props.onRetry} hint="retry">
            重试
          </ActionBtn>
        )}
        <span className={UI.rightTools}>
          {hasDetails && (
            <button onClick={() => setShowDetails((v) => !v)} className={UI.subtleToolBtn}>
              {showDetails ? "收起" : "详情"}
            </button>
          )}
          {props.onOpenPanel && (
            <button
              onClick={props.onOpenPanel}
              className={UI.subtleToolBtn}
              title="打开侧边栏"
              aria-label="打开侧边栏"
            >
              <ArrowRightIcon />
            </button>
          )}
        </span>
      </footer>
    </div>
  );
}

function Row({
  label,
  value,
  emphasized,
  error,
  small,
  muted,
}: {
  label?: string;
  value: string;
  emphasized?: boolean;
  error?: boolean;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={UI.valueRow}>
      {label && <span className={UI.valueLabel}>{label}</span>}
      <span className={valueClass(emphasized, small, muted, error)}>{value}</span>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={active ? UI.iconBtnActive : UI.iconBtnIdle}
    >
      {children}
    </button>
  );
}

function PageWhitelistSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      title={
        enabled
          ? "已加入本页白名单，关闭可恢复气泡"
          : "开启：复制当前页链接并加入白名单，本页不再显示气泡"
      }
      onClick={(e) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={enabled ? UI.whitelistSwitchOn : UI.whitelistSwitchOff}
    >
      <span className={enabled ? UI.whitelistKnobOn : UI.whitelistKnobOff} />
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  accent,
  hint,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: boolean;
  hint?: string;
}) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      title={hint}
      className={accent ? UI.actionBtnAccent : UI.actionBtnDefault}
    >
      {children}
    </button>
  );
}

function valueClass(emphasized?: boolean, small?: boolean, muted?: boolean, error?: boolean) {
  if (error) {
    if (emphasized) return UI.valueEmphasizedError;
    if (small) return UI.valueSmallError;
    if (muted) return UI.valueMutedError;
    return UI.valueError;
  }
  if (emphasized) {
    if (muted) return UI.valueEmphasizedMuted;
    return UI.valueEmphasized;
  }
  if (small) {
    if (muted) return UI.valueSmallMuted;
    return UI.valueSmall;
  }
  if (muted) return UI.valueMuted;
  return UI.valueBase;
}

function clampPosition(
  target: { x: number; y: number },
  offset: { dx: number; dy: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(420, window.innerWidth - BUBBLE_MARGIN * 2);
  const height = Math.min(480, window.innerHeight - BUBBLE_MARGIN * 2);
  let x = target.x + BUBBLE_MARGIN + offset.dx;
  let y = target.y + BUBBLE_MARGIN + offset.dy;
  if (x + width > window.innerWidth - BUBBLE_MARGIN) {
    x = Math.max(BUBBLE_MARGIN, window.innerWidth - width - BUBBLE_MARGIN);
  }
  if (y + height > window.innerHeight - BUBBLE_MARGIN) {
    y = Math.max(BUBBLE_MARGIN, target.y - height - BUBBLE_MARGIN + offset.dy);
  }
  if (x < BUBBLE_MARGIN) x = BUBBLE_MARGIN;
  if (y < BUBBLE_MARGIN) y = BUBBLE_MARGIN;
  return { x, y, width, height };
}

/* ============ Inline line icons（无外部依赖） ============ */

function PinIcon() {
  // 图钉：竖直钉柱 + 顶部斜帽 + 底部小尖
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M9 4h6l-1.5 4 3 3-4 1.5L11 21l-1.5-8.5L5 11l3-3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
