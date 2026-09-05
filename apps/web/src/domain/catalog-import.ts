import regions from "./gangwon-regions.json" with { type: "json" };
import taxonomy from "./tourism-taxonomy.json" with { type: "json" };

export type TourismRow = Record<string, string>;
export function normalizeTourismRow(row: TourismRow) {
  const region = regions.find((r) => r.code === row.lDongSignguCd);
  const lat = Number(row.mapy),
    lon = Number(row.mapx);
  const title = row.title?.replace(/<[^>]*>/g, "").trim();
  if (
    !region ||
    row.lDongRegnCd !== "51" ||
    !title ||
    !/^\d+$/.test(row.contentid ?? "") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 36.9 ||
    lat > 38.7 ||
    lon < 127 ||
    lon > 129.6
  )
    return null;
  if (!["12", "14", "28", "32", "38", "39"].includes(row.contenttypeid ?? "")) return null;
  const code = row.lclsSystm3 ?? "";
  const kind =
    row.contenttypeid === "39"
      ? "eat"
      : row.contenttypeid === "32" || code.startsWith("AC")
        ? "stay"
        : "spot";
  // 일반 소매점은 여행지 추천 후보에서 제외한다. 전통시장·특산물점은 유지한다.
  if (
    kind === "spot" &&
    row.contenttypeid === "38" &&
    !/^SH0[56]/.test(code) &&
    !/시장|특산|공예/.test(title)
  )
    return null;
  const type =
    (taxonomy as Record<string, string>)[code] ??
    (
      {
        "12": "관광지",
        "14": "문화시설",
        "28": "레포츠",
        "32": "숙소",
        "38": "시장·쇼핑",
        "39": "음식점",
      } as Record<string, string>
    )[row.contenttypeid!]!;
  const category = /^NA020[789]/.test(code)
    ? "sea"
    : /^(NA0102|NA040[567]|VE030)/.test(code)
      ? "forest"
      : code.startsWith("NA")
        ? "nature"
        : /^VE(06|07|09)/.test(code)
          ? "culture"
          : code.startsWith("HS")
            ? "heritage"
            : /^EX05/.test(code)
              ? "wellness"
              : /^LS/.test(code)
                ? "activity"
                : /^SH/.test(code)
                  ? "market"
                  : /^(EX|VE02)/.test(code)
                    ? "family"
                    : "other";
  const image = row.firstimage || row.firstimage2;
  const imageUrl =
    image && /^https?:\/\/(tong|cdn)\.visitkorea\.or\.kr\//.test(image)
      ? image.replace(/^http:/, "https:")
      : null;
  const duration =
    category === "wellness" || category === "activity"
      ? 120
      : category === "culture" || category === "forest"
        ? 90
        : 60;
  return {
    contentId: row.contentid!,
    title,
    region,
    type,
    kind,
    category,
    lat,
    lon,
    imageUrl,
    duration,
    address: [row.addr1, row.addr2].filter(Boolean).join(" "),
    tel: row.tel || null,
    code,
    environment:
      category === "sea" ? "beach" : /^NA01|^NA040[1236]/.test(code) ? "mountain" : "inland",
    // 산 정상·장거리 걷기·통제구역·숙박·골프는 짧은 당일 코스의 자동 경유지로 넣지 않는다.
    routeEligible:
      kind === "spot" &&
      !/^(NA010100|NA040[123]00|HS04|LS010400|VE040300)/.test(code) &&
      !/^(VE06|VE09|VE10|VE11|HS020|HS010200)/.test(code) &&
      !/두타연|통일전망대|DMZ|민통선|운탄고도|해파랑길|대청봉|금대봉|종주|골프|낚시터|[0-9]+코스|둘레길|백두대간협곡열차/.test(
        title,
      ),
  };
}
export type CatalogPlace = NonNullable<ReturnType<typeof normalizeTourismRow>> & { id: string };
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
/** 지역·성격이 맞는 가까운 세 곳을 연결한다. 체류 시간은 편집 기준이며 운영 시간은 상세에서 확인한다. */
export function buildRegionalCourses(places: CatalogPlace[]) {
  const topics = [
    { id: "sea", label: "바다와 항구", categories: ["sea"] },
    { id: "forest", label: "숲과 정원 산책", categories: ["forest"] },
    { id: "nature", label: "물길과 지질 풍경", categories: ["nature"] },
    { id: "culture", label: "전시와 예술", categories: ["culture"] },
    { id: "heritage", label: "역사와 사찰", categories: ["heritage"] },
    { id: "family", label: "함께 즐기는 체험", categories: ["family"] },
    { id: "local", label: "시장과 골목 나들이", categories: ["market", "culture", "other"] },
    {
      id: "highlights",
      label: "대표 명소 하루 여행",
      categories: ["sea", "forest", "nature", "culture", "heritage", "family", "other"],
    },
  ];
  const result: {
    id: string;
    title: string;
    region: string;
    signature: string;
    stops: CatalogPlace[];
  }[] = [];
  for (const region of regions)
    for (const topic of topics) {
      const anchor = new RegExp(region.anchors);
      const pool = places
        .filter(
          (p) =>
            p.region.key === region.key && p.routeEligible && topic.categories.includes(p.category),
        )
        .sort(
          (a, b) =>
            Number(anchor.test(b.title)) - Number(anchor.test(a.title)) ||
            Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
            a.contentId.localeCompare(b.contentId),
        );
      if (topic.id === "highlights")
        pool.splice(0, pool.length, ...pool.filter((p) => anchor.test(p.title)));
      const first = topic.id === "local" ? pool.find((p) => p.category === "market") : pool[0];
      if (!first) continue;
      const stops = [first];
      for (let n = 0; n < 2; n++) {
        const last = stops.at(-1)!;
        const next = pool
          .filter(
            (p) =>
              !stops.includes(p) &&
              stops.every((s) => distanceKm(s, p) <= 20 && distanceKm(s, p) >= 0.4),
          )
          .sort(
            (a, b) =>
              distanceKm(last, a) -
              Number(anchor.test(a.title)) * 2 -
              (distanceKm(last, b) - Number(anchor.test(b.title)) * 2),
          )[0];
        if (next) stops.push(next);
      }
      if (stops.length !== 3) continue;
      // 같은 장소 조합을 이름만 바꿔 테마 수를 늘리지 않는다.
      const signature = stops
        .map((s) => s.id)
        .sort()
        .join(",");
      if (result.some((r) => r.signature === signature)) continue;
      result.push({
        id: `gangwon-${region.key}-${topic.id}`,
        title: `${region.ko} · ${topic.label}`,
        region: region.ko,
        signature,
        stops,
      });
    }
  return result;
}
