import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** 서버 토큰 갱신 실패 등 클라이언트가 재로그인을 유도할 때 쓰는 비민감 오류 코드. */
    authError?: string;
    user?: DefaultSession["user"] & {
      /** Keycloak subject(sub). 앱 DB 의 user_id 로 사용한다. */
      id?: string;
      /** Keycloak realm/client role 을 평탄화한 앱 권한. */
      roles?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Keycloak realm/client role 을 평탄화한 앱 권한. */
    roles?: string[];
    /** Keycloak access token. 서버 콜백/서버 코드에서만 사용하고 client session 에 노출하지 않는다. */
    accessToken?: string;
    /** Keycloak id token. SSO logout URL 구성 등 서버 용도. */
    idToken?: string;
    /** Keycloak refresh token. 필요 시 서버에서 토큰 갱신에만 사용한다. */
    refreshToken?: string;
    /** access token 만료 epoch seconds. */
    accessTokenExpiresAt?: number;
    /** 서버 토큰 갱신 실패 등 비민감 오류 코드. */
    error?: string;
  }
}
