"use client";
import Link from "next/link";
import { localized } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Theme } from "@/domain/types";
import type { PersonalCourse } from "@/domain/personal-course";

export function SavedView({
  saved,
  personal,
}: {
  saved: { theme: Theme; savedAt: string }[];
  personal: PersonalCourse[];
}) {
  const { lang } = useAppState();
  return (
    <div className="screen-enter saved-page">
      <UI.TopBar title="내 여행" />
      <header className="page-heading">
        <div>
          <span className="eyebrow">가고 싶은 곳을 나의 여행으로</span>
          <h1>내 여행</h1>
          <p>직접 만든 코스와 나중에 떠나고 싶은 추천 테마를 모았어요.</p>
        </div>
        <Link className="btn btn-primary" href="/my-courses/new">
          <Icon.plus /> 새 코스 만들기
        </Link>
      </header>
      <section className="saved-section" aria-label="직접 만든 코스">
        <div className="section-heading">
          <h2>
            내가 만든 코스 <span>{personal.length}</span>
          </h2>
        </div>
        <div className="personal-course-cards">
          {personal.map((course) => (
            <Link
              key={course.id}
              href={`/my-courses/${course.id}`}
              className="card personal-course-card"
            >
              <span className="eyebrow">나만의 여행 · 비공개</span>
              <h3>{course.title}</h3>
              {course.note && <p>{course.note}</p>}
              <span className="data-caption">
                {new Set(course.items.map((item) => item.day)).size}일 일정 · {course.items.length}
                곳 · {course.updatedAt.slice(0, 10)} 수정
              </span>
              <span className="text-link">
                코스 편집 <Icon.chevR />
              </span>
            </Link>
          ))}
        </div>
        {!personal.length && (
          <div className="empty-state">
            <Icon.route />
            <h3>내가 원하는 순서로 떠나보세요</h3>
            <p>여행지를 직접 담거나 추천 코스를 복사해 내 취향대로 바꿀 수 있어요.</p>
            <Link className="btn btn-secondary" href="/my-courses/new">
              첫 코스 만들기
            </Link>
          </div>
        )}
      </section>
      <section className="saved-section" aria-label="저장한 추천 테마">
        <div className="section-heading">
          <h2>
            저장한 추천 테마 <span>{saved.length}</span>
          </h2>
          <Link className="text-link" href="/discover">
            더 찾아보기 <Icon.chevR />
          </Link>
        </div>
        <div className="personal-course-cards">
          {saved.map(({ theme, savedAt }) => (
            <Link href={`/theme/${theme.id}`} key={theme.id} className="card saved-theme-card">
              <UI.ThemeHueBg
                hue={theme.hue}
                h={170}
                src={theme.imageUrl}
                label={theme.imageLabel && localized(theme.imageLabel, lang)}
              >
                <h3>{localized(theme.title, lang)}</h3>
              </UI.ThemeHueBg>
              <div className="saved-theme-caption">
                <span>
                  {theme.spotCount}곳 · {localized(theme.duration, lang)}
                </span>
                <small>{savedAt} 저장</small>
              </div>
            </Link>
          ))}
        </div>
        {!saved.length && (
          <p className="section-description">
            마음에 드는 추천 코스의 저장 버튼을 눌러 모아보세요.
          </p>
        )}
      </section>
    </div>
  );
}
