// @ts-nocheck

// ─────────────────────────────────────────────
// 강원도 관광 추천 — Mock Data
// ─────────────────────────────────────────────

// Theme catalog — 사전 설계된 강원도 특화 테마
const THEMES = [
  {
    id: 'quiet-inland',
    ko: '조용한 내륙 힐링',
    en: 'Quiet Inland Retreat',
    subtitle_ko: '평창·인제·정선 고요한 숲길',
    subtitle_en: 'Pyeongchang · Inje · Jeongseon',
    tag_ko: '힐링',
    region_ko: '평창 · 인제',
    hue: 155,
    duration: '1박 2일',
    pace: '여유롭게',
    spots: 5,
    mood_ko: ['한적함', '숲', '차분함', '사색'],
    mood_en: ['quiet', 'forest', 'calm'],
    blurb_ko: '사람이 붐비지 않는 내륙 산간의 길과 계곡, 수도원 같은 찻집에서 보내는 이틀.',
    blurb_en: 'Two unhurried days through quiet mountain trails, streams, and tea houses.',
  },
  {
    id: 'east-sea-sunrise',
    ko: '동해 일출·해변 드라이브',
    en: 'East Sea Sunrise Drive',
    subtitle_ko: '강릉 · 속초 · 양양 해안선',
    subtitle_en: 'Gangneung · Sokcho · Yangyang',
    tag_ko: '해변',
    region_ko: '강릉 · 속초',
    hue: 220,
    duration: '당일 · 1박',
    pace: '느긋한 드라이브',
    spots: 6,
    mood_ko: ['일출', '드라이브', '바다', '커피'],
    mood_en: ['sunrise', 'coast', 'drive'],
    blurb_ko: '7번 국도를 따라 흐르는 해안선, 항구 카페, 일출 포인트를 잇는 클래식 코스.',
    blurb_en: 'A coastal drive along Route 7, ports, cafes, and sunrise spots.',
  },
  {
    id: 'mountain-trek',
    ko: '설악·오대산 산악 트레킹',
    en: 'Seorak · Odaesan Trek',
    subtitle_ko: '국립공원 중심 코스',
    subtitle_en: 'National park-centric',
    tag_ko: '트레킹',
    region_ko: '속초 · 평창',
    hue: 140,
    duration: '1박 2일',
    pace: '도전적',
    spots: 4,
    mood_ko: ['산', '트레킹', '단풍', '체력'],
    mood_en: ['mountain', 'trek', 'autumn'],
    blurb_ko: '설악산 권금성·오대산 선재길·월정사를 차근차근 오르는 정통 산악 코스.',
    blurb_en: 'Seorak, Odaesan, and Woljeongsa along a steady ascent path.',
  },
  {
    id: 'market-local',
    ko: '전통시장·로컬 맛집 투어',
    en: 'Traditional Market Food Tour',
    subtitle_ko: '강릉 중앙·속초 관광수산시장',
    subtitle_en: 'Gangneung & Sokcho markets',
    tag_ko: '미식',
    region_ko: '강릉 · 속초',
    hue: 60,
    duration: '당일',
    pace: '걸으며',
    spots: 7,
    mood_ko: ['시장', '로컬', '미식', '골목'],
    mood_en: ['market', 'local', 'food'],
    blurb_ko: '대표 시장 대신 항구 시장과 골목 상권을 잇는, 실제 지역 상인들의 리스트.',
    blurb_en: 'Markets and alley shops curated from local vendors.',
  },
  {
    id: 'cafe-viewpoint',
    ko: '감성 카페·뷰포인트',
    en: 'Cafes & Viewpoints',
    subtitle_ko: '안목·주문진 · 산골 카페',
    subtitle_en: 'Coast & mountain cafes',
    tag_ko: '카페',
    region_ko: '강릉 · 양양',
    hue: 25,
    duration: '당일',
    pace: '사진 중심',
    spots: 6,
    mood_ko: ['카페', '뷰', '사진', '감성'],
    mood_en: ['cafe', 'view', 'photo'],
    blurb_ko: '바다·산·논밭을 그대로 바라보는 창이 있는 카페만 고른 루트.',
    blurb_en: 'Cafes framed by sea, mountain, or rice-field views.',
  },
  {
    id: 'family-experience',
    ko: '가족 체험형',
    en: 'Family Experience',
    subtitle_ko: '양떼목장 · 박물관 · 레일바이크',
    subtitle_en: 'Farms, museums, rail bikes',
    tag_ko: '가족',
    region_ko: '평창 · 정선',
    hue: 100,
    duration: '1박 2일',
    pace: '아이 중심',
    spots: 5,
    mood_ko: ['가족', '체험', '실내', '안전'],
    mood_en: ['family', 'hands-on'],
    blurb_ko: '짧은 이동과 실내·야외가 섞인, 아이와 함께 움직이기 좋은 코스.',
    blurb_en: 'Short transfers and indoor/outdoor mix for kids.',
  },
];

