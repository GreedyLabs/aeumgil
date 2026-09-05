# 에움길 인증 화면 테마

앱의 `/login`과 실제 Keycloak 인증 화면을 청록색·풍경 일러스트·반응형 패널로 연결한다. 공유받은 `gitops/keycloak/docker-compose.yml`의 **Keycloak 26.6.3**에 맞췄다. 2026-09-05 `b1bf387` 배포 후 원격 컨테이너에서 테마 파일과 읽기 전용 하위 경로 마운트를 확인했다. 원격 eumgil realm에 테마를 선택하고 국제화를 켜 한국어를 기본 언어로 저장했다. 실제 원격 로그인에서 커스텀 CSS·풍경·한국어·Google 버튼을 확인했다.

## 구성과 선택 이유

`themes/eumgil/login`은 **keycloak.v2를 상속**한다. CSS, 한국어/영어 메시지, 정책 링크용 `footer.ftl`만 변경한다. 로그인·회원가입·비밀번호 재설정·오류 표시·비밀번호 보기의 폼/스크립트는 Keycloak 기본 구현을 유지한다. 새로운 비밀번호 처리 API를 앱에 만들지 않는다.

인증 서버가 자격증명과 SSO 세션을 관리하고, 앱은 Auth.js를 통해 인증 결과를 받는다. 같은 디자인을 쓰더라도 브라우저가 `auth.greedylabs.kr`로 이동하는 OIDC 구조는 유지된다. 앱은 로그인 후 허용된 내부 주소로 돌아오며 `ui_locales=ko`를 전달한다.

기본 템플릿을 상속하면 Keycloak 업데이트의 인증 관련 변경을 받기 쉽다. CSS 클래스는 버전별로 달라질 수 있으므로 Keycloak 업그레이드마다 아래 검증을 다시 실행한다. 소셜 버튼은 **실제로 활성화된 IdP만** Keycloak이 렌더한다. 한국어 메시지 미정의 항목은 부모 테마의 번역을 상속한다. 계정 관리·관리자 콘솔·메일 테마는 이번 범위에 포함하지 않는다.

