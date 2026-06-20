# 공공 API 신청 가이드 (에움길 Phase 2)

> 전체 실연동 제출을 위해 연동할 공공 OpenAPI 목록. 각 항목의 **정식 명칭으로 포털에서
> 검색 → 활용신청**하면 된다. 발급받은 서비스키는 루트 `.env` 의 해당 변수에 넣는다
> ([.env.example](../.env.example) 참고).
>
> **공통 팁**
> - 공공데이터포털(data.go.kr)은 발급 시 **인증키 2종**(Encoding/Decoding)을 준다.
>   서버에서 직접 호출하므로 **Decoding(원본) 키**를 `.env` 에 넣는다(코드가 한 번만 인코딩).
> - 대부분 **개발계정은 자동승인**(즉시 사용), 운영계정은 심의·활용사례 등록 필요.
>   개발계정 트래픽 한도(보통 1,000건/일)로 개발·시연은 충분.
> - 강원특별자치도 지역코드(TourAPI `areaCode`) = **32**.

---

## 1. 한국관광공사 — 국문 관광정보 서비스 ⭐ (가장 핵심)

- **정식 명칭**: `한국관광공사_국문 관광정보 서비스_GW`
- **포털**: https://www.data.go.kr/data/15101578/openapi.do
- **엔드포인트 base**: `http://apis.data.go.kr/B551011/KorService2`
- **주요 오퍼레이션**:
  - `areaBasedList2` — 지역기반 관광정보 목록 (강원: `areaCode=32`)
  - `locationBasedList2` — 좌표(반경) 기반 목록
  - `searchKeyword2` — 키워드 검색
  - `detailCommon2` — 공통 상세(개요/주소/좌표/대표이미지)
  - `detailIntro2` — 타입별 상세(이용시간/주차 등)
  - `detailImage2` — 이미지 목록
  - `areaCode2` / `categoryCode2` — 코드 조회
- **필수 파라미터**: `serviceKey`, `MobileOS`(ETC), `MobileApp`(앱명), `_type`(json)
- **용도**: 강원 관광지·행사·음식점·숙박 기본정보(이름/주소/좌표/이미지/분류) 수집 → 큐레이션 스팟 보강(반정적 데이터)
- **.env**: `TOUR_API_SERVICE_KEY`

## 2. 한국관광공사 — 빅데이터 지역별 방문자수

- **정식 명칭**: `한국관광공사_빅데이터_지역별 방문자수_GW`
- **포털**: https://www.data.go.kr/data/15101972/openapi.do
- **방식**: REST, JSON+XML / 이동통신 데이터 기반
- **용도**: 강원 기초지자체 단위 방문 흐름 파악 → 혼잡 분산(덜 붐비는 권역) 판단 보조
- **.env**: `TOUR_BIGDATA_SERVICE_KEY` (같은 계정 키면 1번과 동일 값 가능)

## 3. 한국관광공사 — 관광지 집중률 방문자 추이 예측

- **정식 명칭(검색어)**: `관광지 집중률` 또는 `방문자 추이 예측` — 한국관광공사 제공
- **데이터 설명/포털**: 한국관광 데이터랩 https://datalab.visitkorea.or.kr
  (이동통신 기반 ML 로 향후 약 30일 집중률을 상대 수치로 예측)
- **확인 필요**: data.go.kr 에서 위 검색어로 OpenAPI 형태 데이터셋을 찾아 신청
  (데이터랩 제공 형태에 따라 별도 신청 절차일 수 있음 — 신청 시 확인 부탁)
- **용도**: 특정 관광지 향후 집중률 → 방문 적합성/대체지 추천의 핵심 신호
- **.env**: `TOUR_BIGDATA_SERVICE_KEY` 와 공유 가능

## 4. 기상청 — 단기예보 조회서비스

- **정식 명칭**: `기상청_단기예보 ((구) 동네예보) 조회서비스`
- **포털**: https://www.data.go.kr/data/15084084/openapi.do
- **엔드포인트**: `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`
- **필수 파라미터**: `serviceKey`, `dataType`(JSON), `base_date`, `base_time`, `nx`, `ny`(격자 좌표)
- **용도**: 권역별 날씨(기온/강수/풍속) → 방문 적합성 판단 (해변·산악 테마 민감도)
- **메모**: 위경도 → 기상청 격자(nx, ny) 변환 필요 (강원 권역 좌표 테이블을 코드에 둘 예정)
- **.env**: `KMA_SERVICE_KEY`

## 5. 기상청 — 생활기상지수 조회서비스(3.0)

- **정식 명칭**: `기상청_생활기상지수 조회서비스(3.0)`
- **포털**: https://www.data.go.kr/data/15085288/openapi.do
- **엔드포인트 base**: `http://apis.data.go.kr/1360000/LivingWthrIdxServiceV4`
- **용도**: 자외선지수·대기정체지수·체감온도 → 해변/산악/겨울 여행 체감 환경 보정
- **.env**: `KMA_SERVICE_KEY` (4번과 동일 기상청 계정 키 공유 가능)

## 6. 한국환경공단 — 에어코리아 대기오염정보

- **정식 명칭**: `한국환경공단_에어코리아_대기오염정보`
- **포털**: https://www.data.go.kr/data/15073861/openapi.do
- **엔드포인트 base**: `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc`
- **주요 오퍼레이션**:
  - `getCtprvnRltmMesureDnsty` — 시도별 실시간(강원: `sidoName=강원`)
  - `getMsrstnAcctoRltmMesureDnsty` — 측정소별 실시간
- **필수 파라미터**: `serviceKey`, `returnType`(json), `sidoName` 또는 `stationName`
- **용도**: 미세먼지·대기질 → 야외 활동(해변/트레킹) 적합성 판단
- **.env**: `AIRKOREA_SERVICE_KEY`

## 7. 한국도로공사 — 실시간 소통 데이터

- **정식 명칭**: `한국도로공사_실시간 소통 데이터`
- **포털(공공데이터포털)**: https://www.data.go.kr/data/15076684/openapi.do
- **포털(고속도로 공공데이터)**: https://data.ex.co.kr (OpenAPI 별도 신청 가능)
- **관련 데이터셋**: `실시간 전국 교통량`, `현재 교통예보 현황`, `실시간 문자정보`
- **용도**: 강원 진입/권역 이동 교통 정체 → 출발시간·권역 선택 보정
- **.env**: `EX_ROAD_SERVICE_KEY` (data.ex.co.kr 발급 키는 별도일 수 있음)

---

## 신청 우선순위 (개발 순서 기준)

1. **1번 국문 관광정보** — 모든 화면의 관광지 데이터 기반. **가장 먼저.**
2. **6번 에어코리아 + 4번 단기예보** — 방문 적합성 점수(Phase 3)의 핵심 입력.
3. **3번 집중률 예측 + 2번 방문자수** — 혼잡도/분산 추천 정밀화.
4. **5번 생활기상지수 + 7번 도로공사** — 적합성 보정(있으면 좋음).

## 키 발급 후 검증 방법

`.env` 에 키를 채운 뒤, 연결이 정상인지 한 번에 확인:

```bash
node --env-file=.env apps/web/scripts/verify-public-api.mjs
```

키가 설정된 API 마다 실제 1회 호출해 **✓ 연결 / ✗ 오류 / – 키없음** 을 출력한다.
(개발계정 자동승인이라도 발급 직후 1~2시간 반영 지연이 있을 수 있음.)
