import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listPersonalCourses: vi.fn(),
  getFestival: vi.fn(),
  getSpot: vi.fn(),
  getEat: vi.fn(),
}));
vi.mock("@/data", () => ({ getRepository: () => mocks }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/components/screens/add-to-course", () => ({ AddToCourseView: () => null }));
import AddToCoursePage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("React", React);
  mocks.getCurrentUser.mockResolvedValue({ id: "owner" });
  mocks.listPersonalCourses.mockResolvedValue([]);
  mocks.getSpot.mockResolvedValue({
    id: "spot-one",
    name: { ko: "명소" },
    region: { ko: "동해" },
    type: { ko: "해변" },
  });
  mocks.getEat.mockResolvedValue({
    id: "eat-one",
    name: { ko: "식당" },
    region: { ko: "동해" },
    type: { ko: "음식점" },
  });
  mocks.getFestival.mockResolvedValue({
    place: { id: "festival-734219", region: { ko: "동해" } },
    event: { id: "734219", name: { ko: "무릉제" }, startsOn: "2026-09-17", endsOn: "2026-09-20" },
  });
});

it("미로그인 때 행사와 주변 장소 쿼리를 로그인 복귀 경로에 보존한다", async () => {
  mocks.getCurrentUser.mockResolvedValue(null);
  const searchParams = Promise.resolve({ festival: "734219", spot: "spot-one", eat: "eat-one" });
  await expect(AddToCoursePage({ searchParams })).rejects.toThrow(
    `redirect:/login?reason=save&returnTo=${encodeURIComponent("/my-courses/add?festival=734219&spot=spot-one&eat=eat-one")}`,
  );
  expect(mocks.getFestival).not.toHaveBeenCalled();
  expect(mocks.listPersonalCourses).not.toHaveBeenCalled();
});

it("개인 코스가 없으면 검증된 행사와 식당을 묶어서 새 코스로 이어간다", async () => {
  await expect(
    AddToCoursePage({ searchParams: Promise.resolve({ festival: "734219", eat: "eat-one" }) }),
  ).rejects.toThrow("redirect:/my-courses/new?festival=734219&eat=eat-one");
  expect(mocks.getFestival).toHaveBeenCalledWith("734219");
  expect(mocks.getEat).toHaveBeenCalledWith("eat-one");
});

it("요청한 장소가 사라졌다면 빠진 채로 새 코스를 만들지 않는다", async () => {
  mocks.getSpot.mockResolvedValue(null);
  await expect(
    AddToCoursePage({ searchParams: Promise.resolve({ festival: "734219", spot: "missing" }) }),
  ).rejects.toThrow("not-found");
  expect(mocks.listPersonalCourses).not.toHaveBeenCalled();
});
