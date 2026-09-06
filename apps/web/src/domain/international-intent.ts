/** 번역 모델 없이 사전에 있는 여행 단어만 정본 키워드로 바꾼다. 원문은 화면에 보존한다. */
const aliases: Record<string, string[]> = {
  바다: [
    "海边",
    "海邊",
    "海滩",
    "海灘",
    "海岸",
    "海辺",
    "ビーチ",
    "海水浴",
    "strand",
    "strände",
    "meer",
    "küste",
    "plage",
    "plages",
    "mer",
    "littoral",
  ],
  일출: ["日出", "日の出", "sonnenaufgang", "lever du soleil"],
  산: [
    "登山",
    "山岳",
    "ハイキング",
    "トレッキング",
    "徒步",
    "健行",
    "wandern",
    "wanderung",
    "berge",
    "berg",
    "randonnée",
    "randonnées",
    "montagne",
  ],
  숲: ["森林", "树林", "樹林", "森", "wald", "wälder", "forêt", "forêts"],
  박물관: ["博物馆", "博物館", "ミュージアム", "museum", "museen", "musée", "musées"],
  역사: ["历史", "歷史", "歴史", "geschichte", "historisch", "histoire", "historique"],
  시장: ["市场", "市場", "markt", "märkte", "marché", "marchés"],
  맛집: [
    "美食",
    "餐厅",
    "餐廳",
    "グルメ",
    "レストラン",
    "essen",
    "gastronomie",
    "restaurant",
    "restaurants",
  ],
  카페: ["咖啡", "カフェ", "café", "cafés", "kaffee"],
  사진: ["摄影", "攝影", "拍照", "写真", "foto", "fotos", "fotografie", "photo", "photos"],
  가족: [
    "家庭",
    "家族",
    "父母",
    "両親",
    "eltern",
    "亲子",
    "親子",
    "子供",
    "子ども",
    "famille",
    "enfants",
    "familie",
    "kindern",
    "kinder",
    "family",
    "parents",
    "children",
  ],
  혼자: ["独自", "獨自", "一人", "ひとり", "allein", "solo"],
  커플: ["情侣", "情侶", "カップル", "couple", "paar", "zu zweit"],
  한적한: [
    "安静",
    "安靜",
    "清静",
    "清靜",
    "静かな",
    "静か",
    "ruhig",
    "ruhige",
    "ruhigen",
    "calme",
    "tranquille",
  ],
  천천히: ["慢慢", "ゆっくり", "gemütlich", "entspannt", "lentement", "tranquillement", "relaxed"],
  비: [
    "下雨",
    "雨天",
    "雨の日",
    "regen",
    "regnerisch",
    "regenwetter",
    "pluie",
    "pluvieux",
    "rainy",
  ],
  실내: ["室内", "室內", "屋内", "drinnen", "intérieur", "indoor"],
  대중교통: [
    "公共交通",
    "公交",
    "バス",
    "öffentliche verkehrsmittel",
    "öffentlichen verkehrsmitteln",
    "bus",
    "transports en commun",
    "public transport",
    "transit",
  ],
  자동차: ["自驾", "自駕", "レンタカー", "ドライブ", "auto", "voiture", "car", "driving"],
  도보: ["步行", "徒歩", "zu fuß", "à pied", "walking"],
  휠체어: ["轮椅", "輪椅", "車椅子", "rollstuhl", "fauteuil roulant", "wheelchair"],
};
const regionAliases: Record<string, string[]> = {
  춘천: ["春川"],
  원주: ["原州"],
  강릉: ["江陵"],
  동해: ["東海", "东海"],
  태백: ["太白"],
  속초: ["束草"],
  삼척: ["三陟"],
  홍천: ["洪川"],
  횡성: ["橫城", "横城"],
  영월: ["寧越", "宁越"],
  평창: ["平昌"],
  정선: ["旌善"],
  철원: ["鐵原", "铁原"],
  화천: ["華川", "华川"],
  양구: ["楊口", "杨口"],
  인제: ["麟蹄"],
  고성: ["高城"],
  양양: ["襄陽", "襄阳"],
};
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rules = Object.entries({ ...aliases, ...regionAliases })
  .flatMap(([word, values]) => values.map((alias) => ({ word, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);
const byAlias = new Map(rules.map(({ alias, word }) => [alias, word]));
const pattern = new RegExp(
  rules
    .map(({ alias }) =>
      /[a-zà-ž]/i.test(alias)
        ? `(?<![\\p{L}\\p{N}])${escaped(alias)}(?![\\p{L}\\p{N}])`
        : escaped(alias),
    )
    .join("|"),
  "giu",
);

export function internationalIntentQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/(?:不要|不想去|不去|不想|避开|避開|ohne|sans|pas de|pas d['’])\s*/giu, "avoid ")
    .replace(pattern, (value) => ` ${byAlias.get(value.toLowerCase()) ?? value} `)
    .replace(/(?:には行きたくない|に行きたくない|は避けたい|以外)/gu, " 말고 ")
    .replace(
      /(?<!\d)([1-5])\s*(?:days?|天|日間|日|tage?n?|jours?)(?![\p{L}\p{N}])/giu,
      (match, days: string, offset: number, source: string) =>
        /[月월./-]\s*$/.test(source.slice(0, offset)) ? match : `${days}일`,
    )
    .replace(/[\s]+/g, " ")
    .trim();
}
