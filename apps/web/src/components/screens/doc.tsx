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
    updated: "시행일 2025.01.01",
    sections: [
      { h: "제1조 (목적)", b: '본 약관은 GreedyLabs(이하 "회사")가 제공하는 에움길 서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와 회사의 권리·의무를 규정함을 목적으로 합니다.' },
      { h: "제2조 (서비스의 내용)", b: "서비스는 실시간 혼잡도 정보를 바탕으로 한 관광지·테마·코스 추천, 대체지 제안, 저장 및 리뷰 기능을 제공합니다. 혼잡도·날씨·교통 정보는 외부 데이터를 가공한 참고 정보이며 정확성을 보증하지 않습니다." },
      { h: "제3조 (계정)", b: "이용자는 소셜 로그인(카카오·네이버·구글·애플)을 통해 계정을 생성할 수 있으며, 계정 정보의 관리 책임은 이용자 본인에게 있습니다." },
      { h: "제4조 (저작권)", b: "서비스 내 콘텐츠의 저작권은 회사 또는 정당한 권리자에게 있으며, 무단 복제·배포를 금합니다." },
    ],
  },
  privacy: {
    title_ko: "개인정보처리방침",
    title_en: "Privacy Policy",
    updated: "시행일 2025.01.01",
    sections: [
      { h: "수집하는 항목", b: "소셜 로그인 시 제공되는 프로필(닉네임, 프로필 이미지, 이메일)과 서비스 이용 기록(저장한 코스, 방문 기록, 리뷰, 관심 테마)을 수집합니다." },
      { h: "이용 목적", b: "맞춤형 관광 추천, 혼잡 분산 제안, 서비스 개선 및 통계 분석을 위해 사용됩니다." },
      { h: "보유 기간", b: "회원 탈퇴 시 지체 없이 파기하며, 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안 보관합니다." },
      { h: "제3자 제공", b: "이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거가 있는 경우는 예외로 합니다." },
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
  notice: {
    title_ko: "공지사항",
    title_en: "Notices",
    sections: [
      { h: "봄 성수기 혼잡 알림 기능 추가", b: "2025.04.10 · 벚꽃·축제 기간 동안 실시간 혼잡 알림과 대체지 제안 정확도를 개선했습니다." },
      { h: "소셜 로그인 지원 확대", b: "2025.03.02 · 카카오·네이버에 이어 구글·애플 로그인을 추가했습니다." },
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
