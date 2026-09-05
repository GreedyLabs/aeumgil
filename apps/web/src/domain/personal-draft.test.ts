import { describe, expect, it } from "vitest";
import { L } from "@/lib/i18n";
import {
  clearRecoveredSource,
  prepareRecoveredDraft,
  preserveOlderDraft,
  readCourseDraft,
  type CourseDraftSnapshot,
} from "./personal-draft";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
const courseId = "a7279fe5-8a04-4c2c-9a19-9d53cf5870cc";
const recoveryId = "b8279fe5-8a04-4c2c-9a19-9d53cf5870cc";
const snapshot: CourseDraftSnapshot = {
  draft: {
    id: courseId,
    version: 2,
    title: "이전 탭 여행",
    note: "놓치면 안 되는 메모",
    transport: "transit",
    startTime: "10:45",
    dayStartTimes: { "1": "13:00", "2": "09:00" },
    startDate: "2028-02-28",
    endDate: "2028-03-06",
    items: [{ kind: "eat", refId: "eat-one", day: 1, durationMin: 60, notBeforeTime: "13:30" }],
  },
  places: {
    "eat-one": { id: "eat-one", name: L("강릉 식당"), region: L("강릉"), lat: 37.7, lon: 128.9 },
  },
};
const key = `eumgil.draft:user:${courseId}`;

describe("개인 코스 충돌 초안 보존", () => {
  it("날짜 입력 중인 미완성 초안과 기간 밖 장소도 버리지 않고 복원한다", () => {
    for (const endDate of [undefined, "2028-02-28"]) {
      const draft = {
        ...snapshot.draft,
        endDate,
        items: [{ ...snapshot.draft.items[0]!, day: 8 }],
      };
      const restored = readCourseDraft(JSON.stringify({ ...snapshot, draft }), "user");
      expect(restored?.draft).toMatchObject({ startDate: "2028-02-28", items: draft.items });
      expect(restored?.draft.endDate).toBe(endDate);
    }
  });
  it("이전 버전을 별도 키에 보존해 최신 편집·저장이 덮어쓰지 않게 한다", () => {
    const store = storage();
    const raw = JSON.stringify(snapshot);
    store.setItem(key, raw);
    preserveOlderDraft(store, key, raw);
    expect(store.getItem(key)).toBeNull();
    store.setItem(
      key,
      JSON.stringify({ ...snapshot, draft: { ...snapshot.draft, version: 3, title: "최신 편집" } }),
    );
    store.removeItem(key);
    expect(readCourseDraft(store.getItem(`${key}:older`), "user")?.draft.title).toBe(
      "이전 탭 여행",
    );
  });
  it("백업 기록이 실패하면 정상 키의 원본을 삭제하지 않는다", () => {
    const store = storage();
    const raw = JSON.stringify(snapshot);
    store.setItem(key, raw);
    const fail = {
      ...store,
      setItem() {
        throw new Error("quota");
      },
    };
    expect(() => preserveOlderDraft(fail, key, raw)).toThrow("quota");
    expect(store.getItem(key)).toBe(raw);
  });
  it("복구본을 new 경로와 일치하는 키에 먼저 저장하고 이동 후에도 출처를 유지한다", () => {
    const store = storage();
    store.setItem(`${key}:older`, JSON.stringify(snapshot));
    const href = prepareRecoveredDraft(store, "user", `${key}:older`, snapshot, recoveryId);
    expect(href).toBe(`/my-courses/new?recovery=${recoveryId}`);
    const copyKey = `eumgil.draft:user:newrecovery=${recoveryId}`;
    const recovered = readCourseDraft(store.getItem(copyKey), "user")!;
    expect(recovered.draft).toMatchObject({
      title: "이전 탭 여행 · 복구",
      transport: "transit",
      startTime: "10:45",
      dayStartTimes: { "1": "13:00", "2": "09:00" },
      startDate: "2028-02-28",
      endDate: "2028-03-06",
      note: snapshot.draft.note,
      items: snapshot.draft.items,
    });
    expect(recovered.draft.id).toBeUndefined();
    expect(recovered.draft.version).toBeUndefined();
    expect(recovered.recoverySourceKey).toBe(`${key}:older`);
    store.setItem(
      copyKey,
      JSON.stringify({ ...recovered, draft: { ...recovered.draft, note: "복귀 후 수정" } }),
    );
    expect(readCourseDraft(store.getItem(copyKey), "user")?.recoverySourceKey).toBe(`${key}:older`);
    expect(store.getItem(`${key}:older`)).not.toBeNull();
    clearRecoveredSource(
      store,
      "user",
      recovered.recoverySourceKey,
      recovered.recoverySourceVersion,
    );
    expect(store.getItem(`${key}:older`)).toBeNull();
  });
  it("복구 원본보다 새 백업과 다른 사용자의 키는 지우지 않는다", () => {
    const store = storage();
    store.setItem(
      `${key}:older`,
      JSON.stringify({ ...snapshot, draft: { ...snapshot.draft, version: 3 } }),
    );
    clearRecoveredSource(store, "user", `${key}:older`, 2);
    expect(store.getItem(`${key}:older`)).not.toBeNull();
    clearRecoveredSource(store, "other-user", `${key}:older`, 3);
    expect(store.getItem(`${key}:older`)).not.toBeNull();
    expect(
      readCourseDraft(
        JSON.stringify({ ...snapshot, recoverySourceKey: `${key}:older` }),
        "other-user",
      )?.recoverySourceKey,
    ).toBeUndefined();
  });
});
