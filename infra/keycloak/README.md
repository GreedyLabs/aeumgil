# 에움길 운영 인증 자산

개발·운영 앱 모두 `https://auth.greedylabs.kr/realms/eumgil`의 기존 Keycloak을 사용한다. 이 저장소는 별도 인증 서버나 realm을 만들지 않는다.

- [themes/eumgil](themes/eumgil): Gitops로 배포하는 로그인 테마 소스.
- [eumgil-theme-settings.json](eumgil-theme-settings.json): 기존 realm의 테마·언어 설정 참고값.
- [테마 배포와 확인](THEME.md): Gitops 반영, 테마 선택, 파비콘과 화면 확인.
- [소셜 로그인 닉네임 정책](NICKNAME.md): 이름·성 입력 제외, 선택 닉네임, 기존 프로필 설정의 dry-run/apply 갱신과 첫 로그인 흐름 확인.
- [앱 인증·DB 설정](../../docs/Phase4-인증DB-셋업.md): Auth.js 환경변수, 개발 앱 콜백, 로그인·로그아웃.

실제 Keycloak 배포 Compose는 별도 Gitops 저장소에서 관리한다. Google 자격증명은 Keycloak에 두며 앱이나 테마에 복사하지 않는다. 운영 realm 전체를 삭제하거나 초기화 JSON으로 재import하지 않는다.
