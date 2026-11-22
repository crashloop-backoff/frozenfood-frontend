'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Scale,
  Snowflake,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/axios';
import { formatJamRelatifWib, getErrorMessage } from '@/lib/utils';
import {
  DeliveryListResponse,
  DeliveryResponse,
  KoordinatTitik,
  RuteKurirRequest,
  RuteKurirResponse,
  StopKurir,
} from '@/types/api';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { PetaRute } from '@/components/map/peta-rute';

const MAX_SELECTED_STOPS = 8;
const ELIGIBLE_STATUSES = ['MENUNGGU_PICKUP', 'DISIAPKAN'] as const;

function hasValidCoordinates(d: DeliveryResponse): boolean {
  return (
    typeof d.latitudeTujuan === 'number' &&
    typeof d.longitudeTujuan === 'number' &&
    Number.isFinite(d.latitudeTujuan) &&
    Number.isFinite(d.longitudeTujuan)
  );
}

/**
 * Mengambil seluruh pengiriman untuk satu status tertentu.
 * Mendukung respons objek halaman { content, page, size, totalElements, totalPages }
 * maupun array langsung dari backend.
 */
async function fetchDeliveriesByStatus(
  status: string
): Promise<DeliveryResponse[]> {
  const firstRes = await api.get<DeliveryListResponse | DeliveryResponse[]>(
    '/api/deliveries',
    { params: { status, page: 0, size: 100 } }
  );
  const firstData = firstRes.data;

  if (Array.isArray(firstData)) {
    return firstData;
  }

  const collected: DeliveryResponse[] = Array.isArray(firstData?.content)
    ? [...firstData.content]
    : [];
  const totalPages = firstData?.totalPages ?? 1;

  for (let p = 1; p < totalPages; p += 1) {
    const nextRes = await api.get<DeliveryListResponse | DeliveryResponse[]>(
      '/api/deliveries',
      { params: { status, page: p, size: 100 } }
    );
    const nextData = nextRes.data;
    if (Array.isArray(nextData)) {
      collected.push(...nextData);
    } else if (Array.isArray(nextData?.content)) {
      collected.push(...nextData.content);
    }
  }

  return collected;
}

/**
 * Menyusun tautan Google Maps Directions dengan origin & destination = toko,
 * dan waypoints = urutan stops (maksimal 9 waypoint).
 */
