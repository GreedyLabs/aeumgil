import { personalCourseDraft, type PersonalCourseInput } from "./personal-course";
import type { Spot } from "./types";

type DraftPlace = Pick<
  Spot,
  "id" | "name" | "region" | "lat" | "lon" | "imageUrl" | "hasAccessibilityInfo"
>;
export interface CourseDraftSnapshot {
  draft: PersonalCourseInput;
  places: Record<string, DraftPlace>;
  recoverySourceKey?: string;
  recoverySourceVersion?: number;
}
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function ownedRecoveryKey(key: unknown, ownerId: string): key is string {
  return (
    typeof key === "string" && key.startsWith(`eumgil.draft:${ownerId}:`) && key.endsWith(":older")
  );
}

export function readCourseDraft(raw: string | null, ownerId: string): CourseDraftSnapshot | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as CourseDraftSnapshot;
    const parsed = personalCourseDraft.safeParse(saved?.draft);
    if (!parsed.success) return null;
    const places = Object.fromEntries(
      Object.entries(saved.places ?? {}).filter(
        ([id, place]) =>
          place &&
          place.id === id &&
          typeof place.name?.ko === "string" &&
          typeof place.name?.en === "string" &&
          typeof place.region?.ko === "string",
      ),
    );
    return {
      draft: parsed.data,
      places,
      ...(ownedRecoveryKey(saved.recoverySourceKey, ownerId)
        ? {
            recoverySourceKey: saved.recoverySourceKey,
            recoverySourceVersion: saved.recoverySourceVersion,
          }
        : {}),
    };
  } catch {
    return null;
  }
}

/** 백업 저장에 실패하면 현재 초안 원문을 그대로 남긴다. */
export function preserveOlderDraft(storage: DraftStorage, key: string, raw: string): void {
  storage.setItem(`${key}:older`, raw);
  storage.removeItem(key);
}

/** 새 경로의 키에 먼저 기록한다. 원본 백업은 새 코스의 DB 저장 성공 전까지 유지한다. */
export function prepareRecoveredDraft(
  storage: DraftStorage,
  ownerId: string,
  sourceKey: string,
  snapshot: CourseDraftSnapshot,
  recoveryId: string,
): string {
  if (!ownedRecoveryKey(sourceKey, ownerId) || !/^[0-9a-f-]{36}$/i.test(recoveryId))
    throw new Error("복구할 초안을 확인해 주세요.");
  const query = `recovery=${recoveryId}`;
  const key = `eumgil.draft:${ownerId}:new${query}`;
  storage.setItem(
    key,
    JSON.stringify({
      draft: {
        ...snapshot.draft,
        id: undefined,
        version: undefined,
        title: `${snapshot.draft.title} · 복구`.slice(0, 60),
      },
      places: snapshot.places,
      recoverySourceKey: sourceKey,
      recoverySourceVersion: snapshot.draft.version,
    } satisfies CourseDraftSnapshot),
  );
  return `/my-courses/new?${query}`;
}

/** 새 복구본이 저장된 뒤에만 같은 사용자의 같은 버전 백업을 지운다. */
export function clearRecoveredSource(
  storage: DraftStorage,
  ownerId: string,
  sourceKey: string | undefined,
  version: number | undefined,
): void {
  if (!ownedRecoveryKey(sourceKey, ownerId)) return;
  const source = readCourseDraft(storage.getItem(sourceKey), ownerId);
  if (source && source.draft.version === version) storage.removeItem(sourceKey);
}
