# 소셜 로그인 닉네임 정책

Google 로그인은 이름·성·닉네임이 없어도 완료할 수 있어야 한다. 에움길은 Keycloak의 `sub`를 계정 식별자로 유지하고, 화면에는 앱에 저장한 닉네임을 우선 표시한다. 저장한 값이 없으면 OIDC `nickname`, 개인정보와 다른 짧은 `preferred_username`, `sub` 기반 별명 순서로 사용한다. 이메일·성·이름은 자동 표시명으로 사용하지 않는다.

## User Profile 갱신

[update-nickname-policy.mjs](update-nickname-policy.mjs)는 **기존 eumgil realm**의 `/admin/realms/eumgil/users/profile`만 읽고 갱신한다. realm 재import, 사용자 생성·수정·삭제, Google 자격증명 변경은 하지 않는다. 이름/성의 기존 사용자 값도 삭제하지 않는다.

| 속성                     | 변경 내용                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `username`, `email`      | 현재 설정을 그대로 보존                                                                           |
| `firstName`, `lastName`  | `required` 제거, view/edit는 `admin`만 허용                                                       |
| `nickname`               | 선택사항, 사용자·관리자 view/edit 허용. 새로 추가할 때만 최대 20자 검증과 `${nickname}` 라벨 설정 |
| 기타 속성·그룹·검증·정책 | 그대로 보존                                                                                       |

User Profile은 **realm 전체**에 적용된다. 같은 realm의 다른 client가 이름·성을 필수로 사용하는지 먼저 확인한다. 실제 이용자를 실명에서 별명으로 일괄 개명하거나 기존 개인정보를 삭제하는 작업과는 별개다.

관리자가 발급한 단기 access token을 `KEYCLOAK_ADMIN_TOKEN` 환경변수로 제공한다. 일반 앱의 `AUTH_KEYCLOAK_SECRET`이나 탈퇴용 관리 Client Secret을 토큰 대신 사용하지 않는다. 토큰 발급·권한 부여는 스크립트가 수행하지 않는다. 토큰에는 현재 User Profile 조회/수정에 필요한 realm 관리 권한이 있어야 한다. 관리 토큰과 서버 원문 응답은 출력하지 않는다.

```bash
node infra/keycloak/update-nickname-policy.mjs
node infra/keycloak/update-nickname-policy.mjs --apply
```

기본은 GET만 하는 dry-run이다. `KEYCLOAK_ADMIN_URL`을 지정하지 않으면 `https://auth.greedylabs.kr`를 사용하며 대상 realm은 `eumgil`로 고정되어 있다. 적용 전에 관리 화면의 User Profile JSON을 보관한다. `--apply`는 두 번째 GET으로 동시 변경을 확인하고 PUT 후 전체 프로필 설정의 재조회 일치를 검사한다. GET–PUT 사이의 원자적 잠금은 없으므로 적용하는 짧은 동안 같은 설정을 관리 화면에서 함께 수정하지 않는다. 오류가 나면 dry-run으로 현재 상태부터 확인하고, 자동으로 다른 관리자의 변경을 되돌리지 않는다.

네트워크 없이 정책과 쓰기 조건을 검사하려면 다음 명령을 사용한다.

```bash
node --test infra/keycloak/nickname-policy.test.mjs
```

## First broker login 설정

이 부분은 위 updater가 변경하지 않는다. 관리 콘솔에서 실제 Google provider가 사용하는 흐름을 확인하고 필요한 설정 하나만 수정한다.

1. `Identity providers → Google → First login flow`에서 적용 흐름을 확인한다. override가 없으면 realm의 First broker login 흐름을 따른다.
2. `Authentication → Flows → 해당 흐름 → Review Profile` 설정의 **Update Profile on First Login**을 **missing**으로 저장한다. 원래 `missing`이면 그대로 둔다. 공식 설정 키는 `update.profile.on.first.login`이다. 이 값은 필요한 필수 속성이 누락되었을 때만 프로필 입력을 연다.
3. `Review Profile` execution을 끄거나 설정을 `off`로 바꾸지 않는다. 같은 흐름의 기존 계정 연결 확인·재인증·이메일 확인 execution, provider의 Trust Email, Required actions의 Verify Profile·Verify Email과 기본 활성화 상태를 보존한다.
4. 다시 흐름을 열어 `missing`과 기존 execution을 확인한다. 이미 진행 중이던 로그인은 취소하고 에움길 로그인부터 새로 시작한다. 이름·성·닉네임이 없는 신규 Google 계정이 추가 입력 없이 돌아오는지 확인한다. 필요한 이메일이 누락되거나 기존 계정 연결 확인이 필요한 경우 그 단계는 계속 표시되어야 한다.

## 선택적인 nickname claim 매퍼

앱은 nickname claim이 없어도 자동 별명으로 진행한다. Keycloak에서 사용자가 입력한 nickname도 앱에 전달하려면 eumgil client와 연결된 scope의 기존 매퍼부터 확인한다. 같은 claim이 이미 나오면 새 매퍼를 추가하지 않는다.

필요한 경우 `Clients → eumgil → Client scopes → eumgil-dedicated → Mappers`에 [eumgil-nickname-mapper.json](eumgil-nickname-mapper.json)의 **User Attribute** 매퍼를 추가한다. User Attribute와 Token Claim Name은 `nickname`, Claim JSON Type은 `String`, ID token/UserInfo는 On, Access token은 Off로 둔다. realm 공용 `profile` scope를 변경하지 않는다. 새 매퍼를 추가했다면 저장 뒤 다시 조회하고 eumgil client의 토큰 평가에서 nickname을 확인한다. 토큰 전문을 문서·로그·스크린샷에 남기지 않는다.

로그인 테마의 7개 메시지 파일에 `nickname` 라벨을 제공한다. Gitops의 같은 테마 파일에도 반영해야 하며 CSS로 firstName/lastName 입력을 숨기는 방식은 서버의 필수 입력 검증을 해결하지 못한다.

운영 설정 저장 확인과 실제 Google 로그인 전체 왕복은 다른 검증이다. 확인한 범위는 [검증 기록](../../docs/검증.md)에 구분해서 남긴다.

근거: [Keycloak User Profile 관리](https://www.keycloak.org/docs/latest/server_admin/#user-profile), [Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html), [Review Profile 설정 구현](https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/authentication/authenticators/broker/IdpReviewProfileAuthenticatorFactory.java).
