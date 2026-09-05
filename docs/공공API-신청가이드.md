# 공공 API 신청 가이드

2026-09-05 공식 명세와 실제 응답으로 확인했다. data.go.kr의 6종은 같은 계정의 **Decoding 일반 인증키**를 `DATA_GO_KR_SERVICE_KEY` 한 곳에 넣는다. Encoding/Decoding은 같은 키의 표현 방식이며, 코드가 원본 키를 한 번 인코딩한다. 각 API의 활용신청은 별도로 필요하다. 도로공사는 별도 키다.

| API 신청 페이지 | 현재 사용하는 오퍼레이션 | 서비스 반영 |
| --- | --- | --- |
| [한국관광공사 국문 관광정보](https://www.data.go.kr/data/15101578/openapi.do) | `KorService2`: areaBasedList2, searchKeyword2, detailCommon2, detailIntro2, detailImage2, searchFestival2 | 관광지·음식점·숙박·행사·사진·이용 안내 |
| [한국관광공사 지역별 방문자수](https://www.data.go.kr/data/15101972/openapi.do) | `DataLabService/locgoRegnVisitrDDList` | 탐색의 지역 방문 통계. 표본일과 외지인/외국인 구분 표시 |
| [한국관광공사 관광지 집중률 예측](https://www.data.go.kr/data/15128555/openapi.do) | `TatsCnctrRateService/tatsCnctrRatedList` | 일별 30일 상대 집중률. 현장 실측 혼잡도와 구분 |
| [기상청 단기예보](https://www.data.go.kr/data/15084084/openapi.do) | `VilageFcstInfoService_2.0/getVilageFcst` | 시간대별 예보·방문 적합성 |
| [기상청 생활기상지수](https://www.data.go.kr/data/15085288/openapi.do) | `LivingWthrIdxServiceV5/getUVIdxV5` | 자외선지수·야외 활동 안내·적합성 보정 |
| [에어코리아 대기오염정보](https://www.data.go.kr/data/15073861/openapi.do) | `ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty` | 강원 측정소별 대기질 |
| [한국도로공사 실시간 소통 데이터](https://www.data.go.kr/data/15076684/openapi.do) | `https://data.ex.co.kr/openapi/odtraffic/trafficAmountByRealtime` | 영동·서울양양·동해(삼척–속초) 관측 구간 속도 |

도로공사 키는 [고속도로 공공데이터 포털 인증키 발급](https://data.ex.co.kr/openapi/apikey/requestKey)에서 받고 `EX_ROAD_SERVICE_KEY`에 넣는다. data.go.kr 항목은 외부 포털로 연결하는 LINK형이다. 도로공사 요청은 `serviceKey`가 아니라 `key` 파라미터를 사용한다.

## 호출 시 주의

- TourAPI 최신 강원 법정동 코드는 `lDongRegnCd=51`이다. 시군구는 `lDongSignguCd` 3자리. 구버전 `areaCode=32` 사용 코드는 교체했다.
- 시군구 코드 조회: `ldongCode2`에 `lDongRegnCd=51`, `lDongListYn=N`.
- 집중률·방문자수 API의 시군구 코드는 `51150`처럼 5자리이며 TourAPI와 파라미터명이 다르다.
- `detailCommon2`에 예전 YN 플래그를 보내지 않는다. `searchKeyword2`도 지원하지 않는 contentTypeId를 보내지 않고 결과에서 필터링한다.
- 방문자수는 공개 시차가 있으므로 조회한 표본일을 표시한다. 일별 집중률은 상대 예측이며 시간대별 자체 추정치나 실시간 인원수로 표현하지 않는다.
- 고속도로 소통은 노선별 관측 구간 정보다. 현재 여행 코스에 대응한 경로·도착시간 계산과 구분한다.

## 캐시와 검증

날씨·대기질 10분, 도로공사 5분, 자외선 1시간, 집중률 6시간, 관광지 상세·방문자수 24시간, 행사 1시간 캐시를 사용한다. 동일 요청은 합쳐 호출하며 정상 빈 응답과 일시 오류에도 재호출을 제한한다. Docker의 `/app/cache` named volume으로 재시작 후 캐시를 유지한다.

```bash
pnpm --filter @eumgil/web verify:api
```

7종의 실제 응답 요약(JSON)을 출력하며 키는 노출하지 않는다. 2026-09-05: 관광정보 4,761건, 집중률 30일, 강원 대기질 40곳, 자외선·단기예보·도로공사 정상. 방문자수는 2026-08-01 표본일 자료를 확인했다. 자세한 환경변수·배포 절차는 [환경변수와 배포](환경변수-배포.md)를 참고한다.
