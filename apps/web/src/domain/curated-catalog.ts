import { z } from "zod";

const source = z.object({ title: z.string().min(1), url: z.string().url().startsWith("https://") });
export const curatedCourseDefinitions = z
  .array(
    z.object({
      id: z.string().regex(/^journey-[a-z0-9-]+$/),
      title: z.string().min(5).max(80),
      subtitle: z.string().min(5).max(120),
      tag: z.string().min(1),
      mood: z.array(z.string().min(1)).min(1),
      hue: z.number().int().min(0).max(359),
      blurb: z.string().min(10),
      planningNote: z.string().min(10),
      sources: z.array(source).min(1),
      days: z
        .array(
          z.object({
            title: z.string().min(1),
            note: z.string().min(1),
            startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
            endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
            lunch: z.boolean().default(true),
            stops: z
              .array(
                z.object({
                  id: z.string().min(1),
                  name: z.string().min(1),
                  region: z.string().min(1),
                  durationMin: z.number().int().min(30).max(480),
                }),
              )
              .min(1)
              .max(4),
          }),
        )
        .min(1)
        .max(5),
    }),
  )
  .min(1);

export type CuratedCourseDefinition = z.infer<typeof curatedCourseDefinitions>[number];
export interface CatalogLocation {
  id: string;
  name: string;
  region: string;
  lat: number | null;
  lon: number | null;
}
export interface CatalogCommerce extends CatalogLocation {
  kind: "eat" | "stay";
  type?: string;
}
type Coordinate = CatalogLocation & { lat: number; lon: number };
export type MeasureTravel = (
  a: Coordinate,
  b: Coordinate,
) => { straightKm: number; minutes: number };
export interface CuratedTemplateItem {
  day: number;
  seq: number;
  kind: "spot" | "eat" | "stay";
  refId: string;
  time: string;
  durationMin: number;
}

function point<T extends CatalogLocation>(
  place: T | undefined,
): place is T & { lat: number; lon: number } {
  return Boolean(
    place &&
    typeof place.lat === "number" &&
    typeof place.lon === "number" &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon) &&
    place.lat >= 36.9 &&
    place.lat <= 38.7 &&
    place.lon >= 127 &&
    place.lon <= 129.6,
  );
}
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minute = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h! * 60 + m!;
};

