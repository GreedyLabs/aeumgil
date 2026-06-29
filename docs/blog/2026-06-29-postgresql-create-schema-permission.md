# PostgreSQL `CREATE SCHEMA IF NOT EXISTS`와 권한 함정: 스키마가 있어도 권한을 검사하는 이유

PostgreSQL에서 스키마가 이미 존재함에도 `CREATE SCHEMA IF NOT EXISTS`가 권한 오류를 내는 상황을 직접 겪으면서 원인과 해결책을 정리했습니다. 비슷한 상황에서 시간을 낭비하지 않으시도록 기록으로 남깁니다.

에움길 프로젝트의 DB 스키마 적용 스크립트를 실행하다 아래 오류를 만났습니다.

```
✗ 적용 실패 — permission denied for database eumgil_dev
```

스키마는 이미 있는데 왜 권한 오류가 나는지 처음엔 이해가 되지 않았습니다. 이 글은 그 원인을 파악하고 코드 한 줄로 해결하기까지의 과정을 정리한 기록입니다. PostgreSQL의 DDL 권한 동작이 직관과 다르게 동작하는 지점에서 막히신 분들께 참고가 되었으면 합니다.

## 상황 파악하기

스크립트는 앱이 사용하는 테이블만 idempotent하게 생성·보정하는 Node.js 스크립트였습니다. 핵심 코드는 다음과 같았습니다.

```js
if (SCHEMA !== "public") await sql.unsafe(`create schema if not exists ${schemaSql}`);
```

`DATABASE_SCHEMA=eumgil_dev`로 설정되어 있었으니, 이 줄이 실행되면서 오류가 발생했습니다. 스키마는 분명히 이미 DB에 존재하고 있었는데도 말입니다.

## `IF NOT EXISTS`가 권한을 면제하지 않는 이유

PostgreSQL은 DDL 문을 실행할 때 **결과와 무관하게 권한을 먼저 검사**합니다. `CREATE SCHEMA IF NOT EXISTS`도 마찬가지입니다. 스키마가 이미 있어서 실제로는 아무것도 생성하지 않더라도, SQL 파서가 `CREATE SCHEMA`를 만나는 순간 데이터베이스의 `CREATE` 권한을 확인합니다.

`permission denied for database eumgil_dev`라는 메시지가 바로 이 상황에 해당합니다. 테이블·컬럼에 대한 권한 오류(`permission denied for table`)와 달리, 데이터베이스 레벨의 `CREATE` 권한이 없을 때 나오는 메시지입니다.

정리하면, `IF NOT EXISTS`는 "이미 있으면 에러 없이 넘어간다"는 의미이지, "권한 없어도 실행된다"는 의미가 아닙니다.

## 코드 수정: DDL 전에 존재 여부를 직접 확인하기

해결책은 간단합니다. `CREATE SCHEMA`를 시도하기 전에 `information_schema.schemata`에서 스키마 존재 여부를 먼저 조회하고, 없을 때만 생성하도록 바꾸면 됩니다.

**수정 전**
```js
if (SCHEMA !== "public") await sql.unsafe(`create schema if not exists ${schemaSql}`);
```

**수정 후**
```js
if (SCHEMA !== "public") {
  const exists = await sql`select 1 from information_schema.schemata where schema_name = ${SCHEMA} limit 1`;
  if (exists.length === 0) await sql.unsafe(`create schema ${schemaSql}`);
}
```

`information_schema.schemata` 조회는 `SELECT` 권한만 있으면 되기 때문에, 스키마가 이미 있는 경우 `CREATE` 권한을 전혀 건드리지 않습니다. 스키마가 없는 경우에만 `CREATE SCHEMA`를 실행하므로, 그때는 당연히 권한이 필요합니다.

## 기존 데이터나 제약이 있을 때

스크립트는 테이블 생성·컬럼 추가 모두 `IF NOT EXISTS`로 idempotent하게 설계되어 있습니다. 단, primary key 추가 시에는 NULL이나 중복이 있으면 실패합니다. 기존 데이터가 있다면 다음 순서로 정리한 뒤 재실행하면 됩니다.

```sql
-- NULL 행 제거
DELETE FROM eumgil_dev.saved_theme WHERE user_id IS NULL OR theme_id IS NULL;

-- 중복 PK 후보 제거 (가장 오래된 것 삭제)
DELETE FROM eumgil_dev.saved_theme a
USING eumgil_dev.saved_theme b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.theme_id = b.theme_id;
```

## 마치며

PostgreSQL의 DDL 권한 검사는 "실제로 무언가를 변경하느냐"가 아니라 "해당 DDL 문을 실행할 수 있느냐"를 기준으로 합니다. `IF NOT EXISTS`가 이 검사를 우회한다고 생각하기 쉽지만, 그렇지 않습니다.

교훈을 정리하면 이렇습니다. 첫째, idempotent 스크립트라도 DDL 실행 전에 애플리케이션 코드 레벨에서 존재 여부를 미리 확인하면 불필요한 권한 요구를 피할 수 있습니다. 둘째, `permission denied for database`는 테이블/스키마 레벨이 아닌 데이터베이스 레벨 `CREATE` 권한 문제이므로, 오류 메시지의 대상("for database" vs "for schema" vs "for table")을 잘 읽는 것이 중요합니다.

같은 함정을 밟으신 분들이 시간을 아끼셨으면 하는 마음으로 정리했습니다. 궁금한 점이나 더 나은 방법이 있으면 편하게 알려주세요.

---

## Excerpt

`CREATE SCHEMA IF NOT EXISTS`는 스키마가 이미 있어도 권한을 먼저 검사합니다. 존재 여부를 직접 조회해 회피한 과정을 정리했습니다.
