'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  ensureLeafletDefaultIcons,
} from './leaflet-setup';
import { TombolTampilanAwal } from './tombol-tampilan-awal';
import { PenjagaScrollZoom } from './penjaga-scroll-zoom';

export interface PemilihLokasiInnerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
  heightClassName?: string;
}

const DEFAULT_COORDS: [number, number] = [-7.7925, 110.365];
const SELECTED_MARKER_ZOOM = 16;

function roundCoord(value: number): number {
  return Number(value.toFixed(6));
}

function MapInteractionHandler({
  disabled,
  onChange,
}: {
  disabled?: boolean;
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onChange(roundCoord(e.latlng.lat), roundCoord(e.latlng.lng));
    },
  });
  return null;
}

function MapCenterSync({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const currentCenter = map.getCenter();
    const movedEnough =
      Math.abs(currentCenter.lat - latitude) > 0.00001 ||
      Math.abs(currentCenter.lng - longitude) > 0.00001;
    if (movedEnough) {
      map.setView([latitude, longitude], map.getZoom(), { animate: true });
    }
  }, [map, latitude, longitude]);

  return null;
}

export default function PemilihLokasiInner({
  latitude,
  longitude,
  onChange,
  disabled = false,
  heightClassName = 'h-[420px]',
}: PemilihLokasiInnerProps) {
  ensureLeafletDefaultIcons();

  const markerRef = useRef<L.Marker | null>(null);

  const safeLat = Number.isFinite(latitude) ? latitude : DEFAULT_COORDS[0];
  const safeLng = Number.isFinite(longitude) ? longitude : DEFAULT_COORDS[1];

  const selectedCenter = useMemo<[number, number]>(
    () => [safeLat, safeLng],
    [safeLat, safeLng]
  );

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        if (disabled) return;
        const marker = markerRef.current;
        if (!marker) return;
        const pos = marker.getLatLng();
        onChange(roundCoord(pos.lat), roundCoord(pos.lng));
      },
    }),
    [disabled, onChange]
  );

  return (
    <div
      className={`relative z-0 isolate overflow-hidden rounded-xl border border-[#E6E8F0] bg-[#F8FAFF] w-full ${
        disabled ? 'opacity-70 pointer-events-none' : ''
      }`}
    >
      <MapContainer
        center={selectedCenter}
        zoom={14}
        scrollWheelZoom={false}
        className={`relative z-0 ${heightClassName} w-full rounded-xl`}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        <PenjagaScrollZoom />
        <MapCenterSync latitude={safeLat} longitude={safeLng} />
        <MapInteractionHandler disabled={disabled} onChange={onChange} />
        <TombolTampilanAwal
          center={selectedCenter}
          mode="fly"
          singlePointZoom={SELECTED_MARKER_ZOOM}
          label="Kembali ke titik terpilih"
          ariaLabel="Kembali ke titik terpilih"
        />
        <Marker
          ref={markerRef}
          position={selectedCenter}
          draggable={!disabled}
          eventHandlers={eventHandlers}
        />
      </MapContainer>
    </div>
  );
}