/** 실 DB 장소만 연결한다. 거리 계산은 기존 이동시간 모델을 주입해 수식을 중복 구현하지 않는다. */
export function buildCuratedCatalog(
  raw: unknown,
  spots: CatalogLocation[],
  commerce: CatalogCommerce[],
  measure: MeasureTravel,
) {
  const definitions = curatedCourseDefinitions.parse(raw);
  const ids = new Set<string>();
  const signatures = new Set<string>();
  const byId = new Map(spots.map((place) => [place.id, place]));
  const shops = commerce
    .filter(point)
    .map(({ id, kind, name, region, lat, lon, type }) => ({
      id,
      kind,
      name,
      region,
      lat,
      lon,
      type,
    }));
  const restaurants = shops.filter(
    (candidate) =>
      candidate.kind === "eat" &&
      !/카페|커피|다방|베이커리|디저트|제과|cafe|coffee/i.test(
        `${candidate.name} ${candidate.type ?? ""}`,
      ),
  );
  const lodgings = shops.filter(
    (candidate) =>
      candidate.kind === "stay" &&
      !/캠핑|캠프|야영|글램핑|카라반|오토캠|camp/i.test(
        `${candidate.name} ${candidate.type ?? ""}`,
      ),
  );
  return definitions.map((definition) => {
    if (ids.has(definition.id)) throw Error(`중복 코스 ID: ${definition.id}`);
    ids.add(definition.id);
    const used = new Set<string>();
    const items: CuratedTemplateItem[] = [];
    const warnings: string[] = [];
    let previousDayLast: Coordinate | undefined;
    let previousStay: Coordinate | undefined;
    const days = definition.days.map((recipe, index) => {
      const day = index + 1;
      const places = recipe.stops.map((stop) => {
        const actual = byId.get(stop.id);
        if (!point(actual))
          throw Error(
            `${definition.id} Day ${day}: 실제 좌표가 있는 관광지를 찾을 수 없음 (${stop.id})`,
          );
        if (actual.name !== stop.name || actual.region !== stop.region)
          throw Error(
            `${definition.id}: 장소 이름/지역 변경 확인 필요 (${stop.id}: ${actual.name}/${actual.region})`,
          );
        if (used.has(stop.id))
          throw Error(`${definition.id}: 날짜를 바꿔 같은 관광지를 중복한 코스 (${stop.id})`);
        used.add(stop.id);
        return {
          id: actual.id,
          name: actual.name,
          region: actual.region,
          lat: actual.lat,
          lon: actual.lon,
          durationMin: stop.durationMin,
        };
      });
      const first = places[0]!;
      const overnightTransfer = previousDayLast ? measure(previousDayLast, first) : undefined;
      if (
        overnightTransfer &&
        (overnightTransfer.straightKm > 120 || overnightTransfer.minutes > 180)
      )
        throw Error(`${definition.id} Day ${day}: 날짜 사이 이동이 너무 큼`);
      let cursor = minute(recipe.startTime);
      const closing = minute(recipe.endTime);
      if (closing <= cursor)
        throw Error(`${definition.id} Day ${day}: 방문 시작·종료 시각을 확인하세요.`);
      let totalTravelKm = 0;
      let totalTravelMinutes = 0;
      let last: Coordinate | undefined;
      let meal: Coordinate | undefined;
      const legs: Array<{ from: string; to: string; straightKm: number; minutes: number }> = [];
      const add = (place: Coordinate, kind: CuratedTemplateItem["kind"], durationMin: number) => {
        if (last) {
          const leg = measure(last, place);
          if (leg.straightKm > 65 || leg.minutes > 100)
            throw Error(
              `${definition.id} Day ${day}: 과도한 하루 이동 (${last.name} → ${place.name})`,
            );
          totalTravelKm += leg.straightKm;
          totalTravelMinutes += leg.minutes;
          cursor += leg.minutes;
          legs.push({ from: last.name, to: place.name, ...leg });
        }
        if (kind === "stay") cursor = Math.max(cursor, 17 * 60 + 30);
        if (kind !== "stay" && cursor + durationMin > closing)
          throw Error(
            `${definition.id} Day ${day}: 체류와 이동을 합치면 계획한 종료 ${recipe.endTime} 초과 (${place.name})`,
          );
        items.push({
          day,
          seq: items.length,
          kind,
          refId: place.id,
          time: time(cursor),
          durationMin,
        });
        if (kind !== "stay") cursor += durationMin;
        last = place;
      };
      const lunchAfter = places.length >= 3 ? 2 : 1;
      for (let i = 0; i < places.length; i++) {
        const place = places[i]!;
        add(place, "spot", place.durationMin);
        if (!recipe.lunch || i + 1 !== lunchAfter) continue;
        const next = places[i + 1];
        meal = restaurants
          .filter(
            (candidate) =>
              candidate.region === place.region &&
              measure(place, candidate).straightKm <= 8 &&
              (!next || measure(candidate, next).straightKm <= 25),
          )
          .sort(
            (a, b) =>
              measure(place, a).minutes +
                (next ? measure(a, next).minutes : 0) -
                (measure(place, b).minutes + (next ? measure(b, next).minutes : 0)) ||
              a.id.localeCompare(b.id),
          )[0];
        if (meal) {
          cursor = Math.max(cursor, 11 * 60 + 30);
          add(meal, "eat", 60);
        } else warnings.push(`Day ${day}: 8km 내 식당 정보 없음. 사용자가 선택 필요`);
      }
      const finalSpot = places.at(-1)!;
      let stay: Coordinate | undefined;
      if (day < definition.days.length) {
        // 같은 권역에서 가까운 숙소는 연박해 불필요한 짐 이동을 줄인다.
        stay =
          previousStay &&
          previousStay.region === finalSpot.region &&
          measure(finalSpot, previousStay).straightKm <= 15
            ? previousStay
            : lodgings
                .filter(
                  (candidate) =>
                    candidate.region === finalSpot.region &&
                    measure(finalSpot, candidate).straightKm <= 15,
                )
                .sort(
                  (a, b) =>
                    measure(finalSpot, a).minutes - measure(finalSpot, b).minutes ||
                    a.id.localeCompare(b.id),
                )[0];
        if (stay) add(stay, "stay", 480);
        else warnings.push(`Day ${day}: 15km 내 숙소 정보 없음. 사용자가 선택 필요`);
      }
      previousStay = stay;
      if (totalTravelKm > 130 || totalTravelMinutes > 240)
        throw Error(`${definition.id} Day ${day}: 하루 이동 총량 초과`);
      previousDayLast = last ?? finalSpot;
      return {
        day,
        title: recipe.title,
        note: recipe.note,
        startTime: recipe.startTime,
        endTime: recipe.endTime,
        places,
        meal,
        stay,
        legs,
        totalTravelKm,
        totalTravelMinutes,
        overnightTransfer,
        lastArrival: time(cursor),
      };
    });
    const signature = [...used].sort().join(",");
    if (signatures.has(signature)) throw Error(`${definition.id}: 장소 조합이 같은 중복 코스`);
    signatures.add(signature);
    if (items.length > 30) throw Error(`${definition.id}: 개인 코스 복사 한도 30곳 초과`);
    return { definition, items, days, spotIds: [...used], warnings };
  });
}
