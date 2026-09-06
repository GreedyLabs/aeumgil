export type TourismMediaLanguage = "ko" | "en" | "zh-CN" | "zh-TW" | "ja" | "de" | "fr";
export type MediaAvailability = "available" | "empty" | "unavailable" | "unsupported";

export interface SpotMediaQuery {
  id: string;
  nameKo: string;
  regionKo: string;
  lat: number;
  lng: number;
}

export interface MediaCollection<T> {
  status: MediaAvailability;
  items: T[];
}

export interface TourismPhoto {
  id: string;
  title: string;
  imageUrl: string;
  photographer?: string;
  location: string;
  photographedMonth?: string;
  sourceName: string;
  sourceUrl: string;
  license: { code: "KOGL-1"; name: string; url: string };
}

export interface TourismAudioGuide {
  id: string;
  storyId: string;
  title: string;
  placeName: string;
  language: TourismMediaLanguage;
  durationSeconds?: number;
  audioUrl?: string;
  transcript?: string;
  sourceName: string;
  sourceUrl: string;
}

export interface SpotTourismMedia {
  requestedLanguage: TourismMediaLanguage;
  photos: MediaCollection<TourismPhoto>;
  audio: MediaCollection<TourismAudioGuide>;
}
