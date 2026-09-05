# 공공 API 신청 가이드

2026-09-05 공식 명세와 실제 응답으로 확인했다. data.go.kr의 7종은 같은 계정의 **Decoding 일반 인증키**를 `DATA_GO_KR_SERVICE_KEY` 한 곳에 넣는다. Encoding/Decoding은 같은 키의 표현 방식이며, 코드가 원본 키를 한 번 인코딩한다. 각 API의 활용신청은 별도로 필요하다. 도로공사는 별도 키다.

| API 신청 페이지                                                                    | 현재 사용하는 오퍼레이션                                                                                                  | 서비스 반영                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [한국관광공사 국문 관광정보](https://www.data.go.kr/data/15101578/openapi.do)      | `KorService2`: areaBasedList2, searchKeyword2, detailCommon2, detailIntro2, detailImage2, searchFestival2, lclsSystmCode2 | 관광지·음식점·숙박·행사·사진·이용 안내                        |
| [한국관광공사 지역별 방문자수](https://www.data.go.kr/data/15101972/openapi.do)    | `DataLabService/locgoRegnVisitrDDList`                                                                                    | 탐색의 지역 방문 통계. 표본일과 외지인/외국인 구분 표시       |
| [한국관광공사 관광지 집중률 예측](https://www.data.go.kr/data/15128555/openapi.do) | `TatsCnctrRateService/tatsCnctrRatedList`                                                                                 | 일별 30일 상대 집중률. 현장 실측 혼잡도와 구분                |
| [한국관광공사 무장애 여행정보](https://www.data.go.kr/data/15101897/openapi.do)    | `KorWithService2`: areaBasedList2, detailWithTour2                                                                        | 무장애 안내 보유 필터·출입구/경사로/휠체어/화장실/영유아 안내 |
| [기상청 단기예보](https://www.data.go.kr/data/15084084/openapi.do)                 | `VilageFcstInfoService_2.0/getVilageFcst`                                                                                 | 시간대별 예보·방문 적합성                                     |
| [기상청 생활기상지수](https://www.data.go.kr/data/15085288/openapi.do)             | `LivingWthrIdxServiceV5/getUVIdxV5`                                                                                       | 자외선지수·야외 활동 안내·적합성 보정                         |
| [에어코리아 대기오염정보](https://www.data.go.kr/data/15073861/openapi.do)         | `ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty`                                                                           | 강원 측정소별 대기질                                          |
| [한국도로공사 실시간 소통 데이터](https://www.data.go.kr/data/15076684/openapi.do) | `https://data.ex.co.kr/openapi/odtraffic/trafficAmountByRealtime`                                                         | 영동·서울양양·동해(삼척–속초) 관측 구간 속도                  |

도로공사 키는 [고속도로 공공데이터 포털 인증키 발급](https://data.ex.co.kr/openapi/apikey/requestKey)에서 받고 `EX_ROAD_SERVICE_KEY`에 넣는다. data.go.kr 항목은 외부 포털로 연결하는 LINK형이다. 도로공사 요청은 `serviceKey`가 아니라 `key` 파라미터를 사용한다.

## 호출 시 주의

- TourAPI 강원 법정동 코드는 `lDongRegnCd=51`이다. 시군구는 `lDongSignguCd` 3자리. 과거 지역 코드와 혼용하지 않는다.
- 시군구 코드 조회: `ldongCode2`에 `lDongRegnCd=51`, `lDongListYn=N`.
- 집중률·방문자수 API의 시군구 코드는 `51150`처럼 5자리이며 TourAPI와 파라미터명이 다르다.
- `detailCommon2`에 예전 YN 플래그를 보내지 않는다. `searchKeyword2`도 지원하지 않는 contentTypeId를 보내지 않고 결과에서 필터링한다.
- 방문자수는 공개 시차가 있으므로 조회한 표본일을 표시한다. 일별 집중률은 상대 예측이며 시간대별 자체 추정치나 실시간 인원수로 표현하지 않는다.
- 고속도로 소통은 노선별 관측 구간 정보다. 현재 여행 코스에 대응한 경로·도착시간 계산과 구분한다.

## 캐시와 검증

날씨·대기질 30분, 도로공사 5분, 자외선 1시간, 집중률 6시간, 관광지 상세·무장애 상세·방문자수 24시간, 행사 1시간 캐시를 사용한다. 동일 요청은 합쳐 호출하며 정상 빈 응답과 일시 오류에도 재호출을 제한한다. Docker의 `/app/cache` named volume으로 재시작 후 캐시를 유지한다.

```bash
pnpm --filter @eumgil/web verify:api
```

8종의 실제 응답 요약(JSON)을 출력하며 키는 노출하지 않는다. 마지막 실행 근거는 [검증 기록](검증.md), 설정·배포는 [환경변수와 배포](환경변수-배포.md)를 참고한다.

## 행사 조회 범위

`searchFestival2`는 강원에서 현재 진행 중이거나 앞으로 30일 범위에 겹치는 행사를 조회한다. 목록은 최대 100건이며 원천에 등록되지 않은 행사까지 전수 수집했다고 표시하지 않는다. 행사 상세의 기간·요금·운영 정보와 주변 장소는 앱 내 상세 페이지에서 제공한다.

## 카탈로그 및 무장애 정보 갱신

```bash
pnpm --filter @eumgil/web db:collect:gangwon --apply
pnpm --filter @eumgil/web db:sync:accessibility --apply
```

두 명령 모두 `--apply`를 생략하면 검토만 한다. 2026-09-05 무장애 강원 목록 1,517건·박수근미술관 상세 HTTP 200. 현재 관광지 카탈로그와 contentId가 일치하는 661곳에 안내 보유 상태를 반영했다. 식당·숙소 등 다른 콘텐츠 유형은 이 관광지 수에 포함하지 않는다. `무장애 안내 있음`은 특정 사용자의 이용 가능 판정이 아니다. `없음`, 계단, 대여 수량과 조건을 원문대로 표시하고 미제공 항목은 추정하지 않는다.

반려동물 동반 안내는 국문관광정보의 `detailPetTour2`로 추가할 수 있어 별도 키 신청을 우선할 필요는 없다. 현재 화면에는 연결하지 않았다.

길찾기는 [OpenStreetMap 기반 경로 검토](관광카탈로그-탐색-고도화-2026-09-05.md#길찾기-검토)를 참고한다. 이번에는 별도 경로 서버와 Kakao Mobility 운영 연동을 진행하지 않는다.
