import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpotMediaQuery } from "@/domain/tourism-media";
import {
  normalizeTourismAudio,
  normalizeTourismPhotos,
  type RawTourismAudio,
  type RawTourismPhoto,
} from "./tourism-media";

vi.mock("@/lib/env", () => ({ requireEnv: () => "test-key" }));
vi.mock("./http", () => ({ callDataGoKr: vi.fn() }));
vi.mock("@/server/cache", () => ({ apiCache: { cached: vi.fn(async (_key, _ttl, fn) => fn()) } }));

const place: SpotMediaQuery = {
  id: "ojukheon",
  nameKo: "오죽헌",
  regionKo: "강릉",
  lat: 37.779095,
  lng: 128.879778,
};
const photo: RawTourismPhoto = {
  galContentId: "photo-1",
  galTitle: "강릉 오죽헌",
  galPhotographyLocation: "강원특별자치도 강릉시 죽헌동",
  galPhotographer: "촬영자 이름",
  galPhotographyMonth: "202504",
  galWebImageUrl: "https://tong.visitkorea.or.kr/cms/photo.jpg",
};
const story: RawTourismAudio = {
  tid: "2624",
  tlid: "2716",
  stid: "3341",
  stlid: "8195",
  title: "오죽헌",
  mapX: "128.879778",
  mapY: "37.779095",
  audioTitle: "오죽헌 이야기",
  script: "장소의 실제 해설입니다.",
  playTime: "102",
  audioUrl: "",
  langCode: "ko",
};

describe("관광사진의 출처와 장소 연결", () => {
  it("이름과 촬영지 시군이 일치할 때만 사진·촬영자·공공누리 조건을 보존한다", () => {
    expect(normalizeTourismPhotos([photo], place)).toEqual([
      expect.objectContaining({
        id: "photo-1",
        title: "강릉 오죽헌",
        photographer: "촬영자 이름",
        photographedMonth: "2025-04",
        location: photo.galPhotographyLocation,
        license: expect.objectContaining({ code: "KOGL-1" }),
      }),
    ]);
  });
  it("동명이인 장소·다른 시군·연관 카페·촬영지 미제공·표출 중지 사진을 배제한다", () => {
    const rows = [
      { ...photo, galPhotographyLocation: "경기도 강릉시" },
      { ...photo, galPhotographyLocation: "강원도 춘천시 강릉이야기마을" },
      { ...photo, galTitle: "오죽헌카페" },
      { ...photo, galTitle: "오죽헌 인근 카페" },
      { ...photo, galPhotographyLocation: "" },
      { ...photo, galUseFlag: "N" },
      { ...photo, galWebImageUrl: "javascript:alert(1)" },
    ];
    expect(normalizeTourismPhotos(rows, place)).toEqual([]);
  });
  it("실제 통합 시설명의 확인된 별칭만 연결하고 다른 ID·지역·좌표에는 확대하지 않는다", () => {
    const compound = { ...place, nameKo: "강릉 오죽헌·시립박물관" };
    expect(normalizeTourismPhotos([photo], compound)).toHaveLength(1);
    expect(normalizeTourismAudio([story], [story], compound, "ko")).toHaveLength(1);
    for (const unmatched of [
      { ...compound, id: "other-museum" },
      { ...compound, regionKo: "속초" },
      { ...compound, lat: 37.5 },
      { ...compound, nameKo: "오죽헌 근처 시립박물관" },
    ]) {
      expect(normalizeTourismPhotos([photo], unmatched)).toEqual([]);
      expect(normalizeTourismAudio([story], [story], unmatched, "ko")).toEqual([]);
    }
  });
  it("동일 URL을 중복 노출하지 않고 원작자 누락을 임의로 채우지 않는다", () => {
    const result = normalizeTourismPhotos(
      [
        { ...photo, galPhotographer: "", galPhotographyMonth: "202513" },
        { ...photo, galContentId: "duplicate" },
      ],
      place,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.photographer).toBeUndefined();
    expect(result[0]?.photographedMonth).toBeUndefined();
  });
  it("HTTP 사진은 기존 프록시가 허용한 관광공사 호스트만 받아들인다", () => {
    expect(
      normalizeTourismPhotos(
        [{ ...photo, galWebImageUrl: "http://tong.visitkorea.or.kr/cms/photo.jpg" }],
        place,
      ),
    ).toHaveLength(1);
    expect(
      normalizeTourismPhotos(
        [{ ...photo, galWebImageUrl: "http://unverified.example/photo.jpg" }],
        place,
      ),
    ).toEqual([]);
  });
});

