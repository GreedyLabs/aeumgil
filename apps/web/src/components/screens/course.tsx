"use client";

// CourseView — Phase 1b. 코스 타임라인(혼잡도 포함). 데이터는 서버에서 주입.
import { useState } from "react";
import { localized, type Lang } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Course, CourseItem, Eat, Spot, Stay, Theme } from "@/domain/types";

const { TopBar, Signal, Placeholder } = UI;

interface Props {
  theme: Theme;
  course: Course;
  spots: Record<string, Spot>;
  eats: Record<string, Eat>;
  stays: Record<string, Stay>;
}

export function CourseView({ theme, course, spots, eats, stays }: Props) {
  const { lang } = useAppState();
  const { nav } = useAppNav();
  const [day, setDay] = useState(1);

  const items = course.items.filter((it) => it.day === day);
  const busy = items.some((it) => it.kind === "spot" && spots[it.refId]?.congestion === "busy");

  return (
    <div className="screen-enter">
      <TopBar
        title={lang === "ko" ? "코스 상세" : "Course"}
        onBack={() => nav("theme", { themeId: theme.id })}
        right={
          <>
            <button className="icon-btn">
              <Icon.bookmark />
            </button>
            <button className="icon-btn">
              <Icon.share />
            </button>
          </>
        }
      />

      <div style={{ padding: "4px 20px 14px" }}>
        <div className="section-label" style={{ color: `oklch(0.48 0.1 ${theme.hue})` }}>
          {localized(theme.tag, lang)} · {localized(theme.region, lang)}
        </div>
        <h1 className="serif" style={{ fontSize: 28, margin: "2px 0 8px", lineHeight: 1.15 }}>
          {localized(course.title, lang)}
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {lang === "ko"
            ? `${course.dayCount}일 · ${localized(theme.pace, lang)} · ${theme.spotCount}개 장소`
            : `${course.dayCount}d · ${localized(theme.pace, lang)}`}
        </div>
      </div>

      {busy && (
        <div
          style={{ margin: "0 20px 14px", padding: 14, background: "var(--moderate-bg)", border: "1px solid color-mix(in oklab, var(--moderate) 25%, transparent)", borderRadius: "var(--r-md)" }}
        >
          <div style={{ fontSize: 12, color: "var(--moderate)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "ko" ? "혼잡 분산 제안" : "Reroute suggested"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            {lang === "ko"
              ? "혼잡 장소가 포함된 코스예요. 같은 테마의 한적한 대체지로 바꿔볼 수 있어요."
              : "This course includes a busy spot. We can swap in a quieter alternative."}
          </div>
          <button className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} onClick={() => nav("alternative", { themeId: theme.id })}>
            <Icon.refresh /> {lang === "ko" ? "대체지 보기" : "See alternatives"}
          </button>
        </div>
      )}

      {course.dayCount > 1 && (
        <div style={{ display: "flex", gap: 6, padding: "0 20px 10px" }}>
          {Array.from({ length: course.dayCount }).map((_, i) => {
            const d = i + 1;
            return (
              <button key={d} onClick={() => setDay(d)} className={"chip" + (day === d ? " active" : "")}>
                {`Day ${d}`}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button className="chip">
            <Icon.filter /> {lang === "ko" ? "조건" : "Tune"}
          </button>
        </div>
      )}

      <div style={{ padding: "4px 20px 0", position: "relative" }}>
        <div style={{ position: "absolute", left: 46, top: 8, bottom: 8, width: 1.5, background: "var(--line-2)" }} />
        {items.map((it, i) => (
          <CourseTimelineItem
            key={i}
            item={it}
            lang={lang}
            spots={spots}
            eats={eats}
            stays={stays}
            isLast={i === items.length - 1}
            onNavSpot={(id) => nav("spot", { spotId: id })}
          />
        ))}
      </div>

      <div style={{ padding: "22px 20px 32px", display: "flex", gap: 10 }}>
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={() => nav("saved")}>
          <Icon.bookmark /> {lang === "ko" ? "내 여행에 저장" : "Save trip"}
        </button>
      </div>
    </div>
  );
}

interface ItemProps {
  item: CourseItem;
  lang: Lang;
  spots: Record<string, Spot>;
  eats: Record<string, Eat>;
  stays: Record<string, Stay>;
  isLast: boolean;
  onNavSpot: (id: string) => void;
}

function CourseTimelineItem({ item, lang, spots, eats, stays, isLast, onNavSpot }: ItemProps) {
  const pad = { paddingBottom: isLast ? 0 : 16 };

  if (item.kind === "spot") {
    const s = spots[item.refId];
    if (!s) return null;
    return (
      <div style={{ display: "flex", gap: 16, ...pad }}>
        <div style={{ width: 30, textAlign: "center", paddingTop: 16, fontSize: 11, color: "var(--ink-3)", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--surface)", border: "2.5px solid var(--brand)", margin: "8px auto 0" }} />
        </div>
        <button onClick={() => onNavSpot(s.id)} className="card" style={{ flex: 1, padding: 12, textAlign: "left", display: "flex", gap: 12 }}>
          <Placeholder label={localized(s.name, lang)} id={s.id} h={68} style={{ width: 80, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{localized(s.name, lang)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                {localized(s.type, lang)}
                {item.durationMin ? ` · ${item.durationMin} ${lang === "ko" ? "분" : "min"}` : ""}
              </div>
            </div>
            <Signal level={s.congestion} lang={lang} />
          </div>
        </button>
      </div>
    );
  }

  if (item.kind === "eat") {
    const e = eats[item.refId];
    if (!e) return null;
    return (
      <div style={{ display: "flex", gap: 16, ...pad }}>
        <div style={{ width: 30, textAlign: "center", paddingTop: 12, fontSize: 11, color: "var(--ink-3)", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", margin: "6px auto 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.utensils />
          </div>
        </div>
        <div style={{ flex: 1, padding: "12px 14px", background: "var(--bg-elev)", borderRadius: "var(--r-md)", border: "1px dashed var(--line-2)" }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "ko" ? "식사" : "Meal"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{localized(e.name, lang)}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {localized(e.type, lang)} · {e.price} · ★ {e.rating}
          </div>
        </div>
      </div>
    );
  }

  const st = stays[item.refId];
  if (!st) return null;
  return (
    <div style={{ display: "flex", gap: 16, ...pad }}>
      <div style={{ width: 30, textAlign: "center", paddingTop: 12, fontSize: 11, color: "var(--ink-3)", position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", margin: "6px auto 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon.bed />
        </div>
      </div>
      <div style={{ flex: 1, padding: "12px 14px", background: "var(--bg-elev)", borderRadius: "var(--r-md)", border: "1px dashed var(--line-2)" }}>
        <div style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {lang === "ko" ? "숙박" : "Stay"}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{localized(st.name, lang)}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {localized(st.type, lang)} · {localized(st.price, lang)}
        </div>
      </div>
    </div>
  );
}