// 자연어 키워드 매칭 — 프로토타입용 간단 규칙
const KEYWORD_MATCH = [
  { keywords: ['조용', '한적', '고요', '혼자', '차분', 'quiet', 'calm', 'alone'], themeId: 'quiet-inland' },
  { keywords: ['내륙', '숲', '계곡', 'inland', 'forest'], themeId: 'quiet-inland' },
  { keywords: ['바다', '해변', '일출', '동해', '해안', 'sea', 'beach', 'sunrise', 'coast'], themeId: 'east-sea-sunrise' },
  { keywords: ['드라이브', 'drive'], themeId: 'east-sea-sunrise' },
  { keywords: ['산', '트레킹', '등산', '설악', '오대', 'mountain', 'trek', 'hike'], themeId: 'mountain-trek' },
  { keywords: ['시장', '맛집', '먹', '미식', '로컬', 'market', 'food', 'local'], themeId: 'market-local' },
  { keywords: ['카페', '뷰', '사진', '감성', 'cafe', 'view', 'photo'], themeId: 'cafe-viewpoint' },
  { keywords: ['가족', '아이', '체험', '양떼', 'family', 'kids', 'child'], themeId: 'family-experience' },
];

// 추천 예시 프롬프트
const SAMPLE_PROMPTS = [
  { ko: '오늘 조용하게 강원도 여행하고 싶어', en: 'A quiet trip around Gangwon today' },
  { ko: '바다 말고 내륙 쪽으로 한적하게', en: 'Inland, not the coast, and quiet' },
  { ko: '시장 구경하고 맛있는 거 먹고 싶어', en: 'Market walk and great local food' },
  { ko: '아이랑 1박 2일 실내 체험 위주로', en: 'One night with kids, mostly indoor' },
  { ko: '해안 드라이브, 일출 볼 수 있는 곳', en: 'Coastal drive with sunrise spots' },
];

