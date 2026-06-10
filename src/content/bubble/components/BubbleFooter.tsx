import type { ReactNode } from "react";
import { UI } from "./ui";
import { ArrowRightIcon } from "./icons";

export interface BubbleFooterProps {
  /** 复制译文 */
  onCopyTarget?: () => void;
  /** 朗读原文 */
  onSpeak?: () => void;
  /** 当前是否正在朗读 */
  isSpeaking?: boolean;
  /** 停止朗读 */
  onStop?: () => void;
  /** 加入生词本 */
  onSave?: () => void;
  /** 发起深度解读 */
  onDeep?: () => void;
  /** 失败重试（仅错误时显示） */
  onRetry?: () => void;
  isError?: boolean;
  /** 本页白名单开关（未提供回调则不渲染整块） */
  currentPageWhitelisted?: boolean;
  onTogglePageWhitelist?: (enabled: boolean) => void;
  /** 详情面板的展开状态由父组件持有 */
  hasDetails: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
  /** 打开侧边栏 */
  onOpenPanel?: () => void;
}

/** 底部操作区：白名单开关 + 复制/朗读/生词本/深度/重试 + 详情/侧边栏 */
export function BubbleFooter(props: BubbleFooterProps) {
  const { isError, hasDetails, showDetails } = props;
  return (
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
      {props.isSpeaking ? (
        <ActionBtn onClick={props.onStop} hint="stop speaking">
          停止
        </ActionBtn>
      ) : (
        <ActionBtn onClick={props.onSpeak} hint="speak">
          朗读
        </ActionBtn>
      )}
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
          <button onClick={props.onToggleDetails} className={UI.subtleToolBtn}>
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
  );
}

/** 本页白名单开关：开启时复制当前页链接并加入白名单，本页不再显示气泡 */
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

/** 文字操作按钮：未传 onClick 时整个按钮不渲染 */
function ActionBtn({
  children,
  onClick,
  accent,
  hint,
}: {
  children: ReactNode;
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
