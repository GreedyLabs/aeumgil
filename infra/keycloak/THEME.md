# 에움길 인증 화면 테마

앱의 `/login`과 `auth.greedylabs.kr`의 인증 화면을 공통 색상·풍경·반응형 패널로 연결한다. 테마 소스는 이 저장소에서 관리하고 실제 인증 서버에는 별도 Gitops 저장소의 Keycloak Compose로 배포한다. 로컬 Keycloak 실행·미리보기 realm 구성은 제공하지 않는다.

## 구성과 인증 경계

`themes/eumgil/login`은 `keycloak.v2`를 상속하며 Keycloak 26.6.3을 기준으로 한다. CSS·7언어 메시지·정책 링크용 `footer.ftl`·파비콘 자산 스크립트를 관리한다. 지원 언어는 한국어(`ko`), 영어(`en`), 중국어 간체(`zh-CN`)·번체(`zh-TW`), 일본어(`ja`), 독일어(`de`), 프랑스어(`fr`)다. 로그인·회원가입·비밀번호 재설정 폼과 자격증명 처리는 Keycloak 기본 구현을 사용한다. 계정 관리·관리자 콘솔·메일 테마는 별도다.

Keycloak이 신원과 SSO 세션을 관리하고 앱은 Auth.js로 인증 결과를 받는다. 같은 디자인이어도 인증 서버로 이동하는 OIDC 구조를 유지한다. Google 버튼은 실제 활성화된 IdP 설정으로 표시하며 Google 자격증명을 테마에 넣지 않는다.

## Gitops 반영

운영 Compose는 공식 Keycloak 이미지를 사용한다. Dockhand 데이터 볼륨의 `stacks/greedylabs/keycloak/themes/eumgil`을 읽기 전용 `volume.subpath`로 연결하며 이미지 빌드는 필요하지 않다. 볼륨명·하위 경로와 정확한 배포값은 Gitops의 Keycloak README·Compose를 정본으로 삼는다.

1. 변경한 테마 파일을 Gitops의 동일한 테마 디렉터리에도 반영한다. `EUMGIL_APP_URL`은 운영 앱의 Punycode 주소이며 정책 링크가 이 주소를 따른다.
2. Dockhand가 테마 파일을 데이터 볼륨에 동기화한 뒤 기존 배포 절차로 Keycloak 컨테이너를 재생성한다. 운영 테마 캐시는 유지한다.
3. `eumgil` realm의 Login theme을 `eumgil`로 선택하고 `eumgil-theme-settings.json`의 7개 언어를 활성화한다. 이 파일은 테마·언어 설정만 담은 참고 자료이며 서버에 자동 반영되지 않는다. Client에 별도 테마 override가 있으면 일치 여부를 확인한다.
4. 앱 `/login`에서 로그인·회원가입·오류·재설정 화면과 로그아웃·복귀 경로를 확인한다. SMTP와 Google 실제 왕복은 별도로 확인한다.

기존 realm과 사용자·Client·secret을 다시 만들 필요는 없다. 테마를 되돌릴 때는 realm의 Login theme을 기존 값으로 바꾸고 Gitops 테마 파일·마운트를 이전 버전으로 복구한다.

## 언어와 번역 경계

앱의 언어 선택은 `eumgil.lang` 쿠키로 보존하며 로그인 요청의 `ui_locales`에 선택 언어를 먼저 전달한다. 인증 서버에서 지원하지 않는 경우 영어·한국어 순서로 대체한다. 테마 파일의 `locales`와 운영 realm의 Supported locales가 모두 일치해야 선택 언어가 실제로 나타난다.

메시지 파일은 UTF-8이며 중국어는 Java 메시지 파일 규칙에 따라 `messages_zh_CN.properties`, `messages_zh_TW.properties`로 저장한다. Keycloak은 이 레거시 코드와 새 `zh-Hans`·`zh-Hant` 코드를 연결하는 호환 처리를 제공한다. 운영 realm과 앱은 `zh-CN`·`zh-TW`를 정본으로 사용하며 같은 번역을 두 코드로 중복 등록하지 않는다.

브랜드 소개·로그인과 재설정 안내·Google 로그인 문구·동의 버튼·정책 링크를 7개 언어로 관리하고 나머지 인증 오류·보안키·메일 확인 문구는 부모 테마 번역을 상속한다. 번역이 없는 부모 문구는 영어로 표시될 수 있다. 약관 본문이나 Google 동의 화면을 로그인 테마가 번역하는 것은 아니다. Footer는 메시지 키만 사용하며 파비콘 스크립트에는 표시 문구가 없다. 기본 로그인 폼을 복제하지 않아 Keycloak의 인증·접근성 동작을 유지한다.

## 화면과 파비콘 확인

320·390·768·1440px에서 7개 언어의 로그인·회원가입·재설정 화면의 문구·입력·정책 링크·가로 넘침을 확인한다. 특히 독일어·프랑스어의 긴 제목과 중국어 간체·번체의 구분을 확인한다. 언어 선택을 제목 위 별도 행에 두며 폼과 정책 링크는 긴 단어를 줄바꿈한다. 실제 계정 쓰기가 필요한 인증·재설정 검사는 별도 허용된 검증 계정으로 수행한다. 앱 세션 픽스처 E2E는 Keycloak/Google 실제 로그인을 대신하지 않는다.

- 앱 아이콘: `apps/web/src/app/icon.svg`, `favicon.ico`, `apple-icon.png`. 앱 이미지로 배포한다.
- 인증 서버 아이콘: `themes/eumgil/login/resources/img/favicon.ico`. `js/eumgil-assets-v1.js`의 자산 버전과 함께 Gitops로 반영한다.

아이콘 변경 후 실제 페이지의 `rel=icon` URL·응답과 새 브라우저 세션을 비교한다. 앱 아이콘과 인증 서버 아이콘은 별도 배포 자산이며, 관리자 콘솔·계정 관리·Google 동의 화면의 로고도 로그인 테마와 다르다.

```bash
pnpm --filter @eumgil/web verify:keycloak
```

이 명령은 `.env`의 운영 issuer에 대한 OIDC discovery와 실행 중인 앱 provider 구성을 읽는다. 테마 화면 품질·Client Secret 유효성·사용자 로그인 완료를 검증하는 명령은 아니다. 마지막 실제 검사 범위는 [검증 기록](../../docs/검증.md)을 따른다.

참고: [Keycloak 테마 가이드](https://www.keycloak.org/ui-customization/themes), [메시지·중국어 코드 규칙](https://www.keycloak.org/ui-customization/localization), [26.6.3 기본 로그인 테마](https://github.com/keycloak/keycloak/tree/26.6.3/themes/src/main/resources/theme/keycloak.v2/login), [Next.js 아이콘 규칙](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons).