// 강원도 관광지 / POI
const SPOTS = {
  'anmok-beach': {
    id: 'anmok-beach',
    name_ko: '안목해변', name_en: 'Anmok Beach',
    type_ko: '해변 · 카페거리', type_en: 'Beach · Cafe street',
    region_ko: '강릉', region_en: 'Gangneung',
    congestion: 'busy',
    suitability: 62,
    weather: { temp: 14, desc_ko: '맑음 · 바람 약함', desc_en: 'Clear · light wind', icon: 'sun' },
    air: '좋음',
    traffic_ko: '주말 오후 정체',
    duration_ko: '1시간 30분',
    rating: 4.6, reviews: 2103,
    tags_ko: ['커피', '바다', '인파 많음'],
    desc_ko: '강릉 커피거리로 유명한 해변. 주말 낮에는 대기줄이 긴 편이다.',
  },
  'sacheon-beach': {
    id: 'sacheon-beach',
    name_ko: '사천진해변', name_en: 'Sacheonjin Beach',
    type_ko: '한적한 해변', type_en: 'Quiet beach',
    region_ko: '강릉', region_en: 'Gangneung',
    congestion: 'calm',
    suitability: 88,
    weather: { temp: 13, desc_ko: '맑음', desc_en: 'Clear', icon: 'sun' },
    air: '좋음',
    traffic_ko: '원활',
    duration_ko: '1시간',
    rating: 4.4, reviews: 412,
    tags_ko: ['한적', '산책', '로컬'],
    desc_ko: '안목 북쪽, 서핑 스팟이 있는 작은 해변. 평일·오전엔 거의 비어 있다.',
  },
  'ojukheon': {
    id: 'ojukheon', name_ko: '오죽헌', name_en: 'Ojukheon',
    type_ko: '역사 명소', type_en: 'Heritage',
    region_ko: '강릉', region_en: 'Gangneung',
    congestion: 'moderate',
    suitability: 74,
    weather: { temp: 14, desc_ko: '맑음', desc_en: 'Clear', icon: 'sun' },
    air: '좋음',
    traffic_ko: '보통',
    duration_ko: '1시간',
    rating: 4.3, reviews: 932,
    tags_ko: ['역사', '실내외', '가족'],
  },
  'daegwallyeong-sheep': {
    id: 'daegwallyeong-sheep', name_ko: '대관령 양떼목장', name_en: 'Daegwallyeong Sheep Farm',
    type_ko: '목장 · 체험', type_en: 'Farm · Experience',
    region_ko: '평창', region_en: 'Pyeongchang',
    congestion: 'moderate',
    suitability: 81,
    weather: { temp: 9, desc_ko: '맑음 · 쌀쌀', desc_en: 'Clear · crisp', icon: 'sun' },
    air: '매우 좋음',
    traffic_ko: '원활',
    duration_ko: '1시간 30분',
    rating: 4.5, reviews: 1587,
    tags_ko: ['가족', '자연', '산책'],
  },
  'woljeongsa-trail': {
    id: 'woljeongsa-trail', name_ko: '월정사 선재길', name_en: 'Woljeongsa Seonjae Trail',
    type_ko: '숲길 · 트레킹', type_en: 'Forest trail',
    region_ko: '평창', region_en: 'Pyeongchang',
    congestion: 'calm',
    suitability: 92,
    weather: { temp: 10, desc_ko: '맑음', desc_en: 'Clear', icon: 'sun' },
    air: '매우 좋음',
    traffic_ko: '원활',
    duration_ko: '2시간',
    rating: 4.8, reviews: 678,
    tags_ko: ['숲', '한적', '명상'],
    desc_ko: '월정사에서 상원사까지 이어지는 평탄한 숲길. 계곡 물소리가 따라 걷는다.',
  },
  'seorak-gwongeum': {
    id: 'seorak-gwongeum', name_ko: '설악산 권금성', name_en: 'Seorak Gwongeumseong',
    type_ko: '케이블카 · 전망', type_en: 'Cable car · Viewpoint',
    region_ko: '속초', region_en: 'Sokcho',
    congestion: 'busy',
    suitability: 58,
    weather: { temp: 7, desc_ko: '맑음 · 바람 강함', desc_en: 'Clear · windy', icon: 'wind' },
    air: '좋음',
    traffic_ko: '주차 대기',
    duration_ko: '2시간',
    rating: 4.6, reviews: 3221,
    tags_ko: ['전망', '케이블카', '단풍철 붐빔'],
  },
  'sokcho-market': {
    id: 'sokcho-market', name_ko: '속초관광수산시장', name_en: 'Sokcho Tourist & Fishery Market',
    type_ko: '전통시장', type_en: 'Market',
    region_ko: '속초', region_en: 'Sokcho',
    congestion: 'busy',
    suitability: 66,
    weather: { temp: 13, desc_ko: '맑음', desc_en: 'Clear', icon: 'sun' },
    air: '좋음',
    traffic_ko: '인근 도로 혼잡',
    duration_ko: '1시간 30분',
    rating: 4.4, reviews: 4122,
    tags_ko: ['닭강정', '해산물', '붐빔'],
  },
  'dongmyeong-port': {
    id: 'dongmyeong-port', name_ko: '동명항 골목상권', name_en: 'Dongmyeong Port Alley',
    type_ko: '항구 · 골목상권', type_en: 'Port · Alley',
    region_ko: '속초', region_en: 'Sokcho',
    congestion: 'calm',
    suitability: 84,
    weather: { temp: 13, desc_ko: '맑음', desc_en: 'Clear', icon: 'sun' },
    air: '좋음',
    traffic_ko: '원활',
    duration_ko: '1시간',
    rating: 4.5, reviews: 512,
    tags_ko: ['항구', '로컬', '한적'],
    desc_ko: '속초관광수산시장 대신 추천하는 어촌 골목. 즉석 회와 생선구이집이 줄지어 있다.',
  },
  'jumunjin-cafe': {
    id: 'jumunjin-cafe', name_ko: '주문진 언덕카페', name_en: 'Jumunjin Hillside Cafe',
    type_ko: '카페 · 오션뷰', type_en: 'Cafe · Ocean view',
    region_ko: '강릉', region_en: 'Gangneung',
    congestion: 'moderate',
    suitability: 78,
    weather: { temp: 13, desc_ko: '맑음', desc_en: 'Clear', icon: 'sun' },
    air: '좋음',
    traffic_ko: '원활',
    duration_ko: '1시간',
    rating: 4.7, reviews: 1011,
    tags_ko: ['뷰', '사진'],
  },
};

