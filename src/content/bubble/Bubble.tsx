import { useState } from "react";
import { useRipple } from "@shared/useRipple";
import { uiText } from "@shared/ui-text";
import { useBubblePosition } from "./useBubblePosition";
import { UI } from "./components/ui";
import { Trigger } from "./components/Trigger";
import { Row } from "./components/Row";
import { IconBtn } from "./components/IconBtn";
import { DetailsPanel, hasDeepDetails } from "./components/DetailsPanel";
import { BubbleFooter } from "./components/BubbleFooter";
import { PinIcon, CloseIcon } from "./components/icons";

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

interface CardProps extends BubbleProps {
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

/** 气泡卡片：持有展开状态并编排 header / 正文 / 深度解读 / 底部操作区 */
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
    alternatives,
    opacity = 0.97,
    fontSize = 14,
  } = props;
  const [showDetails, setShowDetails] = useState(false);
  // 定位 / 视口收敛 / header 拖拽都封装在 hook 里
  const { style, startDrag } = useBubblePosition(props.position, opacity, fontSize);

  const hasDetails = hasDeepDetails({ explanation, examples, partOfSpeech, alternatives });

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
          <DetailsPanel
            explanation={explanation}
            examples={examples}
            partOfSpeech={partOfSpeech}
            alternatives={alternatives}
          />
        )}
      </div>

      <BubbleFooter
        onCopyTarget={props.onCopyTarget}
        onSpeak={props.onSpeak}
        onSave={props.onSave}
        onDeep={props.onDeep}
        onRetry={props.onRetry}
        isError={isError}
        currentPageWhitelisted={props.currentPageWhitelisted}
        onTogglePageWhitelist={props.onTogglePageWhitelist}
        hasDetails={hasDetails}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails((v) => !v)}
        onOpenPanel={props.onOpenPanel}
      />
    </div>
  );
}
