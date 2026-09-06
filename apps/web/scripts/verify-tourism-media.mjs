import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../../../.env.local", import.meta.url)), quiet: true });
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
if (!serviceKey) {
  console.error("DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  process.exit(1);
}

// 오죽헌 공개 좌표의 원천 응답만 검증하며 DB·캐시는 변경하지 않는다.
const calls = [
  ["관광사진", "PhotoGalleryService1/gallerySearchList1", { keyword: "오죽헌", arrange: "A" }],
  [
    "오디 한국어",
    "Odii/storyLocationBasedList",
    { mapX: 128.879778, mapY: 37.779095, radius: 1000, langCode: "ko" },
  ],
];
let unavailable = false;
for (const [name, operation, parameters] of calls) {
  const url = new URL(`https://apis.data.go.kr/B551011/${operation}`);
  for (const [key, value] of Object.entries({
    serviceKey,
    MobileOS: "ETC",
    MobileApp: "eumgil",
    _type: "json",
    numOfRows: 100,
    pageNo: 1,
    ...parameters,
  }))
    url.searchParams.set(key, String(value));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      console.log(`${name}: HTTP ${response.status}, JSON 응답 없음`);
      unavailable = true;
      continue;
    }
    const code =
      data.response?.header?.resultCode ??
      data.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
    if (!response.ok || !/^0+$/.test(String(code))) {
      console.log(`${name}: HTTP ${response.status}, 결과 코드 ${code ?? "미제공"}`);
      unavailable = true;
      continue;
    }
    const item = data.response?.body?.items?.item;
    const rows = Array.isArray(item) ? item : item ? [item] : [];
    console.log(
      JSON.stringify({
        source: name,
        status: response.status,
        code,
        total: data.response?.body?.totalCount,
        received: rows.length,
        fields: Object.keys(rows[0] || {}),
        photosWithUrl: rows.filter((row) => row.galWebImageUrl).length,
        audioWithUrl: rows.filter((row) => row.audioUrl).length,
        transcripts: rows.filter((row) => row.script).length,
        authors: rows.filter((row) => row.galPhotographer).length,
      }),
    );
  } catch {
    unavailable = true;
    console.log(`${name}: 네트워크 연결 또는 응답 시간 확인 필요`);
  }
}
process.exitCode = unavailable ? 1 : 0;
