'use client';

import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

/**
 * Menonaktifkan scroll-wheel zoom pada peta secara default agar halaman tetap
 * mudah di-scroll tanpa "terjebak" zoom peta.
 * - Klik peta -> aktifkan scroll-zoom (pill petunjuk menghilang).
 * - Kursor keluar peta (mouseout) -> nonaktifkan kembali scroll-zoom.
 * - Perangkat sentuh (L.Browser.mobile) -> drag peta hanya aktif dengan 2 jari
 *   supaya scroll halaman 1 jari tetap berjalan lancar.
 */
export function PenjagaScrollZoom() {
  const map = useMap();
  const [aktif, setAktif] = useState(false);

  useEffect(() => {
    map.scrollWheelZoom.disable();

    const handleClick = () => {
      map.scrollWheelZoom.enable();
      setAktif(true);
    };

    const handleMouseOut = () => {
      map.scrollWheelZoom.disable();
      setAktif(false);
    };

    map.on('click', handleClick);
    map.on('mouseout', handleMouseOut);

    const container = map.getContainer();
    const isMobile = L.Browser.mobile;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        map.dragging.enable();
      } else {
        map.dragging.disable();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        map.dragging.disable();
      }
    };

    if (isMobile) {
      map.dragging.disable();
      container.addEventListener('touchstart', handleTouchStart, {
        passive: true,
      });
      container.addEventListener('touchend', handleTouchEnd, {
        passive: true,
      });
    }

    return () => {
      map.off('click', handleClick);
      map.off('mouseout', handleMouseOut);
      if (isMobile) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [map]);

  if (aktif) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] rounded-full bg-slate-900/75 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-xs whitespace-nowrap"
    >
      Klik peta untuk zoom dengan scroll
    </div>
  );
}

export default PenjagaScrollZoom;
