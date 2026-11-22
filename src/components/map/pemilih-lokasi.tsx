'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, MapPin, Navigation } from 'lucide-react';

const PemilihLokasiDynamic = dynamic(() => import('./pemilih-lokasi-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-xl border border-[#E6E8F0] bg-[#F8FAFF] animate-pulse flex items-center justify-center text-xs font-semibold text-[#77788A]">
      Memuat peta pemilih lokasi...
    </div>
  ),
});

export interface PemilihLokasiProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
  heightClassName?: string;
}

export function PemilihLokasi({
  latitude,
  longitude,
  onChange,
  disabled = false,
  heightClassName = 'h-[420px]',
}: PemilihLokasiProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const safeLat = Number.isFinite(latitude) ? latitude : -7.7925;
  const safeLng = Number.isFinite(longitude) ? longitude : 110.365;

  const handleUseCurrentLocation = () => {
    if (disabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Browser Anda tidak mendukung fitur Geolocation.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        onChange(lat, lng);
        setIsLocating(false);
      },
      () => {
        setGeoError(
          'Gagal mengambil lokasi GPS. Pastikan izin lokasi browser aktif atau klik langsung titik lokasi pada peta.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#171725] flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#4737FF] shrink-0" />
          <span>
            Klik pada peta atau geser pin biru untuk menentukan titik tujuan
          </span>
        </p>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating || disabled}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E7EFFF] hover:bg-[#D1CDFF] disabled:opacity-50 text-[#4737FF] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{isLocating ? 'Mengambil GPS...' : 'Gunakan lokasi saya'}</span>
        </button>
      </div>

      {geoError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#E5484D]/30 bg-[#E5484D]/10 p-3 text-xs text-[#E5484D]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{geoError}</span>
        </div>
      )}

      <PemilihLokasiDynamic
        latitude={safeLat}
        longitude={safeLng}
        onChange={(lat, lng) => {
          setGeoError(null);
          onChange(lat, lng);
        }}
        disabled={disabled}
        heightClassName={heightClassName}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F8FAFF] border border-[#E6E8F0] px-3.5 py-2 text-xs text-[#5E5E6A]">
        <span>Titik koordinat terpilih:</span>
        <span className="font-mono font-bold text-[#171725] tabular-nums">
          Lat {safeLat.toFixed(6)}, Lng {safeLng.toFixed(6)}
        </span>
      </div>
    </div>
  );
}

export default PemilihLokasi;