function buildGoogleMapsUrl(toko: KoordinatTitik, stops: StopKurir[]): string {
  const origin = `${toko.latitude},${toko.longitude}`;
  const destination = `${toko.latitude},${toko.longitude}`;
  const waypoints = stops
    .slice(0, 9)
    .map((s) => `${s.latitude},${s.longitude}`)
    .join('|');

  if (!waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
}

export default function AdminDeliveryRoutePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: eligibleDeliveries = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<DeliveryResponse[]>({
    queryKey: ['admin-deliveries-rute-candidates'],
    queryFn: async () => {
      const results = await Promise.all(
        ELIGIBLE_STATUSES.map((st) => fetchDeliveriesByStatus(st))
      );

      const deduped = new Map<string, DeliveryResponse>();
      for (const batch of results) {
        for (const item of batch) {
          if (
            item.pelaksana === 'MOTOR_TOKO' &&
            (item.statusDelivery === 'MENUNGGU_PICKUP' ||
              item.statusDelivery === 'DISIAPKAN')
          ) {
            deduped.set(item.idDelivery, item);
          }
        }
      }
      return Array.from(deduped.values());
    },
  });

  const selectableDeliveries = useMemo(
    () => eligibleDeliveries.filter(hasValidCoordinates),
    [eligibleDeliveries]
  );

  const missingCoordCount = eligibleDeliveries.length - selectableDeliveries.length;

  const validSelectedIds = useMemo(() => {
    const selectableSet = new Set(selectableDeliveries.map((d) => d.idDelivery));
    return selectedIds.filter((id) => selectableSet.has(id));
  }, [selectedIds, selectableDeliveries]);

  const routeMutation = useMutation<RuteKurirResponse, unknown, RuteKurirRequest>({
    mutationFn: async (payload) => {
      const res = await api.post<RuteKurirResponse>(
        '/api/deliveries/rute',
        payload
      );
      return res.data;
    },
  });

  const handleToggleSelect = (idDelivery: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(idDelivery)) {
        return prev.filter((id) => id !== idDelivery);
      }
      if (prev.length >= MAX_SELECTED_STOPS) {
        return prev;
      }
      return [...prev, idDelivery];
    });
  };

  const handleSelectMax = () => {
    setSelectedIds(
      selectableDeliveries
        .slice(0, MAX_SELECTED_STOPS)
        .map((d) => d.idDelivery)
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleCalculateRoute = () => {
    if (validSelectedIds.length === 0) return;
    routeMutation.mutate({ idDeliveries: validSelectedIds });
  };

  const routeResult = routeMutation.data ?? null;

  return (
    <div className="lezzat-shell">
      <AdminSidebar />

      <main className="lezzat-main">
        {/* Navigasi Kembali & Header */}
        <div className="mb-4">
          <Link
            href="/admin/deliveries"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4B5068] hover:text-[#4737FF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Manajemen Pengiriman</span>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#4737FF] uppercase">
              FROZNFOOD 2.0 • SMART DELIVERY ROUTING
            </p>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#171725] mt-1">
              Rute Kurir Motor Toko
            </h1>
            <p className="text-sm text-[#4B5068] mt-1.5 max-w-2xl">
              Pilih hingga {MAX_SELECTED_STOPS} pengiriman motor toko berstatus{' '}
              <code className="font-mono text-xs font-bold text-[#4737FF] bg-[#E7EFFF] px-1.5 py-0.5 rounded">
                MENUNGGU_PICKUP
              </code>{' '}
              atau{' '}
              <code className="font-mono text-xs font-bold text-[#4737FF] bg-[#E7EFFF] px-1.5 py-0.5 rounded">
                DISIAPKAN
              </code>{' '}
              untuk menyusun urutan antar dan pemecahan perjalanan rantai dingin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E6E8F0] hover:bg-[#F1F3F8] disabled:opacity-60 text-[#171725] text-sm font-semibold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#4737FF] ${
                isFetching ? 'animate-spin' : ''
              }`}
            />
            <span>Muat Ulang Daftar</span>
          </button>
        </div>

        {/* Panel Pemilihan Pengiriman */}
        <section className="ff-card p-5 sm:p-6 bg-white mb-7 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#E6E8F0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E7EFFF] text-[#4737FF] flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading text-base sm:text-lg font-extrabold text-[#171725]">
                  1. Pilih Pengiriman Motor Toko
                </h2>
                <p className="text-xs sm:text-sm text-[#4B5068]">
                  Dipilih:{' '}
                  <strong className="text-[#4737FF] tabular-nums">
                    {validSelectedIds.length} / {MAX_SELECTED_STOPS}
                  </strong>{' '}
                  titik • Tersedia {selectableDeliveries.length} siap rute
                  {missingCoordCount > 0
                    ? ` (${missingCoordCount} belum punya koordinat)`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectableDeliveries.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleSelectMax}
                    className="px-3.5 py-2 rounded-xl bg-[#F8FAFF] border border-[#E6E8F0] hover:border-[#4737FF] text-xs font-bold text-[#171725] transition-colors cursor-pointer"
                  >
                    Pilih Maks{' '}
                    {Math.min(MAX_SELECTED_STOPS, selectableDeliveries.length)}
                  </button>
                  {validSelectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="px-3.5 py-2 rounded-xl bg-white border border-[#E6E8F0] hover:bg-[#F1F3F8] text-xs font-semibold text-[#4B5068] transition-colors cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleCalculateRoute}
                disabled={
                  validSelectedIds.length === 0 || routeMutation.isPending
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4737FF] hover:bg-[#3529BF] disabled:bg-[#F1F3F8] disabled:text-[#5F6479] text-white text-sm font-extrabold shadow-sm shadow-[#4737FF]/25 disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Route className="w-4 h-4" />
                <span>
                  {routeMutation.isPending ? 'Menghitung Rute...' : 'Hitung Rute'}
                </span>
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-3 animate-pulse py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 rounded-2xl bg-[#F1F3F8]" />
              ))}
            </div>
          )}

          {!isLoading && isError && (
            <div
              role="alert"
              className="rounded-2xl bg-[#E5484D]/10 border border-[#E5484D]/30 p-6 text-center"
            >
              <AlertCircle className="w-7 h-7 text-[#E5484D] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#171725] mb-1">
                Gagal Memuat Daftar Pengiriman
              </p>
              <p className="text-sm text-[#E5484D] mb-4">
                {getErrorMessage(
                  error,
                  'Tidak dapat mengambil daftar pengiriman dari server.'
                )}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-4 py-2 rounded-xl bg-[#4737FF] text-white text-sm font-bold cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!isLoading && !isError && eligibleDeliveries.length === 0 && (
            <div className="rounded-2xl bg-[#F8FAFF] border border-[#E6E8F0] p-10 text-center">
              <Truck className="w-10 h-10 text-[#ACA5FF] mx-auto mb-2" />
              <p className="text-base font-bold text-[#171725] mb-1">
                Belum ada pengiriman motor toko yang siap dirutekan
              </p>
              <p className="text-sm text-[#4B5068]">
                Pengiriman yang muncul di sini hanya pelaksana{' '}
                <strong>MOTOR_TOKO</strong> dengan status{' '}
                <strong>MENUNGGU_PICKUP</strong> atau{' '}
                <strong>DISIAPKAN</strong>.
              </p>
            </div>
          )}

          {!isLoading && !isError && eligibleDeliveries.length > 0 && (
            <div className="space-y-2.5">
              {eligibleDeliveries.map((d) => {
                const hasCoords = hasValidCoordinates(d);
                const isChecked = validSelectedIds.includes(d.idDelivery);
                const reachedLimit =
                  !isChecked && validSelectedIds.length >= MAX_SELECTED_STOPS;
                const isDisabled = !hasCoords || reachedLimit;

                return (
                  <label
                    key={d.idDelivery}
                    className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-colors ${
                      !hasCoords
                        ? 'border-[#E6E8F0] bg-[#F8FAFC] opacity-80 cursor-not-allowed'
                        : isChecked
                          ? 'border-[#4737FF] bg-[#E7EFFF]/45 cursor-pointer'
                          : reachedLimit
                            ? 'border-[#E6E8F0] bg-white opacity-60 cursor-not-allowed'
                            : 'border-[#E6E8F0] bg-white hover:border-[#ACA5FF] hover:bg-[#F8FAFF] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => handleToggleSelect(d.idDelivery)}
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#4737FF] focus:ring-[#4737FF] accent-[#4737FF] shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-[#4737FF]">
                            Order #{d.idOrder.slice(0, 8)}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              d.statusDelivery === 'DISIAPKAN'
                                ? 'bg-[#4737FF]/15 text-[#4737FF] border-[#4737FF]/30'
                                : 'bg-[#2563EB]/15 text-[#2563EB] border-[#2563EB]/30'
                            }`}
                          >
                            {d.statusDelivery}
                          </span>
                          <span className="text-xs font-semibold text-[#4B5068] tabular-nums">
                            {d.jarak} km
                          </span>
                        </div>

                        {hasCoords ? (
                          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-[#4B5068] bg-[#F8FAFF] border border-[#E6E8F0] px-2.5 py-0.5 rounded-lg tabular-nums">
                            <MapPin className="w-3.5 h-3.5 text-[#4737FF]" />
                            {d.latitudeTujuan!.toFixed(5)},{' '}
                            {d.longitudeTujuan!.toFixed(5)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#D97706]/10 border border-[#D97706]/30 px-2.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Belum ada koordinat — tidak dapat dipilih
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-[#171725] font-medium leading-snug">
                        {d.alamatTujuan}
                      </p>

                      {reachedLimit && hasCoords && (
                        <p className="text-xs text-[#5F6479]">
                          Batas maksimal {MAX_SELECTED_STOPS} titik telah tercapai.
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Error Hitung Rute */}
        {routeMutation.isError && (
          <div
            role="alert"
            className="mb-7 flex items-start gap-2.5 rounded-2xl border border-[#E5484D]/30 bg-[#E5484D]/10 p-4 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#E5484D]" />
            <div>
              <p className="font-bold">Gagal menghitung rute kurir</p>
              <p className="mt-0.5">
                {getErrorMessage(
                  routeMutation.error,
                  'Terjadi kesalahan saat menghitung rute.'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Loading State Hitung Rute */}
        {routeMutation.isPending && (
          <section className="ff-card p-6 bg-white mb-7 space-y-5 animate-pulse">
            <div className="h-6 w-56 rounded-xl bg-[#F1F3F8]" />
            <div className="h-[420px] w-full rounded-xl bg-[#F1F3F8]" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-20 rounded-xl bg-[#F1F3F8]" />
              <div className="h-20 rounded-xl bg-[#F1F3F8]" />
              <div className="h-20 rounded-xl bg-[#F1F3F8]" />
            </div>
          </section>
        )}

        {/* Hasil Perhitungan Rute */}
        {routeResult && !routeMutation.isPending && (
          <div className="space-y-7">
            {/* Banner Fallback PERKIRAAN */}
            {routeResult.sumberRute === 'PERKIRAAN' && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-[#D97706]/40 bg-[#D97706]/10 p-4 text-sm text-[#171725]"
              >
                <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-[#B45309]">
                    Rute memakai estimasi garis lurus
                  </p>
                  <p className="text-[#4B5068] mt-1">
                    Layanan rute jalan tidak aktif atau sedang tidak tersedia.
                    Urutan titik memakai perkiraan Haversine × 1.3 dan garis
                    rute jalan sengaja tidak digambar pada peta.
                  </p>
                </div>
              </div>
            )}

            {/* Daftar Peringatan Global */}
            {routeResult.peringatan.length > 0 && (
              <div className="rounded-2xl border border-[#D97706]/30 bg-white p-5 space-y-2">
                <p className="text-sm font-extrabold text-[#B45309] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Peringatan Perencanaan Rute</span>
                </p>
                <ul className="list-disc list-inside text-sm text-[#4B5068] space-y-1">
                  {routeResult.peringatan.map((warn, idx) => (
                    <li key={idx}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Kartu per Perjalanan */}
            {routeResult.perjalanan.length === 0 ? (
              <div className="ff-card bg-white p-8 text-center text-sm text-[#5F6479]">
                Tidak ada perjalanan yang dihasilkan untuk pilihan ini.
              </div>
            ) : (
              routeResult.perjalanan.map((trip) => {
                const mapsUrl = buildGoogleMapsUrl(
                  routeResult.toko,
                  trip.stops
                );
                const tripKey = `${trip.perjalananKe}-${trip.stops
                  .map((s) => s.idDelivery)
                  .join(',')}-${routeResult.sumberRute}`;

                return (
                  <section
                    key={tripKey}
                    className="ff-card bg-white p-5 sm:p-6 space-y-5"
                  >
                    {/* Header Perjalanan */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E6E8F0]">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-heading text-lg sm:text-xl font-extrabold text-[#171725]">
                            Perjalanan #{trip.perjalananKe}
                          </h2>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                              routeResult.sumberRute === 'RUTE_ASLI'
                                ? 'bg-[#E7EFFF] text-[#4737FF]'
                                : 'bg-[#D97706]/15 text-[#B45309]'
                            }`}
                          >
                            {routeResult.sumberRute}
                          </span>

                          {trip.melanggarRantaiDingin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5484D] text-white text-xs font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Melanggar Rantai Dingin (&gt; 60 mnt)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#159A68]/15 text-[#159A68] text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Rantai Dingin Aman
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-[#4B5068] flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-[#4737FF]" />
                            Berangkat:{' '}
                            <strong className="text-[#171725] tabular-nums">
                              {formatJamRelatifWib(trip.berangkatPerkiraan)}
                            </strong>
                          </span>
                          <span aria-hidden="true">•</span>
                          <span>
                            Perkiraan Pulang:{' '}
                            <strong className="text-[#171725] tabular-nums">
                              {formatJamRelatifWib(
                                trip.pulangPerkiraan,
                                trip.berangkatPerkiraan
                              )}
                            </strong>
                          </span>
                        </p>
                      </div>

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F75C03] hover:bg-[#D94800] text-white text-sm font-bold shadow-sm shadow-[#F75C03]/25 transition-colors self-start lg:self-auto"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Buka di Google Maps</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Ringkasan Angka Perjalanan */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div className="rounded-xl bg-[#F8FAFF] border border-[#E6E8F0] p-3.5">
                        <span className="text-xs font-semibold text-[#4B5068] block mb-0.5">
                          Total Jarak (PP)
                        </span>
                        <span className="font-heading text-lg font-extrabold text-[#171725] tabular-nums">
                          {trip.totalJarakKm} km
                        </span>
                      </div>

                      <div className="rounded-xl bg-[#F8FAFF] border border-[#E6E8F0] p-3.5">
                        <span className="text-xs font-semibold text-[#4B5068] block mb-0.5">
                          Total Durasi (PP)
                        </span>
                        <span className="font-heading text-lg font-extrabold text-[#171725] tabular-nums">
                          {trip.totalMenit} menit
                        </span>
                      </div>

                      <div className="rounded-xl bg-[#F8FAFF] border border-[#E6E8F0] p-3.5">
                        <span className="text-xs font-semibold text-[#4B5068] block mb-0.5">
                          Muatan Motor
                        </span>
                        <span className="font-heading text-lg font-extrabold text-[#171725] inline-flex items-center gap-1.5 tabular-nums">
                          <Scale className="w-4 h-4 text-[#4737FF]" />
                          {trip.beratMuatanKg} kg / {trip.volumeMuatanLiter} L
                        </span>
                      </div>

                      <div className="rounded-xl bg-[#F8FAFF] border border-[#E6E8F0] p-3.5">
                        <span className="text-xs font-semibold text-[#4B5068] block mb-0.5">
                          Titik Pengantaran
                        </span>
                        <span className="font-heading text-lg font-extrabold text-[#4737FF] inline-flex items-center gap-1.5 tabular-nums">
                          <Snowflake className="w-4 h-4" />
                          {trip.stops.length} stop
                        </span>
                      </div>
                    </div>

                    {/* Peta Rute */}
                    <PetaRute
                      key={tripKey}
                      toko={routeResult.toko}
                      stops={trip.stops}
                      garisRute={
                        routeResult.sumberRute === 'PERKIRAAN'
                          ? null
                          : trip.garisRute
                      }
                      sumberRute={routeResult.sumberRute}
                    />

                    {/* Daftar Urutan Stop */}
                    <div className="space-y-3">
                      <h3 className="font-heading text-base font-extrabold text-[#171725]">
                        Urutan Titik Pengantaran
                      </h3>

                      <ol className="space-y-2.5">
                        {trip.stops.map((stop) => (
                          <li
                            key={stop.idDelivery}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E6E8F0] bg-[#F8FAFF] p-4"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="w-8 h-8 rounded-full bg-[#F75C03] text-white text-sm font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                                {stop.urutan}
                              </span>

                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={`/orders/${stop.idOrder}`}
                                    className="font-mono text-sm font-extrabold text-[#4737FF] hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>Order #{stop.idOrder.slice(0, 8)}</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>
                                  <span className="hidden sm:inline font-mono text-xs text-[#5F6479] tabular-nums">
                                    ({stop.latitude.toFixed(5)},{' '}
                                    {stop.longitude.toFixed(5)})
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-[#171725] leading-snug">
                                  {stop.alamatTujuan}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap sm:flex-col sm:items-end gap-x-4 gap-y-1 pl-11 sm:pl-0 text-sm shrink-0 tabular-nums">
                              <span className="font-semibold text-[#171725]">
                                {stop.jarakDariSebelumnyaKm} km dari titik
                                sebelumnya
                              </span>
                              <span className="text-[#4737FF] font-extrabold">
                                Tiba:{' '}
                                {formatJamRelatifWib(
                                  stop.estimasiTiba,
                                  trip.berangkatPerkiraan
                                )}{' '}
                                (+{stop.menitDariBerangkat} mnt)
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </section>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
