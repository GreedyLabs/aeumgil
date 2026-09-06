import assert from "node:assert/strict";
import { test } from "node:test";
import { nicknameUserProfile, updateNicknamePolicy } from "./update-nickname-policy.mjs";

const initial = () => ({
  attributes: [
    { name: "username", required: { roles: ["user"] }, validations: { length: { min: 3 } } },
    { name: "email", required: { roles: ["user"] }, permissions: { edit: ["admin", "user"] } },
    {
      name: "firstName",
      required: { roles: ["user"] },
      validations: { length: { max: 255 } },
      permissions: { view: ["admin", "user"], edit: ["admin", "user"] },
    },
    { name: "lastName", required: { roles: ["user"] } },
    { name: "department", permissions: { view: ["admin"] }, annotations: { inputType: "text" } },
  ],
  groups: [{ name: "other-info", displayHeader: "Other" }],
  unmanagedAttributePolicy: "ADMIN_VIEW",
});

test("이름·성은 선택사항/admin-only로 하고 다른 속성·그룹·원본은 보존한다", () => {
  const before = initial();
  const after = nicknameUserProfile(before);
  assert.deepEqual(before, initial());
  assert.deepEqual(after.attributes.slice(0, 2), before.attributes.slice(0, 2));
  assert.deepEqual(after.attributes[4], before.attributes[4]);
  assert.deepEqual(after.groups, before.groups);
  assert.equal(after.unmanagedAttributePolicy, before.unmanagedAttributePolicy);
  for (const name of ["firstName", "lastName"]) {
    const attribute = after.attributes.find((value) => value.name === name);
    assert.equal(attribute.required, undefined);
    assert.deepEqual(attribute.permissions, { view: ["admin"], edit: ["admin"] });
  }
  assert.equal(after.attributes.find((value) => value.name === "nickname").required, undefined);
  assert.deepEqual(nicknameUserProfile(after), after);
});

test("기존 nickname의 검증·표시는 보존하고 필수 조건만 없앤다", () => {
  const before = initial();
  before.attributes.push({
    name: "nickname",
    required: { roles: ["user"] },
    displayName: "My nickname",
    validations: { length: { max: 18 } },
  });
  const attribute = nicknameUserProfile(before).attributes.find(
    (value) => value.name === "nickname",
  );
  assert.equal(attribute.required, undefined);
  assert.equal(attribute.displayName, "My nickname");
  assert.equal(attribute.validations.length.max, 18);
});

test("username/email이 없거나 nickname이 다중 값이면 저장안을 생성하지 않는다", () => {
  assert.throws(() => nicknameUserProfile({ attributes: [] }), /username/);
  const before = initial();
  before.attributes.push({ name: "nickname", multivalued: true });
  assert.throws(() => nicknameUserProfile(before), /다중/);
});

test("기본 dry-run은 관리 API에 GET만 하며 토큰·전체 원문을 출력하지 않는다", async () => {
  const calls = [];
  const reports = [];
  const result = await updateNicknamePolicy({
    token: "private-test-token",
    report: (value) => reports.push(value),
    fetchImpl: async (_url, init) => {
      calls.push(init.method);
      return Response.json(initial());
    },
  });
  assert.deepEqual(calls, ["GET"]);
  assert.deepEqual(result, { changed: true, applied: false });
  assert.equal(JSON.stringify(reports).includes("private-test-token"), false);
  assert.equal(JSON.stringify(reports).includes("department"), false);
});

test("명시 apply는 동시 변경 확인 후 PUT하고 저장 결과를 다시 읽는다", async () => {
  const calls = [];
  let profile = initial();
  const result = await updateNicknamePolicy({
    token: "private-test-token",
    apply: true,
    report: () => {},
    fetchImpl: async (_url, init) => {
      calls.push(init.method);
      if (init.method === "PUT") {
        profile = JSON.parse(init.body);
        return new Response(null, { status: 204 });
      }
      return Response.json(profile);
    },
  });
  assert.deepEqual(calls, ["GET", "GET", "PUT", "GET"]);
  assert.deepEqual(result, { changed: true, applied: true });
});

test("실행 중 관리자가 변경한 정책을 덮어쓰지 않는다", async () => {
  const calls = [];
  await assert.rejects(
    updateNicknamePolicy({
      token: "private-test-token",
      apply: true,
      report: () => {},
      fetchImpl: async (_url, init) => {
        calls.push(init.method);
        const profile = initial();
        if (calls.length > 1) profile.attributes.push({ name: "new-field" });
        return Response.json(profile);
      },
    }),
    /변경되었습니다/,
  );
  assert.deepEqual(calls, ["GET", "GET"]);
});

test("readback 불일치·HTTP 오류는 적용 성공으로 보고하지 않는다", async () => {
  await assert.rejects(
    updateNicknamePolicy({
      token: "private-test-token",
      apply: true,
      report: () => {},
      fetchImpl: async (_url, init) =>
        init.method === "PUT" ? new Response(null, { status: 204 }) : Response.json(initial()),
    }),
    /계획과 다릅니다/,
  );
  await assert.rejects(
    updateNicknamePolicy({
      token: "private-test-token",
      report: () => {},
      fetchImpl: async () => new Response("private-response", { status: 403 }),
    }),
    /HTTP 403/,
  );
});

test("토큰의 잘못된 문자와 비 JSON 응답 원문은 오류 메시지에 노출하지 않는다", async () => {
  await assert.rejects(
    updateNicknamePolicy({
      token: "private\nsecret",
      fetchImpl: async () => {
        throw new Error("호출하면 안 됨");
      },
    }),
    (error) => !error.message.includes("secret") && /잘못된 문자/.test(error.message),
  );
  await assert.rejects(
    updateNicknamePolicy({
      token: "private-test-token",
      fetchImpl: async () => new Response("private-response"),
    }),
    (error) => !error.message.includes("private-response") && /JSON/.test(error.message),
  );
});
