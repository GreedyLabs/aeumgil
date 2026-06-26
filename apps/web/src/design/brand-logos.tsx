// @ts-nocheck
"use client";
import React from "react";

// ─────────────────────────────────────────────
// Social provider marks — used on login buttons.
// Kakao / Naver / Apple render in currentColor (set per button).
// Google keeps its official 4-color mark.
// ─────────────────────────────────────────────
const Brand = {
  kakao: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M12 4C6.9 4 3 7.2 3 11.2c0 2.6 1.74 4.86 4.36 6.12-.19.66-.69 2.5-.79 2.89-.12.48.18.47.37.34.15-.1 2.36-1.6 3.32-2.26.56.08 1.14.12 1.74.12 5.1 0 9-3.2 9-7.21S17.1 4 12 4z"/>
    </svg>
  ),
  naver: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M5 4h5.18l3.46 5.05V4H19v16h-5.18l-3.46-5.05V20H5z"/>
    </svg>
  ),
  apple: (p = {}) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M17.05 12.2c-.03-2.4 1.96-3.55 2.05-3.6-1.12-1.64-2.86-1.86-3.48-1.89-1.48-.15-2.89.87-3.64.87-.75 0-1.91-.85-3.14-.83-1.62.02-3.11.94-3.94 2.39-1.68 2.92-.43 7.24 1.2 9.61.8 1.16 1.75 2.46 3 2.41 1.2-.05 1.66-.78 3.11-.78 1.45 0 1.86.78 3.13.75 1.29-.02 2.11-1.18 2.9-2.35.91-1.35 1.29-2.65 1.31-2.72-.03-.01-2.51-.96-2.54-3.81z"/>
      <path d="M14.9 5.36c.66-.8 1.1-1.92.98-3.03-.95.04-2.1.63-2.78 1.43-.61.71-1.14 1.84-1 2.92 1.06.08 2.14-.54 2.8-1.32z"/>
    </svg>
  ),
  google: (p = {}) => (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true" {...p}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.9 36.4 44 30.8 44 24c0-1.3-.1-2.6-.4-3.5z"/>
    </svg>
  ),
  keycloak: (p = {}) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
      <path d="M7 10V8.2C7 5.4 9.1 3.5 12 3.5s5 1.9 5 4.7V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M5.5 10h13A1.5 1.5 0 0 1 20 11.5v6A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-6A1.5 1.5 0 0 1 5.5 10Z" fill="currentColor" opacity=".12"/>
      <path d="M5.5 10h13A1.5 1.5 0 0 1 20 11.5v6A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-6A1.5 1.5 0 0 1 5.5 10Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

export { Brand };
