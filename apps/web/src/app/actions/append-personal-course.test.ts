import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPersonalCourse: vi.fn(),
  savePersonalCourse: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/data", () => ({ getRepository: () => mocks }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { appendPersonalCourseAction } from "./personal-course";

const id = "123e4567-e89b-12d3-a456-426614174000";
const spot = { kind: "spot" as const, refId: "spot-one" };
const input = { courseId: id, version: 2, day: 2, places: [spot] };
const course = {
  id,
  title: "가족과 강릉",
  note: "예약 확인",
  items: [{ kind: "festival" as const, refId: "festival-734219", day: 1, durationMin: 120 }],
  version: 2,
  updatedAt: "2026-09-05T00:00:00Z",
  transport: "transit",
  startTime: "08:00",
  dayStartTimes: { "1": "13:00", "2": "09:00" },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "owner-one" });
  mocks.getPersonalCourse.mockResolvedValue(course);
  mocks.savePersonalCourse.mockImplementation(async (value) => ({ ...value, version: 3 }));
});

describe("장소 담기 서버 액션", () => {
  it("로그인 세션이 없으면 코스 조회·저장을 하지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await appendPersonalCourseAction(input)).toMatchObject({ ok: false });
    expect(mocks.getPersonalCourse).not.toHaveBeenCalled();
    expect(mocks.savePersonalCourse).not.toHaveBeenCalled();
  });

  it("소유권 조회에서 없는 코스나 타인 코스이면 저장하지 않는다", async () => {
    mocks.getPersonalCourse.mockResolvedValue(null);
    expect(await appendPersonalCourseAction(input)).toMatchObject({ ok: false });
    expect(mocks.getPersonalCourse).toHaveBeenCalledWith(id);
    expect(mocks.savePersonalCourse).not.toHaveBeenCalled();
  });

  it("화면을 연 뒤 다른 탭에서 바뀐 코스를 덮어쓰지 않는다", async () => {
    mocks.getPersonalCourse.mockResolvedValue({ ...course, version: 3 });
    expect(await appendPersonalCourseAction(input)).toMatchObject({
      ok: false,
      error: expect.stringContaining("변경"),
    });
    expect(mocks.savePersonalCourse).not.toHaveBeenCalled();
  });

  it("기존 조건·시각·순서·버전을 보존해 Repository의 저장 검증을 호출한다", async () => {
    expect(await appendPersonalCourseAction(input)).toMatchObject({
      ok: true,
      added: 1,
      skipped: 0,
    });
    expect(mocks.savePersonalCourse).toHaveBeenCalledWith({
      ...course,
      items: [...course.items, { ...spot, day: 2, durationMin: 60 }],
    });
    expect(mocks.revalidate).toHaveBeenCalledWith(`/my-courses/${id}`);
    expect(mocks.revalidate).toHaveBeenCalledWith("/saved");
  });

  it("실제 여행 날짜를 유지하며 8일차에 담고 기간 밖 날짜는 저장하지 않는다", async () => {
    const dated = { ...course, startDate: "2028-02-28", endDate: "2028-03-06" };
    mocks.getPersonalCourse.mockResolvedValue(dated);
    expect(await appendPersonalCourseAction({ ...input, day: 8 })).toMatchObject({ ok: true });
    expect(mocks.savePersonalCourse).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: dated.startDate, endDate: dated.endDate }),
    );
    mocks.savePersonalCourse.mockClear();
    expect(await appendPersonalCourseAction({ ...input, day: 9 })).toMatchObject({
      ok: false,
      error: expect.stringContaining("Day 9"),
    });
    expect(mocks.savePersonalCourse).not.toHaveBeenCalled();
  });

  it("전부 중복이거나 30곳을 초과하면 저장하지 않는다", async () => {
    mocks.getPersonalCourse.mockResolvedValue({
      ...course,
      items: [{ ...spot, day: 2, durationMin: 60 }],
    });
    expect(await appendPersonalCourseAction(input)).toMatchObject({ ok: false });
    mocks.getPersonalCourse.mockResolvedValue({
      ...course,
      items: Array.from({ length: 30 }, (_, i) => ({
        ...spot,
        refId: `old-${i}`,
        day: 1,
        durationMin: 60,
      })),
    });
    expect(await appendPersonalCourseAction(input)).toMatchObject({ ok: false });
    expect(mocks.savePersonalCourse).not.toHaveBeenCalled();
  });

  it("조회 이후 경합 또는 사라진 장소로 저장이 실패하면 성공을 표시하지 않는다", async () => {
    mocks.savePersonalCourse.mockRejectedValue(new Error("version changed"));
    expect(await appendPersonalCourseAction(input)).toMatchObject({ ok: false });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
