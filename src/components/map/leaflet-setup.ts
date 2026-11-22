'use client';

import L from 'leaflet';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 1C6.82 1 1 6.82 1 14c0 9.75 13 24.5 13 24.5S27 23.75 27 14C27 6.82 21.18 1 14 1z" fill="#4737FF" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="#FFFFFF"/>
  </svg>`
);

let defaultIconFixed = false;

/**
 * Memperbaiki ikon marker bawaan Leaflet agar tidak bergantung pada deteksi
 * path relatif CSS yang rentan rusak di bundler (Next.js / Turbopack).
 */
export function ensureLeafletDefaultIcons(): void {
  if (defaultIconFixed || typeof window === 'undefined') return;
  defaultIconFixed = true;

  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: `data:image/svg+xml;charset=utf-8,${DEFAULT_PIN_SVG}`,
    iconRetinaUrl: `data:image/svg+xml;charset=utf-8,${DEFAULT_PIN_SVG}`,
    shadowUrl: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
    shadowSize: [0, 0],
  });
}

export function createStoreIcon(): L.DivIcon {
  return L.divIcon({
    className: 'lezzat-store-marker',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:#101018;color:#ffffff;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(16,16,24,0.35);font-weight:800;font-size:12px;letter-spacing:0.02em;">TOKO</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

export function createNumberedStopIcon(urutan: number): L.DivIcon {
  return L.divIcon({
    className: 'lezzat-stop-marker',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#F75C03;color:#ffffff;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(247,92,3,0.38);font-weight:800;font-size:13px;">${urutan}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}
