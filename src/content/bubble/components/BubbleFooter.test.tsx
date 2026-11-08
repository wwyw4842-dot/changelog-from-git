import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BubbleFooter } from "./BubbleFooter";

describe("BubbleFooter", () => {
  it("renders a visible side panel action instead of an icon-only control", () => {
    const html = renderToStaticMarkup(
      <BubbleFooter
        hasDetails={false}
        showDetails={false}
        onToggleDetails={() => undefined}
        onOpenPanel={() => undefined}
      />
    );

    expect(html).toContain("<span>打开侧栏</span>");
    expect(html).toContain('title="打开侧边栏"');
  });
});
