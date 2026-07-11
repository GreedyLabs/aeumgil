"use client";

// DocView — 약관/개인정보/고객센터/공지. 정적 콘텐츠(앱 문서). 데이터 API 대상 아님.
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { Icon } from "./_ui";

interface DocSection {
  h: string;
  b: string;
}
interface Doc {
  title_ko: string;
  title_en: string;
  updated?: string;
  sections: DocSection[];
}

const DOCS: Record<string, Doc> = {
  terms: {
    title_ko: "이용약관",
    title_en: "Terms of Service",
    updated: "시행일 2026.07.11",
    sections: [
      { h: "제1조 (목적)", b: '본 약관은 GreedyLabs(이하 "회사")가 제공하는 에움길 서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와 회사의 권리·의무를 규정함을 목적으로 합니다.' },
      { h: "제2조 (서비스의 내용)", b: "서비스는 실시간 혼잡도 정보를 바탕으로 한 관광지·테마·코스 추천, 대체지 제안, 저장 및 리뷰 기능을 제공합니다. 혼잡도·날씨·교통 정보는 외부 데이터를 가공한 참고 정보이며 정확성을 보증하지 않습니다." },
      { h: "제3조 (계정)", b: "이용자는 통합 로그인 계정을 통해 서비스를 이용할 수 있으며, 계정 정보의 관리 책임은 이용자 본인에게 있습니다." },
      { h: "제4조 (저작권)", b: "서비스 내 콘텐츠의 저작권은 회사 또는 정당한 권리자에게 있으며, 무단 복제·배포를 금합니다." },
    ],
  },
  privacy: {
    title_ko: "개인정보처리방침",
    title_en: "Privacy Policy",
    updated: "시행일 2026.07.11",
    sections: [
      { h: "수집하는 항목", b: "통합 로그인(카카오·네이버·구글 연동) 시 인증 서버(Keycloak)가 이메일·이름·프로필 이미지를 수집·보관하며, 서비스는 세션 표시에만 사용하고 서비스 데이터베이스에는 저장하지 않습니다. 서비스 데이터베이스에는 사용자 식별자와 이용 기록(저장한 테마, 리뷰, 방문 기록, 온보딩 선호, 프로필 표시명·소개)만 보관합니다." },
      { h: "이용 목적", b: "맞춤형 관광 추천, 혼잡 분산 제안, 서비스 개선 및 통계 분석을 위해 사용됩니다. 마케팅 목적의 제3자 제공은 하지 않습니다." },
      { h: "보유 기간 및 파기", b: "회원 탈퇴 시 서비스 데이터베이스의 이용 기록은 즉시 삭제되고, 인증 계정 정보도 지체 없이 파기됩니다. 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안만 보관합니다." },
      { h: "탈퇴 방법", b: "설정 > 회원 탈퇴에서 직접 탈퇴할 수 있습니다. 탈퇴 시 저장·리뷰·방문 기록이 모두 삭제되며 복구할 수 없습니다." },
      { h: "제3자 제공", b: "이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거가 있는 경우는 예외로 합니다." },
      { h: "문의처", b: "개인정보 관련 문의는 고객센터(help@gangwon-trip.kr)로 연락해 주세요." },
    ],
  },
  support: {
    title_ko: "고객센터",
    title_en: "Support",
    updated: "평일 09:00–18:00",
    sections: [
      { h: "자주 묻는 질문", b: "혼잡도 정보는 어떻게 계산되나요? · 저장한 코스를 어떻게 공유하나요? · 로그인 없이도 이용할 수 있나요? · 리뷰는 어떻게 수정하나요?" },
      { h: "문의하기", b: "이메일 help@gangwon-trip.kr · 대표전화 1330 (관광통역안내). 앱 내 문의는 평일 영업일 기준 24시간 이내 답변드립니다." },
      { h: "데이터 출처", b: "혼잡도·교통·날씨 정보는 공공데이터포털 API를 가공하여 제공합니다." },
    ],
  },
  sources: {
    title_ko: "데이터 출처",
    title_en: "Data Sources",
    updated: "공공누리 제1유형(출처표시)",
    sections: [
      { h: "한국관광공사 TourAPI", b: "관광지·음식점·숙박의 기본정보와 소개 문구, 대표 이미지는 한국관광공사 TourAPI(국문 관광정보 서비스)를 이용합니다. 해당 콘텐츠는 공공누리 제1유형(출처표시) 조건으로 활용하며, 사진의 저작권은 한국관광공사 및 원저작자에게 있습니다." },
      { h: "기상청 단기예보", b: "날씨 정보(기온·강수확률·바람)는 기상청 단기예보 조회서비스를 이용해 제공합니다. 예보 특성상 실제 기상 상황과 다를 수 있습니다." },
      { h: "한국환경공단 에어코리아", b: "대기질 등급은 한국환경공단 에어코리아 측정망 자료를 이용합니다. 실시간 자료는 측정소 현지 사정이나 자료 수신 상태에 따라 미수신되거나 추후 보정될 수 있는 참고 자료입니다." },
      { h: "혼잡도·방문 적합성", b: "혼잡도와 방문 적합성 점수는 위 공공데이터를 에움길이 자체 모델로 가공·산출한 추정 정보이며, 현장 상황과 다를 수 있습니다." },
    ],
  },
  notice: {
    title_ko: "공지사항",
    title_en: "Notices",
    sections: [
      { h: "봄 성수기 혼잡 알림 기능 추가", b: "2025.04.10 · 벚꽃·축제 기간 동안 실시간 혼잡 알림과 대체지 제안 정확도를 개선했습니다." },
      { h: "통합 로그인 전환", b: "2025.03.02 · 여러 서비스를 하나의 계정으로 이용할 수 있도록 통합 로그인 구조를 준비했습니다." },
      { h: "리뷰·방문 기록 기능 오픈", b: "2025.02.15 · 다녀온 장소를 기록하고 리뷰를 남길 수 있습니다." },
    ],
  },
};

export function DocView({ doc }: { doc?: string }) {
  const { lang } = useAppState();
  const { back } = useAppNav();
  const d = (doc && DOCS[doc]) || DOCS.terms!;
  const title = lang === "ko" ? d.title_ko : d.title_en;

  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={back}>
          <Icon.back />
        </button>
        <h1>{title}</h1>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ padding: "10px 22px 32px" }}>
        <h2 className="serif" style={{ fontSize: 26, margin: "4px 0 2px" }}>
          {title}
        </h2>
        {d.updated && (
          <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 18 }} className="mono">
            {d.updated}
          </div>
        )}
        <div style={{ display: "grid", gap: 20, marginTop: 8 }}>
          {d.sections.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>{s.h}</div>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, margin: 0 }}>{s.b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
