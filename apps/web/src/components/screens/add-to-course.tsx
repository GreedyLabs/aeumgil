"use client";
import { useUiText } from "@/components/use-ui-text";
import Link from "next/link";
import { NewTabLink } from "@/components/external-link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appendPersonalCourseAction } from "@/app/actions/personal-course";
import { useAppState } from "@/components/app-shell";
import { Select } from "@/components/select";
import { CourseDayInput } from "@/components/course-day-input";
import { courseDateProblem, courseDayLabel } from "@/domain/course-dates";
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
  const translateUi = useUiText();
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
  const dateProblem = selected ? courseDateProblem(selected, next.items) : undefined;
  const add = () => {
    if (!selected || dateProblem) return;
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
        showToast(`${result.added}곳을 ${courseDayLabel(day, selected.startDate)}에 담았어요.`);
        router.push(`/my-courses/${result.course.id}`);
      } catch {
        setError("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };
  return (
    <div className="screen-enter add-to-course-page">
      <UI.TopBar title={translateUi("내 여행에 담기")} />
      <header className="page-heading">
        <div>
          <span className="eyebrow">{translateUi("찾아둔 장소를 하나의 여행으로")}</span>
          <h1>{translateUi("어느 코스에 담을까요?")}</h1>
          <p>
            {translateUi(
              "선택한 날짜의 마지막에 추가해요. 다음 화면에서 방문 순서를 바꿀 수 있어요.",
            )}
          </p>
        </div>
      </header>
      <div className="detail-layout">
        <section className="card summary-panel" aria-label={translateUi("추가할 장소")}>
          <h2>
            {translateUi("함께 담을 ")}
            {translateUi(places.length)}
            {translateUi("곳")}
          </h2>
          <div className="add-course-preview-list">
            {places.map((place) => (
              <article key={`${place.kind}:${place.refId}`} className="add-course-preview">
                <UI.Placeholder
                  src={place.imageUrl}
                  label={translateUi(place.name)}
                  h={72}
                  style={{ width: 84, flexShrink: 0, borderRadius: 12 }}
                />
                <div>
                  <strong>{translateUi(place.name)}</strong>
                  <p>
                    {translateUi(place.region)} · {translateUi(place.note)}
                  </p>
                  {place.detailUrl && (
                    <NewTabLink href={place.detailUrl} className="text-link">
                      {translateUi("상세 확인")}
                    </NewTabLink>
                  )}
                  {selected?.items.some(
                    (item) =>
                      item.kind === place.kind && item.refId === place.refId && item.day === day,
                  ) && (
                    <span className="accessibility-badge">
                      {translateUi(courseDayLabel(day, selected?.startDate))}
                      {translateUi("에 이미 포함")}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="card summary-panel" aria-label={translateUi("추가할 내 코스 선택")}>
          <h2>{translateUi("내 여행 선택")}</h2>
          <fieldset className="add-course-controls" disabled={!ready || pending}>
            <label>
              {translateUi("코스")}
              <Select
                aria-label={translateUi("추가할 내 코스")}
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setDay(1);
                  setError("");
                }}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} · {translateUi(course.items.length)}
                    {translateUi("곳")}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              {translateUi("추가할 날짜")}
              <CourseDayInput
                label={translateUi("추가할 날짜")}
                value={day}
                onChange={(value) => {
                  setDay(value);
                  setError("");
                }}
                startDate={selected?.startDate}
                endDate={selected?.endDate}
                navigation
                disabled={!ready || pending}
              />
            </label>
            <p className="personal-day-label">
              {translateUi(courseDayLabel(day, selected?.startDate))} ·{translateUi(" ")}
              {translateUi(
                selected?.startDate && selected.endDate
                  ? `${selected.startDate} ~ ${selected.endDate} 여행`
                  : "날짜 미정 여행",
              )}
            </p>
            {dateProblem && <p role="alert">{translateUi(dateProblem)}</p>}
            <p role="status">
              {translateUi(
                next.added
                  ? `${next.added}곳 추가 · 코스 전체 ${next.items.length}/30곳`
                  : "선택한 날짜에 이미 모두 담겨 있어요.",
              )}
              {translateUi(
                next.skipped > 0 && next.added > 0 ? ` (${next.skipped}곳은 이미 포함)` : "",
              )}
            </p>
            {tooMany && (
              <p role="alert">
                {translateUi("30곳을 넘어요. 다른 코스를 선택하거나 새 코스를 만들어 주세요.")}
              </p>
            )}
            {error && <p role="alert">{translateUi(error)}</p>}
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!selected || !next.added || tooMany || Boolean(dateProblem)}
              onClick={add}
            >
              <Icon.plus /> {translateUi(pending ? "담는 중…" : `이 코스에 ${next.added}곳 담기`)}
            </button>
          </fieldset>
          <Link className="btn btn-secondary btn-block" href={newCourseHref}>
            {translateUi("새 코스로 만들기")}
          </Link>
        </section>
      </div>
    </div>
  );
}