describe("오디 이야기와 언어별 원문", () => {
  it("실제 음성이 비어도 대본과 API 재생시간을 보존한다", () => {
    expect(normalizeTourismAudio([story], [story], place, "ko")).toEqual([
      expect.objectContaining({
        id: "8195",
        storyId: "3341",
        language: "ko",
        durationSeconds: 102,
        audioUrl: undefined,
        transcript: story.script,
      }),
    ]);
  });
  it("가까워도 다른 장소 또는 같은 이름이어도 먼 좌표이면 배제한다", () => {
    const nearbyOther = { ...story, title: "선교장", stid: "3336", stlid: "8175" };
    const distant = { ...story, mapX: "127.88", mapY: "37.4" };
    expect(
      normalizeTourismAudio([nearbyOther, distant], [nearbyOther, distant], place, "ko"),
    ).toEqual([]);
  });
  it("장소 내부의 명명된 하위 이야기만 허용하고 카페 접미사는 배제한다", () => {
    const rows = [
      { ...story, title: "오죽헌(몽룡실), 문성사" },
      { ...story, title: "오죽헌카페", stid: "other", stlid: "other" },
    ];
    expect(normalizeTourismAudio(rows, rows, place, "ko")).toHaveLength(1);
  });
  it("다른 언어는 한국어로 확인한 동일 관광지·이야기 ID에만 연결한다", () => {
    const english = {
      ...story,
      title: "Ojukheon House",
      audioTitle: "Ojukheon",
      langCode: "en",
      stlid: "8196",
      script: "An English story.",
    };
    const wrong = { ...english, stid: "other", stlid: "other" };
    expect(normalizeTourismAudio([story], [english, wrong, story], place, "en")).toEqual([
      expect.objectContaining({ id: "8196", language: "en", transcript: "An English story." }),
    ]);
    expect(normalizeTourismAudio([story], [{ ...english, tid: "other" }], place, "en")).toEqual([]);
  });
  it("제공하지 않는 언어를 한국어나 영어로 가장하지 않는다", () => {
    for (const lang of ["zh-TW", "de", "fr"] as const)
      expect(normalizeTourismAudio([story], [story], place, lang)).toEqual([]);
  });
  it("HTTPS 음성만 재생 대상으로 삼고 HTTP·스크립트 URL은 대본만 유지한다", () => {
    expect(
      normalizeTourismAudio(
        [story],
        [{ ...story, audioUrl: "https://www.odii.kr/sample.mp3" }],
        place,
        "ko",
      )[0]?.audioUrl,
    ).toBe("https://www.odii.kr/sample.mp3");
    for (const audioUrl of [
      "http://www.odii.kr/sample.mp3",
      "javascript:alert(1)",
      "https://user:secret@example.org/audio.mp3",
    ]) {
      expect(
        normalizeTourismAudio([story], [{ ...story, audioUrl }], place, "ko")[0]?.audioUrl,
      ).toBeUndefined();
    }
  });
  it("대본 HTML·실행 태그를 텍스트로 정리하고 잘못된 좌표·시간을 추정하지 않는다", () => {
    const result = normalizeTourismAudio(
      [story],
      [{ ...story, script: "<script>bad()</script><b>해설</b><br/>다음 내용", playTime: "NaN" }],
      place,
      "ko",
    );
    expect(result[0]).toMatchObject({ transcript: "해설\n다음 내용", durationSeconds: undefined });
    expect(normalizeTourismAudio([story], [{ ...story, mapX: "" }], place, "ko")).toEqual([]);
    expect(
      normalizeTourismAudio([story], [{ ...story, script: "", audioUrl: "" }], place, "ko"),
    ).toEqual([]);
  });
});

