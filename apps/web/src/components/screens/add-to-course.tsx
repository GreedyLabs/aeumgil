"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appendPersonalCourseAction } from "@/app/actions/personal-course";
import { useAppState } from "@/components/app-shell";
import { Select } from "@/components/select";
import { appendPersonalPlaces, type CourseAddition } from "@/domain/append-personal-course";
import type { PersonalCourse } from "@/domain/personal-course";
import { UI, Icon } from "./_ui";

export type AdditionPlace = CourseAddition & {
  name: string;
  region: string;
  note: string;
  imageUrl?: string;
  detailUrl?: string;
};

export function AddToCourseView({
  courses,
  places,
  newCourseHref,
}: {
  courses: PersonalCourse[];
  places: AdditionPlace[];
  newCourseHref: string;
}) {
  const router = useRouter();
  const { showToast } = useAppState();
  const [ready, setReady] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [day, setDay] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => setReady(true), []);
  const selected = courses.find((course) => course.id === courseId);
  const next = appendPersonalPlaces(selected?.items ?? [], places, day);
  const tooMany = next.items.length > 30;
  const add = () => {
    if (!selected) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await appendPersonalCourseAction({
          courseId: selected.id,
          version: selected.version,
          day,
          places: places.map(({ kind, refId }) => ({ kind, refId })),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        showToast(`${result.added}곳을 Day ${day}에 담았어요.`);
        router.push(`/my-courses/${result.course.id}`);
      } catch {
        setError("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };
  return (
    <div className="screen-enter add-to-course-page">
      <UI.TopBar title="내 여행에 담기" />
      <header className="page-heading">
        <div>
          <span className="eyebrow">찾아둔 장소를 하나의 여행으로</span>
          <h1>어느 코스에 담을까요?</h1>
          <p>선택한 날짜의 마지막에 추가해요. 다음 화면에서 방문 순서를 바꿀 수 있어요.</p>
        </div>
      </header>
      <div className="detail-layout">
        <section className="card summary-panel" aria-label="추가할 장소">
          <h2>함께 담을 {places.length}곳</h2>
          <div className="add-course-preview-list">
            {places.map((place) => (
              <article key={`${place.kind}:${place.refId}`} className="add-course-preview">
                <UI.Placeholder
                  src={place.imageUrl}
                  label={place.name}
                  h={72}
                  style={{ width: 84, flexShrink: 0, borderRadius: 12 }}
                />
                <div>
                  <strong>{place.name}</strong>
                  <p>
                    {place.region} · {place.note}
                  </p>
                  {place.detailUrl && (
                    <Link href={place.detailUrl} target="_blank" className="text-link">
                      상세 확인 ↗
                    </Link>
                  )}
                  {selected?.items.some(
                    (item) =>
                      item.kind === place.kind && item.refId === place.refId && item.day === day,
                  ) && <span className="accessibility-badge">Day {day}에 이미 포함</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="card summary-panel" aria-label="추가할 내 코스 선택">
          <h2>내 여행 선택</h2>
          <fieldset className="add-course-controls" disabled={!ready || pending}>
            <label>
              코스
              <Select
                aria-label="추가할 내 코스"
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setError("");
                }}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} · {course.items.length}곳
                  </option>
                ))}
              </Select>
            </label>
            <label>
              추가할 날짜
              <Select
                aria-label="추가할 날짜"
                value={day}
                onChange={(event) => {
                  setDay(Number(event.target.value));
                  setError("");
                }}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    Day {value} · {selected?.items.filter((item) => item.day === value).length ?? 0}
                    곳
                  </option>
                ))}
              </Select>
            </label>
            <p role="status">
              {next.added
                ? `${next.added}곳 추가 · 코스 전체 ${next.items.length}/30곳`
                : "선택한 날짜에 이미 모두 담겨 있어요."}
              {next.skipped > 0 && next.added > 0 ? ` (${next.skipped}곳은 이미 포함)` : ""}
            </p>
            {tooMany && (
              <p role="alert">30곳을 넘어요. 다른 코스를 선택하거나 새 코스를 만들어 주세요.</p>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!selected || !next.added || tooMany}
              onClick={add}
            >
              <Icon.plus /> {pending ? "담는 중…" : `이 코스에 ${next.added}곳 담기`}
            </button>
          </fieldset>
          <Link className="btn btn-secondary btn-block" href={newCourseHref}>
            새 코스로 만들기
          </Link>
        </section>
      </div>
    </div>
  );
}
