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
        <h3 className={optionUi.cardTitleStrong}>常用快捷键</h3>
        <p className={optionUi.cardNote}>先在网页中选中文字，再按下对应组合键。</p>
        <ul className={optionUi.listCompact}>
          <li>
            <kbd className={optionUi.kbd}>Alt</kbd> + <kbd className={optionUi.kbd}>T</kbd> ·
            翻译当前选中文本
          </li>
          <li>
            <kbd className={optionUi.kbd}>Alt</kbd> + <kbd className={optionUi.kbd}>Shift</kbd> +{" "}
            <kbd className={optionUi.kbd}>T</kbd> · 开始整页双语翻译
          </li>
          <li>
            <kbd className={optionUi.kbd}>Alt</kbd> + <kbd className={optionUi.kbd}>D</kbd> ·
            深度解读选中的内容
          </li>
        </ul>
        <button type="button" onClick={openShortcuts} className={optionUi.subtleButtonMt}>
          打开浏览器快捷键设置
        </button>
      </div>
    </div>
  );
}
