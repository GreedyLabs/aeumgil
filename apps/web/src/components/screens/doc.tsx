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
      { h: "제2조 (서비스의 내용)", b: "서비스는 예상 혼잡도와 방문 여건을 바탕으로 한 관광지·테마·코스 추천, 대체지 제안, 저장 및 리뷰 기능을 제공합니다. 혼잡도·날씨·교통 정보는 외부 데이터를 가공한 참고 정보이며 정확성을 보증하지 않습니다." },
      { h: "제3조 (계정)", b: "이용자는 통합 로그인 계정을 통해 서비스를 이용할 수 있으며, 계정 정보의 관리 책임은 이용자 본인에게 있습니다." },
      { h: "제4조 (저작권)", b: "서비스 내 콘텐츠의 저작권은 회사 또는 정당한 권리자에게 있으며, 무단 복제·배포를 금합니다." },
    ],
  },
  privacy: {
    title_ko: "개인정보처리방침",
    title_en: "Privacy Policy",
    updated: "시행일 2026.07.11",
    sections: [
      { h: "수집하는 항목", b: "통합 로그인 시 인증 서버(Keycloak)가 이메일·이름·프로필 이미지를 수집·보관하며, 서비스는 세션 표시에만 사용하고 서비스 데이터베이스에는 저장하지 않습니다. 서비스 데이터베이스에는 사용자 식별자와 이용 기록(저장한 테마, 리뷰, 방문 기록, 온보딩 선호, 프로필 표시명·소개)만 보관합니다." },
      { h: "이용 목적", b: "맞춤형 관광 추천, 혼잡 분산 제안, 서비스 개선 및 통계 분석을 위해 사용됩니다. 마케팅 목적의 제3자 제공은 하지 않습니다." },
      { h: "보유 기간 및 파기", b: "회원 탈퇴 시 서비스 데이터베이스의 이용 기록은 즉시 삭제되고, 인증 계정 정보도 지체 없이 파기됩니다. 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안만 보관합니다." },
      { h: "탈퇴 방법", b: "설정 > 회원 탈퇴에서 직접 탈퇴할 수 있습니다. 탈퇴 시 저장·리뷰·방문 기록이 모두 삭제되며 복구할 수 없습니다." },
      { h: "제3자 제공", b: "이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거가 있는 경우는 예외로 합니다." },
      { h: "문의처", b: "개인정보 문의 채널은 서비스 정식 공개 전에 안내합니다." },
    ],
  },
  support: {
    title_ko: "고객센터",
    title_en: "Support",

    sections: [
      { h: "자주 묻는 질문", b: "혼잡도는 장소 특성·시간대·요일·계절을 반영한 추정치예요. 관광지와 코스 탐색은 로그인 없이 이용할 수 있고, 코스 저장·리뷰 작성은 로그인이 필요해요. 작성한 리뷰는 내 기록에서 수정·삭제할 수 있어요." },
      { h: "문의하기", b: "서비스 전용 문의 채널은 준비 중이에요. 관광지 연락처와 찾아가는 길은 각 장소 상세에서 확인해 주세요." },
      { h: "데이터 출처", b: "날씨는 기상청, 대기질은 에어코리아 자료를 사용해요. 시간대별 혼잡도는 자체 추정, 일별 집중률은 한국관광공사 예측이에요. 고속도로 소통은 한국도로공사 관측값으로 제공해요." },
    ],
  },
  sources: {
    title_ko: "데이터 출처",
    title_en: "Data Sources",
    updated: "원천과 사진별 이용 조건 안내",
    sections: [
      { h: "한국관광공사 TourAPI", b: "관광지·음식점·숙박·행사의 기본정보와 소개 문구, 대표 이미지는 한국관광공사 TourAPI(국문 관광정보 서비스)를 이용합니다. 사진별로 공공누리 유형이 다르므로 원천의 이용 조건을 따르며, 사진의 저작권은 한국관광공사 및 원저작자에게 있습니다." },
      { h: "관광공사 방문 예측·지역 통계", b: "일별 집중률은 관광공사가 제공하는 상대 방문 예측입니다. 현장 인원이나 수용률을 뜻하지 않습니다. 지역별 방문자수는 공개 표본일을 표시하고 외지인·외국인을 구분합니다. 기초지자체와 광역지자체 수치를 합산하지 않습니다." },
      { h: "기상청 생활기상지수", b: "자외선지수는 기상청 생활기상지수 V5의 3시간 간격 예측입니다. 높은 자외선은 야외 관광지의 방문 적합성 점수와 준비 안내에 반영합니다." },
      { h: "기상청 단기예보", b: "날씨 정보(기온·강수확률·바람)는 기상청 단기예보 조회서비스를 이용해 제공합니다. 예보 특성상 실제 기상 상황과 다를 수 있습니다." },
      { h: "한국환경공단 에어코리아", b: "대기질 등급은 한국환경공단 에어코리아 측정망 자료를 이용합니다. 실시간 자료는 측정소 현지 사정이나 자료 수신 상태에 따라 미수신되거나 추후 보정될 수 있는 참고 자료입니다." },
      { h: "지도", b: "위치 지도는 OpenStreetMap을 이용하며 © OpenStreetMap contributors의 지도 데이터를 표시합니다. 지도에서 선택한 장소의 실제 좌표를 확인할 수 있어요. 길찾기는 외부 지도 서비스로 연결합니다." },
      { h: "혼잡도·방문 적합성", b: "혼잡도와 방문 적합성 점수는 위 공공데이터를 에움길이 자체 모델로 가공·산출한 추정 정보이며, 현장 상황과 다를 수 있습니다." },
    ],
  },
  notice: {
    title_ko: "공지사항",
    title_en: "Notices",
    sections: [
      { h: "여행 조건에 맞춘 코스", b: "일정·페이스·동행·이동수단을 선택해 코스를 구성할 수 있어요. 자연어로 입력한 여행 조건도 코스에 반영해요." },
      { h: "예상 혼잡도 안내", b: "혼잡도는 실측 인원수가 아닌 모델 추정치예요. 날씨·대기질 자료를 받지 못하면 확인 중으로 표시해요." },
    ],
  },
};

export function DocView({ doc }: { doc?: string }) {
  const { lang } = useAppState();
  const { back } = useAppNav();
  const d = (doc && DOCS[doc]) || DOCS.terms!;
  const title = lang === "ko" ? d.title_ko : d.title_en;

  return (
    <div className="screen-enter reading-page">
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
