/**
 * 将 Chrome 扩展运行时错误转为对用户可读的说明。
 * 常见于：在开发者工具里点了「重新加载」扩展、扩展自动更新后，旧内容脚本仍挂在页面上。
 */
export function mapChromeRuntimeError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  if (/extension context invalidated/i.test(raw) || /context invalidated/i.test(raw)) {
    return new Error(
      "扩展刚被重新加载或更新，本页与扩展的连接已断开。请按 F5（或 Ctrl+R）刷新本页面后再翻译。"
    );
  }
  if (
    /could not establish connection/i.test(raw) ||
    /receiving end does not exist/i.test(raw) ||
    /message port closed before a response was received/i.test(raw)
  ) {
    return new Error("无法连接扩展后台，请刷新本页或确认扩展已启用。");
  }
  return error instanceof Error ? error : new Error(raw);
}