참고: [공식 테마 개발·적용 가이드](https://www.keycloak.org/ui-customization/themes), [26.6.3 기본 테마](https://github.com/keycloak/keycloak/tree/26.6.3/themes/src/main/resources/theme/keycloak.v2/login).

## 로컬 실물 확인

프로젝트 루트에서 실행한다. 운영 DB와 연결되지 않는 H2 기반 미리보기다. 운영용 설정으로 사용하지 않는다.

```bash
docker compose -p eumgil-theme-preview -f infra/keycloak/docker-compose.preview.yml up -d
# 시작 후 http://localhost:8188/realms/eumgil-preview/account/
# 미리보기 전용 계정: demo / demo-preview-only
pnpm --filter @eumgil/web exec playwright test -c playwright.keycloak.config.ts
# 정리하면 미리보기 realm과 계정도 제거된다.
docker compose -p eumgil-theme-preview -f infra/keycloak/docker-compose.preview.yml down
```

브라우저 테스트는 한국어 기준 320·390·768·1440px에서 로그인·회원가입·재설정 폼, 가로 넘침, 정책 링크, 오류 메시지, 비밀번호 표시 토글, 임시 계정 로그인 성공을 확인한다. SMTP가 없는 미리보기이므로 재설정 **메일 발송은 검사하지 않는다**. 원격 운영 계정 및 소셜 로그인 왕복도 별도다.

## 공유받은 배포 compose에 적용

2026-09-05 사용자 승인으로 gitops에 테마·compose를 반영했다. 실제 Dockhand 배포에서 상대 바인드 경로(`/app/data/...`)가 Docker 호스트에 없어 실패한 것을 확인했다. 공식 Keycloak 이미지는 그대로 사용하고, 기존 external 볼륨 `dockhand_dockhand_data`의 `stacks/greedylabs/keycloak/themes/eumgil`만 읽기 전용 `volume.subpath`로 연결하도록 수정했다. 사용자 요청대로 이미지 빌드 없이 배포한다.

볼륨명·하위 경로는 `DOCKHAND_DATA_VOLUME`·`EUMGIL_THEME_SUBPATH`로 재정의할 수 있다. compose 검증 완료. 이전 상대 bind 패치는 제거했으며 Gitops compose가 배포 기준이다. 테마 원본과 gitops 복사본을 함께 유지한다.

1. `EUMGIL_APP_URL` 기본값은 gitops README에 등록된 `https://에움길.한국`의 Punycode 주소다. 새 secret이나 필수 환경변수는 없다. 공개 도메인이 바뀌면 해당 변수만 변경한다(끝 `/` 제외).
2. 평소 gitops 배포 경로로 **테마 파일과 compose를 함께** 서버에 반영하고 Keycloak 컨테이너를 재생성한다. Dockhand가 먼저 테마 파일을 데이터 볼륨에 동기화해야 한다. Build images on deploy는 OFF로 둔다.
3. 관리자 콘솔에서 **eumgil realm** → Realm settings → Themes → Login theme을 `eumgil`로 저장한다. Internationalization에서 한국어·영어를 활성화하고 기본 언어를 한국어로 설정한다. `eumgil-theme-settings.json`은 이 네 가지 값만 담은 업데이트 참고 자료다.
4. `eumgil` client에 별도의 Login theme override가 있으면 제거하거나 `eumgil`로 맞춘다. master realm 및 다른 서비스 realm에 테마를 지정할 필요는 없다.
5. 앱 `/login`에서 진입해 원격 로그인·회원가입·오류·재설정·로그아웃·복귀 주소를 점검한다. 회원가입 허용, 비밀번호 정책, SMTP, IdP 설정은 운영 설정이므로 테마 적용이 대신하지 않는다.

**기존 realm을 삭제하거나 전체 realm JSON을 재import하지 않는다.** 테마 변경은 사용자/클라이언트/secret을 재생성할 일이 아니다. 운영에서는 테마 캐시를 끄지 않는다. 변경 파일을 반영할 때 컨테이너 재생성으로 이전 컨테이너의 정적 캐시를 비운다.

되돌리려면 realm의 Login theme을 기존 값(`keycloak.v2` 등)으로 먼저 바꾼 후 마운트와 환경변수를 제거한다. 데이터베이스 마이그레이션은 없다.

## 파비콘

2026-09-05 확인 시 앱에는 아이콘 파일·메타데이터가 없었고, Keycloak 테마에는 파비콘이 없어 부모 테마 아이콘을 사용했다. 기존 경로 심볼을 사용한 동일 아이콘을 다음 위치에 추가했다.

- 앱: `apps/web/src/app/icon.svg`(벡터 원본), `favicon.ico`(16·32·48px), `apple-icon.png`(180px). Next.js가 해당 파일에서 `<link>` 태그를 자동 생성한다. 앱 배포에 함께 포함한다.
- Keycloak: `themes/eumgil/login/resources/img/favicon.ico`. Gitops의 같은 경로에도 복사했다. 26.6.3 기본 로그인 템플릿이 이 경로를 참조하므로 `template.ftl` 전체 복제나 이미지 빌드는 필요 없다.

Gitops에 아이콘을 커밋·푸시한 다음 Dockhand에서 동기화하고 Keycloak을 재생성한다. 이 아이콘 추가분은 앞서 배포한 `b1bf387`에 포함되지 않는다. 운영 캐시 설정은 유지한다. 새 파일이 서버에 반영되어도 이전 아이콘이 남으면, 개발자 도구에서 실제 `rel=icon` URL의 응답을 먼저 확인한 뒤 새 시크릿 창으로 비교하고 해당 사이트의 브라우저 캐시를 비운다. 앱 SVG/Apple 아이콘에는 Next.js가 버전 쿼리를 자동으로 붙인다.

관리자 콘솔(`master`의 admin 테마), 계정 관리 화면(account 테마), Google 동의 화면의 로고는 로그인 테마와 별도다. Google 동의 화면 로고는 Google Auth Platform → Branding에서 설정한다.

참고: [Next.js 아이콘 규칙](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons), [Keycloak 26.6.3 로그인 템플릿](https://github.com/keycloak/keycloak/blob/26.6.3/themes/src/main/resources/theme/keycloak.v2/login/template.ftl).
