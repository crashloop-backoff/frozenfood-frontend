'use client';

import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import { GarisRute, KoordinatTitik, StopKurir } from '@/types/api';
import { formatWaktuSingkat } from '@/lib/utils';
import {
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  createNumberedStopIcon,
  createStoreIcon,
  ensureLeafletDefaultIcons,
} from './leaflet-setup';
import {
  DEFAULT_FIT_OPTIONS,
  TombolTampilanAwal,
} from './tombol-tampilan-awal';
import { PenjagaScrollZoom } from './penjaga-scroll-zoom';

export interface PetaRuteProps {
  toko: KoordinatTitik;
  stops: StopKurir[];
  garisRute: GarisRute | null;
  sumberRute: 'RUTE_ASLI' | 'PERKIRAAN';
  className?: string;
}

const SINGLE_POINT_ZOOM = 15;

function FitBoundsHelper({
  bounds,
  singlePoint,
}: {
  bounds?: L.LatLngBounds;
  singlePoint?: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { ...DEFAULT_FIT_OPTIONS, animate: false });
      return;
    }
    if (singlePoint) {
      map.setView(singlePoint, SINGLE_POINT_ZOOM, { animate: false });
    }
  }, [map, bounds, singlePoint]);

  return null;
}

export default function PetaRuteInner({
  toko,
  stops,
  garisRute,
  sumberRute,
  className = 'h-[420px] w-full',
}: PetaRuteProps) {
  ensureLeafletDefaultIcons();

  const storeIcon = useMemo(() => createStoreIcon(), []);

  // GeoJSON memakai urutan [lng, lat] -> wajib dibalik menjadi [lat, lng] untuk Leaflet.
  // Bila sumberRute === 'PERKIRAAN', jangan gambar garis rute.
  const polylinePositions = useMemo<[number, number][]>(() => {
    if (
      sumberRute !== 'RUTE_ASLI' ||
      !garisRute ||
      !Array.isArray(garisRute.coordinates)
    ) {
      return [];
    }
    return garisRute.coordinates
      .filter(
        (coord): coord is [number, number] =>
          Array.isArray(coord) &&
          coord.length >= 2 &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number' &&
          Number.isFinite(coord[0]) &&
          Number.isFinite(coord[1])
      )
      .map(([lng, lat]) => [lat, lng]);
  }, [garisRute, sumberRute]);

  // Hitung bounds satu kali per perjalanan dan pakai ulang di fitBounds awal & TombolTampilanAwal.
  const initialView = useMemo(() => {
    const pts: [number, number][] = [[toko.latitude, toko.longitude]];
    for (const s of stops) {
      pts.push([s.latitude, s.longitude]);
    }
    for (const pt of polylinePositions) {
      pts.push(pt);
    }

    if (pts.length <= 1) {
      return {
        bounds: undefined as L.LatLngBounds | undefined,
        singlePoint: [toko.latitude, toko.longitude] as [number, number],
      };
    }

    const computed = L.latLngBounds(pts);
    if (
      !computed.isValid() ||
      computed.getSouthWest().equals(computed.getNorthEast())
    ) {
      return {
        bounds: undefined as L.LatLngBounds | undefined,
        singlePoint: pts[0],
      };
    }

    return {
      bounds: computed,
      singlePoint: undefined as [number, number] | undefined,
    };
  }, [toko.latitude, toko.longitude, stops, polylinePositions]);

  const tokoCoords = useMemo<[number, number]>(
    () => [toko.latitude, toko.longitude],
    [toko.latitude, toko.longitude]
  );

  return (
    <div className="relative z-0 isolate overflow-hidden rounded-xl border border-[#E6E8F0] bg-[#F8FAFF]">
      <MapContainer
        center={tokoCoords}
        zoom={13}
        scrollWheelZoom={false}
        className={`relative z-0 rounded-xl ${className}`}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />

        <PenjagaScrollZoom />

        <FitBoundsHelper
          bounds={initialView.bounds}
          singlePoint={initialView.singlePoint}
        />

        <TombolTampilanAwal
          bounds={initialView.bounds}
          center={initialView.singlePoint}
          fitOptions={DEFAULT_FIT_OPTIONS}
          singlePointZoom={SINGLE_POINT_ZOOM}
          fokusToko={tokoCoords}
        />

        {/* Marker Toko */}
        <Marker position={tokoCoords} icon={storeIcon}>
          <Popup>
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-[#171725]">Toko Lezzat Frozen Food</p>
              <p className="text-[#5E5E6A]">Titik berangkat & pulang kurir</p>
              <p className="font-mono text-xs text-[#77788A]">
                {toko.latitude.toFixed(6)}, {toko.longitude.toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Marker Bernomor untuk Setiap Stop */}
        {stops.map((stop) => (
          <Marker
            key={stop.idDelivery}
            position={[stop.latitude, stop.longitude]}
            icon={createNumberedStopIcon(stop.urutan)}
          >
            <Popup>
              <div className="text-xs space-y-1 max-w-[220px]">
                <p className="font-extrabold text-[#F75C03]">
                  Stop #{stop.urutan} • Order #{stop.idOrder.slice(0, 8)}
                </p>
                <p className="text-[#171725] font-medium leading-snug">
                  {stop.alamatTujuan}
                </p>
                <p className="text-[#5E5E6A]">
                  Ruas: <strong>{stop.jarakDariSebelumnyaKm} km</strong> • Tiba:{' '}
                  <strong>{formatWaktuSingkat(stop.estimasiTiba)}</strong> (+
                  {stop.menitDariBerangkat} mnt)
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Polyline Rute Asli OSRM */}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#4737FF',
              weight: 4,
              opacity: 0.88,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
