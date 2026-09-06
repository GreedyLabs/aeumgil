import type { Lang } from "./i18n";
const languages: Lang[] = ["ko", "en", "zh-CN", "zh-TW", "ja", "de", "fr"];
export function placeCount(count: number, lang: Lang): string {
  return [
    `${count}개 장소`,
    `${count} ${count === 1 ? "place" : "places"}`,
    `${count}个地点`,
    `${count}個地點`,
    `${count}か所`,
    `${count} ${count === 1 ? "Ort" : "Orte"}`,
    `${count} ${count === 1 ? "lieu" : "lieux"}`,
  ][languages.indexOf(lang)]!;
}
export function listProgress(
  visible: number,
  total: number,
  kind: "places" | "themes",
  lang: Lang,
): string {
  if (kind === "themes")
    return [
      `${total}개 중 ${visible}개 코스를 보고 있어요`,
      `Showing ${visible} of ${total} trips`,
      `显示${total}条路线中的${visible}条`,
      `顯示${total}條路線中的${visible}條`,
      `${total}件中${visible}コースを表示`,
      `${visible} von ${total} Reisen angezeigt`,
      `${visible} circuits sur ${total} affichés`,
    ][languages.indexOf(lang)]!;
  return [
    `${total}곳 중 ${visible}곳을 보고 있어요.`,
    `Showing ${visible} of ${total} places`,
    `显示${total}个地点中的${visible}个`,
    `顯示${total}個地點中的${visible}個`,
    `${total}件中${visible}か所を表示`,
    `${visible} von ${total} Orten angezeigt`,
    `${visible} lieux sur ${total} affichés`,
  ][languages.indexOf(lang)]!;
}