// 음식점
const EATS = [
  { id: 'e1', name_ko: '동명항 방파제 회센터', name_en: 'Dongmyeong Sashimi', type_ko: '해산물 · 회', price: '₩₩', rating: 4.5, region_ko: '속초' },
  { id: 'e2', name_ko: '대관령 메밀칼국수', name_en: 'Daegwallyeong Buckwheat', type_ko: '국수 · 로컬', price: '₩', rating: 4.6, region_ko: '평창' },
  { id: 'e3', name_ko: '강릉 초당순두부', name_en: 'Chodang Soft Tofu', type_ko: '두부 · 로컬', price: '₩', rating: 4.4, region_ko: '강릉' },
  { id: 'e4', name_ko: '월정사 산채정식', name_en: 'Woljeongsa Mountain Veg', type_ko: '한정식', price: '₩₩', rating: 4.5, region_ko: '평창' },
];

// 숙박
const STAYS = [
  { id: 's1', name_ko: '오대산 산자락 한옥', name_en: 'Odaesan Hanok', type_ko: '한옥 스테이', price_ko: '₩190,000/박', rating: 4.8, region_ko: '평창' },
  { id: 's2', name_ko: '속초 해안 부티크', name_en: 'Sokcho Boutique', type_ko: '부티크 호텔', price_ko: '₩240,000/박', rating: 4.6, region_ko: '속초' },
  { id: 's3', name_ko: '평창 숲속 독채', name_en: 'Pyeongchang Forest Villa', type_ko: '독채 풀빌라', price_ko: '₩310,000/박', rating: 4.9, region_ko: '평창' },
];

