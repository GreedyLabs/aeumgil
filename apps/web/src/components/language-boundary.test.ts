import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageBoundary } from "./language-boundary";
import { LanguageContext, useLanguage } from "./language-context";
import { useUiText } from "./use-ui-text";
import type { Lang } from "@/lib/i18n";

function Message() {
  const t = useUiText();
  return createElement("span", { lang: useLanguage() }, t("홈"));
}

function renderLanguage(global: Lang, request: Lang) {
  return renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: global },
      createElement(Message),
      createElement(LanguageBoundary, { lang: request }, createElement(Message)),
    ),
  );
}

describe("스트리밍 영역의 요청 언어", () => {
  it("전역 언어가 바뀌어도 응답 안 문구는 요청 당시 언어로 복원한다", () => {
    expect(renderLanguage("fr", "ko")).toBe(
      '<span lang="fr">Accueil</span><span lang="ko">홈</span>',
    );
    expect(renderLanguage("en", "ko")).toBe(
      '<span lang="en">Home</span><span lang="ko">홈</span>',
    );
  });

  it("새 서버 응답의 언어가 바뀌면 같은 경계 안 문구도 새 언어를 따른다", () => {
    expect(renderLanguage("ko", "en")).toBe(
      '<span lang="ko">홈</span><span lang="en">Home</span>',
    );
    expect(renderLanguage("ko", "fr")).toBe(
      '<span lang="ko">홈</span><span lang="fr">Accueil</span>',
    );
  });
});
