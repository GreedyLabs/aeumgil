"use client";

import Image from "next/image";
import { useState } from "react";
import { ExternalLink } from "./external-link";
import type { SpotTourismMedia, TourismMediaLanguage } from "@/domain/tourism-media";
import styles from "./tourism-media.module.css";

const LANGUAGE_NAMES: Record<TourismMediaLanguage, string> = {
  ko: "한국어",
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  de: "Deutsch",
  fr: "Français",
};
const MESSAGES = {
  ko: {
    photos: "사진으로 보는 이곳",
    stories: "오디로 만나는 장소 이야기",
    intro: "한국관광공사의 사진과 해설로 여행지를 조금 더 알아보세요.",
    photoEmpty: "이 장소로 확인된 추가 관광사진이 아직 없어요.",
    photoUnavailable: "추가 관광사진을 지금 확인할 수 없어요.",
    audioEmpty: "이 장소에서 선택한 언어로 제공되는 이야기를 찾지 못했어요.",
    audioUnavailable: "관광 해설 자료를 지금 확인할 수 없어요.",
    unsupported: "오디에서 선택한 언어의 해설은 아직 제공하지 않아요.",
    read: "해설 대본 읽기",
    noAudio: "음성 파일이 제공되지 않아 대본으로 안내해요.",
    audioError: "음성 파일을 재생할 수 없어요. 대본이나 공식 오디를 확인해 주세요.",
    odii: "공식 오디에서 보기",
    photoSource: "포토코리아",
    author: "촬영",
    unknownAuthor: "촬영자 정보 미제공",
    license: "공공누리 제1유형 · 출처표시",
    original: "원본 사진 보기",
    source: "한국관광공사 제공",
    originalText: "자료의 원래 언어로 표시됩니다.",
  },
  en: {
    photos: "A closer look in photos",
    stories: "Stories from Odii",
    intro: "Explore this place through photos and commentary from the Korea Tourism Organization.",
    photoEmpty: "No additional tourism photos could be matched to this place.",
    photoUnavailable: "Additional tourism photos are temporarily unavailable.",
    audioEmpty: "No matching stories were found in your selected language.",
    audioUnavailable: "Tour commentary is temporarily unavailable.",
    unsupported: "Odii does not yet offer commentary in your selected language.",
    read: "Read transcript",
    noAudio: "An audio file is not provided. You can read the transcript.",
    audioError: "The audio could not be played. Read the transcript or visit Odii.",
    odii: "Visit official Odii",
    photoSource: "Photo Korea",
    author: "Photo",
    unknownAuthor: "Photographer not provided",
    license: "KOGL Type 1 · attribution",
    original: "View original photo",
    source: "Korea Tourism Organization",
    originalText: "Source content is shown in its original language.",
  },
  "zh-CN": {
    photos: "通过照片了解这里",
    stories: "Odii景点故事",
    intro: "通过韩国旅游发展局的照片和讲解，进一步了解景点。",
    photoEmpty: "尚未找到与此景点准确匹配的更多照片。",
    photoUnavailable: "暂时无法获取更多旅游照片。",
    audioEmpty: "尚未找到所选语言的景点故事。",
    audioUnavailable: "暂时无法获取景点讲解。",
    unsupported: "Odii尚未提供所选语言的讲解。",
    read: "阅读讲解文本",
    noAudio: "未提供音频文件，可阅读讲解文本。",
    audioError: "无法播放音频，请阅读文本或访问Odii官网。",
    odii: "访问Odii官网",
    photoSource: "Photo Korea",
    author: "摄影",
    unknownAuthor: "未提供摄影者",
    license: "KOGL第1类型 · 注明来源",
    original: "查看原图",
    source: "韩国旅游发展局提供",
    originalText: "资料以原文语言显示。",
  },
  "zh-TW": {
    photos: "透過照片了解這裡",
    stories: "Odii景點故事",
    intro: "透過韓國觀光公社的照片與導覽，進一步了解景點。",
    photoEmpty: "尚未找到與此景點準確配對的更多照片。",
    photoUnavailable: "暫時無法取得更多觀光照片。",
    audioEmpty: "尚未找到所選語言的景點故事。",
    audioUnavailable: "暫時無法取得景點導覽。",
    unsupported: "Odii尚未提供所選語言的導覽。",
    read: "閱讀導覽文字",
    noAudio: "未提供音訊檔案，可閱讀導覽文字。",
    audioError: "無法播放音訊，請閱讀文字或造訪Odii官網。",
    odii: "造訪Odii官網",
    photoSource: "Photo Korea",
    author: "攝影",
    unknownAuthor: "未提供攝影者",
    license: "KOGL第1類型 · 註明出處",
    original: "查看原圖",
    source: "韓國觀光公社提供",
    originalText: "資料以原文語言顯示。",
  },
  ja: {
    photos: "写真で見るこの場所",
    stories: "Odiiの観光ストーリー",
    intro: "韓国観光公社の写真と解説で、旅先をもっと知りましょう。",
    photoEmpty: "この場所と一致する追加写真はまだありません。",
    photoUnavailable: "追加の観光写真を現在取得できません。",
    audioEmpty: "選択した言語の観光ストーリーは見つかりませんでした。",
    audioUnavailable: "観光解説を現在取得できません。",
    unsupported: "Odiiでは、選択した言語の解説はまだ提供されていません。",
    read: "解説文を読む",
    noAudio: "音声ファイルが提供されていないため、解説文をご覧ください。",
    audioError: "音声を再生できません。解説文またはOdii公式サイトをご覧ください。",
    odii: "Odii公式サイトを見る",
    photoSource: "Photo Korea",
    author: "撮影",
    unknownAuthor: "撮影者情報なし",
    license: "KOGL第1類型・出典表示",
    original: "元の写真を見る",
    source: "韓国観光公社提供",
    originalText: "資料は原文の言語で表示されます。",
  },
  de: {
    photos: "Diesen Ort in Bildern entdecken",
    stories: "Geschichten von Odii",
    intro:
      "Fotos und Erläuterungen der Korea Tourism Organization helfen Ihnen, diesen Ort kennenzulernen.",
    photoEmpty: "Keine weiteren Fotos konnten diesem Ort eindeutig zugeordnet werden.",
    photoUnavailable: "Weitere Tourismusfotos sind derzeit nicht verfügbar.",
    audioEmpty: "Keine passende Geschichte in Ihrer gewählten Sprache gefunden.",
    audioUnavailable: "Die Erläuterungen sind derzeit nicht verfügbar.",
    unsupported: "Odii bietet noch keine Erläuterungen in Ihrer gewählten Sprache.",
    read: "Transkript lesen",
    noAudio: "Es wird keine Audiodatei bereitgestellt. Sie können das Transkript lesen.",
    audioError:
      "Die Audiodatei konnte nicht abgespielt werden. Lesen Sie das Transkript oder besuchen Sie Odii.",
    odii: "Offizielles Odii besuchen",
    photoSource: "Photo Korea",
    author: "Foto",
    unknownAuthor: "Fotograf nicht angegeben",
    license: "KOGL Typ 1 · Namensnennung",
    original: "Originalfoto ansehen",
    source: "Korea Tourism Organization",
    originalText: "Die Inhalte werden in ihrer Originalsprache angezeigt.",
  },
  fr: {
    photos: "Ce lieu en images",
    stories: "Les récits d’Odii",
    intro:
      "Découvrez ce lieu grâce aux photos et aux commentaires de la Korea Tourism Organization.",
    photoEmpty: "Aucune photo supplémentaire n’a pu être associée avec certitude à ce lieu.",
    photoUnavailable: "Les photos supplémentaires sont temporairement indisponibles.",
    audioEmpty: "Aucun récit correspondant dans la langue sélectionnée.",
    audioUnavailable: "Les commentaires touristiques sont temporairement indisponibles.",
    unsupported: "Odii ne propose pas encore de commentaires dans la langue sélectionnée.",
    read: "Lire la transcription",
    noAudio: "Aucun fichier audio n’est fourni. Vous pouvez lire la transcription.",
    audioError: "La lecture audio a échoué. Consultez la transcription ou le site Odii.",
    odii: "Visiter le site officiel Odii",
    photoSource: "Photo Korea",
    author: "Photo",
    unknownAuthor: "Photographe non indiqué",
    license: "KOGL type 1 · attribution",
    original: "Voir la photo originale",
    source: "Korea Tourism Organization",
    originalText: "Les contenus sont affichés dans leur langue d’origine.",
  },
} satisfies Record<TourismMediaLanguage, Record<string, string>>;

