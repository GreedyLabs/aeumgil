"use client";
import { formatEventProgress } from "@/lib/detail-screen-messages";
import { useLanguage } from "@/components/language-context";
import { localized } from "@/lib/i18n";
import { useUiText } from "@/components/use-ui-text";
import Link from "next/link";
import { useState } from "react";
import { InfiniteScroll } from "@/components/infinite-scroll";

import type { FestivalListing } from "@/domain/types";
import { UI, Icon } from "./_ui";

export function FestivalList({ listing }: { listing: FestivalListing }) {
  const translateUi = useUiText();
  const lang = useLanguage();
  const [visible, setVisible] = useState(12);
  return (
    <section className="festival-section" aria-label={translateUi("다가오는 강원 행사")}>
      <div className="results-heading">
        <h2>
          {translateUi("다가오는 강원 행사 ")}
          <span>{translateUi(listing.items.length)}</span>
        </h2>
        <span>{translateUi("앞으로 30일 · 한국관광공사")}</span>
      </div>
      <p className="section-description">
        {translateUi(
          "현재 진행 중이거나 앞으로 30일 안에 시작하는 행사예요. 일정은 주최 측 사정에 따라 달라질 수 있어요.",
        )}
      </p>
      {listing.items.length ? (
        <>
          <div className="commerce-grid">
            {listing.items.slice(0, visible).map((event) => (
              <article className="card festival-card" key={event.id}>
                <UI.Placeholder label={localized(event.name, lang)} src={event.imageUrl} h={190} />
                <div className="commerce-body">
                  <span className="eyebrow">
                    {translateUi(event.startsOn.replaceAll("-", "."))} —{" "}
                    {translateUi(event.endsOn.replaceAll("-", "."))}
                  </span>
                  <h3>{localized(event.name, lang)}</h3>
                  <p>{translateUi(event.address)}</p>
                  <Link className="text-link" href={`/festival/${event.id}`}>
                    {translateUi("행사 자세히 보기 ")}
                    <Icon.chevR />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <InfiniteScroll
            label={translateUi("행사 목록")}
            id="festival-scroll-boundary"
            hasMore={visible < listing.items.length}
            progressKey={visible}
            resetKey={listing.items.map((event) => event.id).join(",")}
            onLoadMore={() => setVisible((value) => Math.min(value + 12, listing.items.length))}
          >
            {formatEventProgress(
              Math.min(visible, listing.items.length),
              listing.items.length,
              lang,
            )}
          </InfiniteScroll>
        </>
      ) : (
        <div className="empty-state">
          <Icon.clock />
          <h2>
            {translateUi(
              listing.status === "available"
                ? "공개된 예정 행사가 없어요"
                : "행사 정보를 불러오지 못했어요",
            )}
          </h2>
          <p>
            {translateUi(
              listing.status === "available"
                ? "현재 조회 기간에 등록된 강원 행사 정보가 없어요. 테마 코스에서 여행을 찾아보세요."
                : "잠시 후 다시 확인해 주세요. 테마 코스는 계속 살펴볼 수 있어요.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
