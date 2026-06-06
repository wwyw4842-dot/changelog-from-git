import { optionUi } from "./ui";

export function ShortcutsSection() {
  const openShortcuts = () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch(() => {
      window.open("edge://extensions/shortcuts", "_blank");
    });
  };

  return (
    <div className={optionUi.pageStack}>
      <div className={optionUi.cardTextBody}>
        <p>已注册的全局快捷键：</p>
        <ul className={optionUi.listCompact}>
          <li>
            <kbd className={optionUi.kbd}>Alt</kbd> + <kbd className={optionUi.kbd}>T</kbd> · 翻译当前选中文本
          </li>
          <li>
            <kbd className={optionUi.kbd}>Alt</kbd> + <kbd className={optionUi.kbd}>Shift</kbd> +{" "}
            <kbd className={optionUi.kbd}>T</kbd> · 沉浸式整页翻译（Phase 7 启用）
          </li>
          <li>
            <kbd className={optionUi.kbd}>Alt</kbd> + <kbd className={optionUi.kbd}>D</kbd> · 深度 AI 解读（Phase 2
            启用）
          </li>
        </ul>
        <button
          onClick={openShortcuts}
          className={optionUi.subtleButtonMt}
        >
          打开浏览器快捷键设置
        </button>
      </div>
    </div>
  );
}