export function TourismMedia({
  media,
  lang,
}: {
  media: SpotTourismMedia;
  lang: TourismMediaLanguage;
}) {
  const t = MESSAGES[lang];
  const [failedAudio, setFailedAudio] = useState<Set<string>>(() => new Set());
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(() => new Set());
  return (
    <section className={styles.media} aria-label={t.stories} data-testid="tourism-media">
      <p className={styles.intro}>{t.intro}</p>
      <section className={styles.section} aria-label={t.photos}>
        <div className={styles.heading}>
          <h2>{t.photos}</h2>
          <ExternalLink className="text-link" href="https://phoko.visitkorea.or.kr/" lang={lang}>
            {t.photoSource}
          </ExternalLink>
        </div>
        {media.photos.items.length ? (
          <>
            <div className={styles.photos}>
              {media.photos.items.map((photo) => (
                <figure className={styles.photo} key={photo.id}>
                  {failedPhotos.has(photo.id) ? (
                    <p className={styles.empty}>{t.photoUnavailable}</p>
                  ) : (
                    <ExternalLink
                      href={photo.imageUrl}
                      lang={lang}
                      className={styles.photoLink}
                      aria-label={`${t.original}: ${photo.title}`}
                      indicatorPlacement="within"
                    >
                      <Image
                        src={photo.imageUrl}
                        alt={photo.title}
                        width={800}
                        height={600}
                        sizes="(max-width: 700px) 90vw, 40vw"
                        unoptimized={photo.imageUrl.startsWith("https:")}
                        onError={() =>
                          setFailedPhotos((previous) => new Set([...previous, photo.id]))
                        }
                      />
                      <span>{t.original} ↗</span>
                    </ExternalLink>
                  )}
                  <figcaption>
                    <strong lang="ko">{photo.title}</strong>
                    <span lang="ko">
                      {photo.location}
                      {photo.photographedMonth ? ` · ${photo.photographedMonth}` : ""}
                    </span>
                    <span>
                      {photo.photographer ? `${t.author}: ${photo.photographer}` : t.unknownAuthor}
                    </span>
                    <span>
                      {t.source} ·{" "}
                      <ExternalLink href={photo.license.url} lang={lang}>
                        {t.license}
                      </ExternalLink>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className={styles.note}>{t.originalText}</p>
          </>
        ) : (
          <p className={styles.empty}>
            {media.photos.status === "unavailable" ? t.photoUnavailable : t.photoEmpty}
          </p>
        )}
      </section>
      <section className={styles.section} aria-label={t.stories}>
        <div className={styles.heading}>
          <h2>{t.stories}</h2>
          <ExternalLink href="https://www.odii.kr/" className="text-link" lang={lang}>
            {t.odii}
          </ExternalLink>
        </div>
        {media.audio.items.length ? (
          <div className={styles.stories}>
            {media.audio.items.map((guide) => (
              <article className={styles.story} key={guide.id}>
                <div className={styles.storyHeading}>
                  <h3 lang={guide.language}>{guide.title}</h3>
                  <div className={styles.tags}>
                    <span lang={guide.language}>{LANGUAGE_NAMES[guide.language]}</span>
                    {guide.durationSeconds && (
                      <span>
                        {Math.floor(guide.durationSeconds / 60)}:
                        {String(guide.durationSeconds % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>
                {guide.audioUrl && !failedAudio.has(guide.id) ? (
                  <audio
                    controls
                    preload="none"
                    src={guide.audioUrl}
                    aria-label={`${guide.title} · ${LANGUAGE_NAMES[guide.language]}`}
                    onError={() => setFailedAudio((previous) => new Set([...previous, guide.id]))}
                    onPlay={(event) => {
                      const playing = event.currentTarget;
                      playing
                        .closest("section")
                        ?.querySelectorAll("audio")
                        .forEach((other) => {
                          if (other !== playing) other.pause();
                        });
                    }}
                  />
                ) : (
                  <p className={styles.note}>
                    {failedAudio.has(guide.id) ? t.audioError : t.noAudio}
                  </p>
                )}
                {guide.transcript && (
                  <details className={styles.transcript}>
                    <summary>{t.read}</summary>
                    <p lang={guide.language}>{guide.transcript}</p>
                  </details>
                )}
                <p className={styles.credit}>{t.source} · Odii</p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {media.audio.status === "unsupported"
              ? t.unsupported
              : media.audio.status === "unavailable"
                ? t.audioUnavailable
                : t.audioEmpty}
          </p>
        )}
      </section>
    </section>
  );
}
