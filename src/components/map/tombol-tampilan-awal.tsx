'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { LocateFixed, Store } from 'lucide-react';

export const DEFAULT_FIT_OPTIONS: L.FitBoundsOptions = {
  padding: [40, 40],
  maxZoom: 15,
};

export interface TombolTampilanAwalProps {
  /** Bounds tampilan awal (L.LatLngBoundsExpression atau array [lat, lng]). */
  bounds?: L.LatLngBoundsExpression;
  /** Opsi fitBounds, default { padding: [40, 40], maxZoom: 15 }. */
  fitOptions?: L.FitBoundsOptions;
  /** Titik tunggal (dipakai saat hanya ada 1 titik atau mode 'fly'). */
  center?: [number, number];
  /** Level zoom untuk titik tunggal / mode 'fly'. Default 15. */
  singlePointZoom?: number;
  /** 'fit' untuk fitBounds/setView (peta rute), 'fly' untuk flyTo (pemilih lokasi). */
  mode?: 'fit' | 'fly';
  /** Label tombol di layar >= sm. Default "Tampilan awal". */
  label?: string;
  /** aria-label dan title tombol. Default "Kembali ke tampilan awal". */
  ariaLabel?: string;
  /** Koordinat toko opsional untuk tombol kedua "Fokus ke toko". */
  fokusToko?: [number, number];
  /** Level zoom saat "Fokus ke toko" diklik. Default 15. */
  fokusTokoZoom?: number;
}

interface ResolvedTarget {
  bounds: L.LatLngBounds | null;
  singlePoint: [number, number] | null;
  signature: string;
}

function resolveTarget(
  bounds?: L.LatLngBoundsExpression,
  center?: [number, number]
): ResolvedTarget {
  if (bounds) {
    if (bounds instanceof L.LatLngBounds) {
      if (bounds.isValid()) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        if (sw.equals(ne)) {
          const pt: [number, number] = [sw.lat, sw.lng];
          return {
            bounds: null,
            singlePoint: pt,
            signature: `p:${pt[0].toFixed(6)},${pt[1].toFixed(6)}`,
          };
        }
        return {
          bounds,
          singlePoint: null,
          signature: `b:${sw.lat.toFixed(6)},${sw.lng.toFixed(6)}|${ne.lat.toFixed(6)},${ne.lng.toFixed(6)}`,
        };
      }
    } else if (Array.isArray(bounds) && bounds.length > 0) {
      const converted = L.latLngBounds(bounds);
      if (converted.isValid()) {
        const sw = converted.getSouthWest();
        const ne = converted.getNorthEast();
        if (bounds.length === 1 || sw.equals(ne)) {
          const pt: [number, number] = [sw.lat, sw.lng];
          return {
            bounds: null,
            singlePoint: pt,
            signature: `p:${pt[0].toFixed(6)},${pt[1].toFixed(6)}`,
          };
        }
        return {
          bounds: converted,
          singlePoint: null,
          signature: `b:${sw.lat.toFixed(6)},${sw.lng.toFixed(6)}|${ne.lat.toFixed(6)},${ne.lng.toFixed(6)}`,
        };
      }
    }
  }

  if (
    center &&
    Number.isFinite(center[0]) &&
    Number.isFinite(center[1])
  ) {
    return {
      bounds: null,
      singlePoint: center,
      signature: `c:${center[0].toFixed(6)},${center[1].toFixed(6)}`,
    };
  }

  return { bounds: null, singlePoint: null, signature: 'empty' };
}

const CONTROL_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-h-[32px] min-w-[32px] px-2.5 py-1.5 bg-white text-[#171725] border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4737FF] focus-visible:ring-offset-1';

export function TombolTampilanAwal({
  bounds,
  fitOptions = DEFAULT_FIT_OPTIONS,
  center,
  singlePointZoom = 15,
  mode = 'fit',
  label = 'Tampilan awal',
  ariaLabel = 'Kembali ke tampilan awal',
  fokusToko,
  fokusTokoZoom = 15,
}: TombolTampilanAwalProps) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baselineRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);
  const justResetRef = useRef(false);

  const target = useMemo(
    () => resolveTarget(bounds, center),
    [bounds, center]
  );

  // Simpan signature target yang sudah digeser agar reset otomatis saat target berubah
  // tanpa memanggil setState sinkron di dalam useEffect.
  const [movedSignature, setMovedSignature] = useState<string | null>(null);
  const sudahBergeser =
    target.signature !== 'empty' && movedSignature === target.signature;

  // Cegah klik/double-click/scroll pada tombol ikut memengaruhi peta atau PenjagaScrollZoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // Rekam baseline tampilan awal & pantau pergeseran/zoom lewat event peta.
  useEffect(() => {
    if (target.signature === 'empty') {
      baselineRef.current = null;
      return;
    }

    justResetRef.current = false;

    if (mode === 'fly' && target.singlePoint) {
      baselineRef.current = {
        center: L.latLng(target.singlePoint[0], target.singlePoint[1]),
        zoom: map.getZoom(),
      };
    } else {
      baselineRef.current = {
        center: map.getCenter(),
        zoom: map.getZoom(),
      };
    }

    const handleDragStart = () => {
      justResetRef.current = false;
    };

    const handleMoveEnd = () => {
      if (justResetRef.current) {
        justResetRef.current = false;
        baselineRef.current = {
          center: map.getCenter(),
          zoom: map.getZoom(),
        };
        setMovedSignature(null);
        return;
      }

      const base = baselineRef.current;
      if (!base) return;

      const distMeters = map.getCenter().distanceTo(base.center);
      const zoomDiff = Math.abs(map.getZoom() - base.zoom);
      const isMoved = distMeters >= 20 || zoomDiff >= 0.01;
      setMovedSignature(isMoved ? target.signature : null);
    };

    map.on('dragstart', handleDragStart);
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('dragstart', handleDragStart);
      map.off('moveend', handleMoveEnd);
    };
  }, [map, mode, target]);

  const handleResetView = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    map.closePopup();

    if (target.signature === 'empty') return;

    justResetRef.current = true;
    setMovedSignature(null);

    if (mode === 'fly' && target.singlePoint) {
      map.flyTo(target.singlePoint, singlePointZoom, { animate: true });
      return;
    }

    if (target.bounds) {
      map.fitBounds(target.bounds, {
        ...fitOptions,
        animate: true,
      });
      return;
    }

    if (target.singlePoint) {
      map.setView(target.singlePoint, singlePointZoom, { animate: true });
    }
  };

  const handleFokusToko = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!fokusToko) return;
    justResetRef.current = false;
    map.closePopup();
    map.flyTo(fokusToko, fokusTokoZoom, { animate: true });
  };

  const hasValidToko =
    Array.isArray(fokusToko) &&
    Number.isFinite(fokusToko[0]) &&
    Number.isFinite(fokusToko[1]);

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2"
    >
      {sudahBergeser && (
        <button
          type="button"
          onClick={handleResetView}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={CONTROL_BUTTON_CLASS}
        >
          <LocateFixed
            className="w-4 h-4 shrink-0 text-[#4737FF]"
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{label}</span>
        </button>
      )}

      {hasValidToko && (
        <button
          type="button"
          onClick={handleFokusToko}
          aria-label="Fokus ke toko"
          title="Fokus ke toko"
          className={CONTROL_BUTTON_CLASS}
        >
          <Store
            className="w-4 h-4 shrink-0 text-[#171725]"
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Fokus ke toko</span>
        </button>
      )}
    </div>
  );
}

export default TombolTampilanAwal;