// 코스 — 테마별 순서 있는 POI + 식사/숙박
const COURSES = {
  'quiet-inland': {
    themeId: 'quiet-inland',
    title_ko: '평창·오대산 2일 힐링 코스',
    title_en: 'Pyeongchang · Odaesan 2-day Retreat',
    day_count: 2,
    alt_note_ko: '혼잡한 설악 대신 내륙 숲길 중심',
    items: [
      { day: 1, time: '10:30', spot: 'woljeongsa-trail', stay: 120 },
      { day: 1, time: '12:40', eat: 'e4', stay: 60 },
      { day: 1, time: '14:30', spot: 'daegwallyeong-sheep', stay: 90 },
      { day: 1, time: '18:00', stay: 's1' },
      { day: 2, time: '09:00', spot: 'ojukheon', stay: 60 },
      { day: 2, time: '11:00', eat: 'e3' },
      { day: 2, time: '13:30', spot: 'jumunjin-cafe', stay: 75 },
    ],
  },
  'east-sea-sunrise': {
    themeId: 'east-sea-sunrise',
    title_ko: '동해안 일출·드라이브 1박 코스',
    title_en: 'East Coast Sunrise Drive',
    day_count: 2,
    alt_note_ko: '붐비는 안목 대신 사천진 중심',
    items: [
      { day: 1, time: '15:00', spot: 'sacheon-beach', stay: 60 },
      { day: 1, time: '17:00', spot: 'jumunjin-cafe', stay: 60 },
      { day: 1, time: '19:00', eat: 'e1' },
      { day: 1, time: '21:00', stay: 's2' },
      { day: 2, time: '05:30', spot: 'sacheon-beach', stay: 45 },
      { day: 2, time: '08:00', spot: 'dongmyeong-port', stay: 90 },
      { day: 2, time: '12:00', spot: 'sokcho-market', stay: 60 },
    ],
  },
  'market-local': {
    themeId: 'market-local',
    title_ko: '속초 항구 골목상권 하루 코스',
    title_en: 'Sokcho Port Alley Day Course',
    day_count: 1,
    alt_note_ko: '대형 시장 대신 항구·골목 중심',
    items: [
      { day: 1, time: '10:00', spot: 'dongmyeong-port', stay: 90 },
      { day: 1, time: '12:30', eat: 'e1' },
      { day: 1, time: '14:30', spot: 'sokcho-market', stay: 45 },
      { day: 1, time: '16:00', spot: 'jumunjin-cafe', stay: 60 },
    ],
  },
  'mountain-trek': {
    themeId: 'mountain-trek',
    title_ko: '설악·오대산 정통 트레킹 1박',
    title_en: 'Seorak & Odaesan Trek',
    day_count: 2,
    alt_note_ko: '혼잡도에 따라 일정 순서 조정',
    items: [
      { day: 1, time: '09:00', spot: 'seorak-gwongeum', stay: 150 },
      { day: 1, time: '13:00', eat: 'e1' },
      { day: 1, time: '17:00', stay: 's1' },
      { day: 2, time: '08:30', spot: 'woljeongsa-trail', stay: 180 },
      { day: 2, time: '13:30', eat: 'e4' },
    ],
  },
  'cafe-viewpoint': {
    themeId: 'cafe-viewpoint',
    title_ko: '동해 뷰포인트 카페 하루',
    title_en: 'Coastal Viewpoint Cafes',
    day_count: 1,
    alt_note_ko: '한적한 오전 시간 기준',
    items: [
      { day: 1, time: '10:00', spot: 'jumunjin-cafe', stay: 60 },
      { day: 1, time: '12:00', eat: 'e3' },
      { day: 1, time: '14:00', spot: 'sacheon-beach', stay: 45 },
      { day: 1, time: '16:00', spot: 'anmok-beach', stay: 60 },
    ],
  },
  'family-experience': {
    themeId: 'family-experience',
    title_ko: '평창 가족 체험 1박',
    title_en: 'Pyeongchang Family Stay',
    day_count: 2,
    alt_note_ko: '이동거리 짧고 실내 옵션 포함',
    items: [
      { day: 1, time: '10:30', spot: 'daegwallyeong-sheep', stay: 120 },
      { day: 1, time: '13:00', eat: 'e2' },
      { day: 1, time: '15:30', spot: 'ojukheon', stay: 75 },
      { day: 1, time: '18:00', stay: 's3' },
      { day: 2, time: '09:30', spot: 'woljeongsa-trail', stay: 120 },
    ],
  },
};

// 대체지 매핑 (혼잡 분산)
const ALT_SPOTS = {
  'anmok-beach': ['sacheon-beach', 'jumunjin-cafe'],
  'sokcho-market': ['dongmyeong-port'],
  'seorak-gwongeum': ['woljeongsa-trail'],
};

// ─────────────────────────────────────────────
// 사용자 / 회원
// ─────────────────────────────────────────────
const USER = {
  name_ko: '유진', name_en: 'Yujin',
  handle: '@yujin_gw',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&q=70&auto=format&fit=crop',
  provider: 'kakao',
  email: 'yujin****@kakao.com',
  bio_ko: '붐비지 않는 강원도를 찾아다녀요. 숲길과 항구 골목 좋아함.',
  bio_en: 'Chasing the quiet side of Gangwon.',
  joined_ko: '2024.03 가입',
  joined_en: 'Joined Mar 2024',
  // 등급: 방문·리뷰 누적 기반
  level: 3,
  grade_ko: '강원 탐험가', grade_en: 'Gangwon Explorer',
  nextGrade_ko: '강원 마스터', nextGrade_en: 'Gangwon Master',
  levelProgress: 64, // %
  interests: ['quiet-inland', 'east-sea-sunrise', 'cafe-viewpoint'],
  stats: { visits: 8, saved: 5, regions: 4, reviews: 6 },
};