describe("관광 미디어 API 연결과 호출 제한", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  it("한글은 사진·오디 각각 한 번 요청하고 성공한 빈 응답은 empty로 구분한다", async () => {
    const { callDataGoKr } = await import("./http");
    const { apiCache } = await import("@/server/cache");
    vi.mocked(callDataGoKr).mockResolvedValue({ response: { body: { items: "" } } });
    const { getSpotTourismMedia } = await import("./tourism-media");
    const result = await getSpotTourismMedia(place, "ko");
    expect(result).toMatchObject({
      requestedLanguage: "ko",
      photos: { status: "empty" },
      audio: { status: "empty" },
    });
    expect(callDataGoKr).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(apiCache.cached).mock.calls.every((args) => args[1] === 24 * 60 * 60_000),
    ).toBe(true);
  });
  it("카탈로그의 복합 명칭도 확인된 미디어 이름으로 검색한다", async () => {
    const { callDataGoKr } = await import("./http");
    vi.mocked(callDataGoKr).mockResolvedValue({ response: { body: { items: "" } } });
    const { getSpotTourismMedia } = await import("./tourism-media");
    await getSpotTourismMedia({ ...place, nameKo: "강릉 오죽헌·시립박물관" }, "ko");
    expect(callDataGoKr).toHaveBeenCalledWith(
      expect.stringContaining("gallerySearchList1"),
      expect.objectContaining({ keyword: "오죽헌" }),
      expect.any(Object),
    );
  });
  it("원천 실패와 빈 결과를 구분하고 5분 동안 다른 장소에서도 재호출을 억제한다", async () => {
    const { callDataGoKr } = await import("./http");
    vi.mocked(callDataGoKr).mockRejectedValue(new Error("인증 오류"));
    const { getSpotTourismMedia } = await import("./tourism-media");
    expect(await getSpotTourismMedia(place, "ko")).toMatchObject({
      photos: { status: "unavailable" },
      audio: { status: "unavailable" },
    });
    await getSpotTourismMedia({ ...place, id: "other", nameKo: "경포대", lat: 37.795264 }, "ko");
    expect(callDataGoKr).toHaveBeenCalledTimes(2);
  });
  it("지원하지 않는 언어는 오디를 호출하지 않고 사진만 조회한다", async () => {
    const { callDataGoKr } = await import("./http");
    vi.mocked(callDataGoKr).mockResolvedValue({ response: { body: { items: "" } } });
    const { getSpotTourismMedia } = await import("./tourism-media");
    expect((await getSpotTourismMedia(place, "de")).audio.status).toBe("unsupported");
    expect(callDataGoKr).toHaveBeenCalledTimes(1);
  });
  it("영문 자료는 한글 식별 결과를 먼저 확인하고 같은 이야기만 반환한다", async () => {
    const { callDataGoKr } = await import("./http");
    vi.mocked(callDataGoKr).mockImplementation(async (endpoint, params) => ({
      response: {
        body: {
          items: {
            item: endpoint.includes("PhotoGallery")
              ? []
              : params.langCode === "ko"
                ? [story]
                : [
                    {
                      ...story,
                      langCode: "en",
                      stlid: "8196",
                      title: "Ojukheon",
                      script: "English commentary.",
                    },
                  ],
          },
        },
      },
    }));
    const { getSpotTourismMedia } = await import("./tourism-media");
    const result = await getSpotTourismMedia(place, "en");
    expect(result.audio.items).toHaveLength(1);
    expect(result.audio.items[0]?.language).toBe("en");
    expect(callDataGoKr).toHaveBeenCalledTimes(3);
  });
});
