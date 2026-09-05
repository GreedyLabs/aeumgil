"use client";

/** 모바일은 시스템 공유, 데스크톱은 현재 조건을 포함한 URL 복사. */
export async function shareCurrentPage(title: string, notify: (message: string) => void): Promise<void> {
  try {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); notify("링크를 복사했어요"); }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    notify("공유하지 못했어요. 주소창의 링크를 복사해 주세요");
  }
}
