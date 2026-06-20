// @ts-nocheck
"use client";
import React from "react";

// ─────────────────────────────────────────────
// Icons (stroke-based, minimal, AllTrails-inspired)
// ─────────────────────────────────────────────
const Icon = {
  search: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
    </svg>
  ),
  mic: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>
    </svg>
  ),
  sparkle: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.7 4.8L18.5 9l-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.5L12 3z"/>
      <path d="M19 15l.6 1.8L21.5 18l-1.9.4L19 20l-.6-1.5L16.5 18l1.9-.8L19 15z"/>
    </svg>
  ),
  menu: (p = {}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M4 6h16M4 12h16M4 18h10"/>
    </svg>
  ),
  user: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8"/>
    </svg>
  ),
  back: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M15 5l-7 7 7 7"/>
    </svg>
  ),
  close: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
  bookmark: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 4h12v17l-6-4-6 4V4z"/>
    </svg>
  ),
  bookmarkFill: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M6 4h12v17l-6-4-6 4V4z"/>
    </svg>
  ),
  map: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>
    </svg>
  ),
  home: (p = {}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 10l8-6 8 6v10a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1V10z"/>
    </svg>
  ),
  discover: (p = {}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M15 9l-2 4-4 2 2-4 4-2z"/>
    </svg>
  ),
  saved: (p = {}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 4h12v17l-6-4-6 4V4z"/>
    </svg>
  ),
  clock: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  ),
  pin: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 21s-7-6-7-12a7 7 0 1 1 14 0c0 6-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>
    </svg>
  ),
  star: (p = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7-6.3-3.5-6.3 3.5L7 14.2 2 9.4l7-.9L12 2z"/>
    </svg>
  ),
  sun: (p = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/>
    </svg>
  ),
  wind: (p = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8h13a3 3 0 1 0-3-3M3 12h17a3 3 0 1 1-3 3M3 16h9"/>
    </svg>
  ),
  car: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 14l2-5a2 2 0 0 1 2-1.5h6a2 2 0 0 1 2 1.5l2 5M4 14h16v4H4zM7 18v2M17 18v2"/>
      <circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>
    </svg>
  ),
  share: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6"/>
    </svg>
  ),
  filter: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5h16M7 12h10M10 19h4"/>
    </svg>
  ),
  trail: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20l5-5 3 3 8-8M14 10h6v6"/>
    </svg>
  ),
  chevR: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 6l6 6-6 6"/>
    </svg>
  ),
  plus: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  refresh: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 11a8 8 0 1 1-2-5M20 4v5h-5"/>
    </svg>
  ),
  route: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="19" r="2.5"/>
      <path d="M8 6c3 0 4 2 4 6s1 6 4 6"/>
    </svg>
  ),
  utensils: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M18 3c-2 2-3 4-3 7v3h3v8"/>
    </svg>
  ),
  bed: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 18v-7h18v7M3 11V6M21 18v3M3 18v3M7 11V8h6v3"/>
    </svg>
  ),
  leaf: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20c0-8 6-16 16-16 0 10-6 16-16 16zM4 20c4-4 8-6 12-8"/>
    </svg>
  ),
  gear: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3.2"/>
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"/>
    </svg>
  ),
  bell: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.5 20a1.8 1.8 0 0 0 3 0"/>
    </svg>
  ),
  pencil: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  ),
  camera: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="3.2"/>
    </svg>
  ),
  logout: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M16 12H10M16 12l-3-3M16 12l-3 3"/>
    </svg>
  ),
  check: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12.5l4.5 4.5L19 7"/>
    </svg>
  ),
  doc: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3h8l4 4v14a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0V3z"/><path d="M14 3v4h4M8.5 12h7M8.5 16h7"/>
    </svg>
  ),
  headset: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1"/><path d="M4 13a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2zM20 13a2 2 0 0 0-2 2v2a2 2 0 0 0 4 0v-2a2 2 0 0 0-2-2z"/><path d="M20 17v1a3 3 0 0 1-3 3h-3"/>
    </svg>
  ),
  globe: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>
    </svg>
  ),
  lock: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>
    </svg>
  ),
  heart: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z"/>
    </svg>
  ),
  chevD: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  ),
};

export { Icon };