// 회원 등급 단계
const GRADES = [
  { lv: 1, ko: '강원 입문자', en: 'Newcomer', min: 0 },
  { lv: 2, ko: '강원 여행자', en: 'Traveler', min: 3 },
  { lv: 3, ko: '강원 탐험가', en: 'Explorer', min: 6 },
  { lv: 4, ko: '강원 마스터', en: 'Master', min: 12 },
];

// 내 리뷰
const REVIEWS = [
  { id: 'r1', spotId: 'woljeongsa-trail', rating: 5, date: '2025.04.18', text_ko: '평일 오전이라 거의 전세 낸 듯 조용했어요. 계곡 물소리 들으며 천천히 걷기 좋습니다.', helpful: 12 },
  { id: 'r2', spotId: 'dongmyeong-port', rating: 5, date: '2025.04.05', text_ko: '관광시장 대신 여기로 온 거 정말 잘한 선택. 회도 신선하고 사람도 적당했어요.', helpful: 8 },
  { id: 'r3', spotId: 'sacheon-beach', rating: 4, date: '2025.03.22', text_ko: '안목보다 한적해서 좋았는데 주차가 조금 애매했어요. 그래도 일출은 최고.', helpful: 5 },
  { id: 'r4', spotId: 'jumunjin-cafe', rating: 4, date: '2025.03.10', text_ko: '오션뷰 자리 경쟁이 있긴 한데 오전엔 여유로웠습니다.', helpful: 3 },
  { id: 'r5', spotId: 'daegwallyeong-sheep', rating: 5, date: '2025.02.14', text_ko: '아이랑 가기 정말 좋아요. 바람은 세니 옷 단단히.', helpful: 9 },
  { id: 'r6', spotId: 'sokcho-market', rating: 3, date: '2025.01.28', text_ko: '닭강정은 맛있지만 주말은 너무 붐벼서 다음엔 평일에.', helpful: 2 },
];

// 방문 기록 (다녀온 순)
const VISITS = [
  { spotId: 'woljeongsa-trail', date: '2025.04.18', congestionThen: 'calm' },
  { spotId: 'dongmyeong-port', date: '2025.04.05', congestionThen: 'calm' },
  { spotId: 'sacheon-beach', date: '2025.03.22', congestionThen: 'moderate' },
  { spotId: 'jumunjin-cafe', date: '2025.03.10', congestionThen: 'moderate' },
  { spotId: 'daegwallyeong-sheep', date: '2025.02.14', congestionThen: 'calm' },
  { spotId: 'sokcho-market', date: '2025.01.28', congestionThen: 'busy' },
  { spotId: 'ojukheon', date: '2024.11.30', congestionThen: 'moderate' },
  { spotId: 'anmok-beach', date: '2024.10.12', congestionThen: 'busy' },
];

// 온보딩 — 여행 페이스 / 동행
const PACES = [
  { id: 'calm', ko: '여유롭게', en: 'Relaxed', desc_ko: '한적한 곳 위주' },
  { id: 'balanced', ko: '적당히', en: 'Balanced', desc_ko: '인기·한적 반반' },
  { id: 'active', ko: '활발하게', en: 'Active', desc_ko: '많이 보고 걷기' },
];
const COMPANIONS = [
  { id: 'solo', ko: '혼자', en: 'Solo' },
  { id: 'couple', ko: '연인', en: 'Couple' },
  { id: 'family', ko: '가족', en: 'Family' },
  { id: 'friends', ko: '친구', en: 'Friends' },
];

// 소셜 로그인 제공자
const PROVIDERS = [
  { id: 'keycloak', label_ko: '통합 계정으로 시작하기', label_en: 'Continue with Eumgil SSO', bg: '#FFFFFF', fg: '#1F1F1F', border: '#E2E2E2' },
];

export const DATA = {
  THEMES, KEYWORD_MATCH, SAMPLE_PROMPTS,
  SPOTS, EATS, STAYS, COURSES, ALT_SPOTS,
  USER, GRADES, REVIEWS, VISITS, PACES, COMPANIONS, PROVIDERS,
};
