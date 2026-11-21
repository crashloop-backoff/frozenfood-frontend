'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Check,
  Snowflake,
  Layers,
  Flame,
  CalendarClock,
  MessageCircleQuestion,
} from 'lucide-react';
import { api } from '@/lib/axios';
import { ProductCatalogResponse } from '@/types/api';
import {
  formatRupiah,
  getProductStock,
  hasExplicitStock,
} from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';

export interface ProductCardProps {
  product: ProductCatalogResponse;
  promoPercent?: number;
  onAddedToCart?: (product: ProductCatalogResponse) => void;
}

const numberFormatterId = new Intl.NumberFormat('id-ID');
const expDateFormatterId = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatGramLabel(rawBerat: number | undefined | null): string {
  const val = Number(rawBerat || 0);
  if (val <= 0) return '500 g';
  const grams = val <= 50 ? Math.round(val * 1000) : Math.round(val);
  return `${numberFormatterId.format(grams)} g`;
}

/**
 * Mengurai tanggal "YYYY-MM-DD" menggunakan Date.UTC + timeZone: 'UTC'
 * agar bebas pergeseran zona waktu di semua perangkat/browser -> "18 Nov 2026".
 */
export function formatProductExpDate(
  rawDate: string | null | undefined,
  sisaHariFromApi?: number | null
): {
  formatted: string;
  isUrgent: boolean;
} | null {
  if (!rawDate || rawDate.trim() === '') return null;
  const cleaned = rawDate.replace(/^exp\s*:\s*/i, '').trim();
  if (!cleaned) return null;

  const ymdMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  let utcDate: Date | null = null;

  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (year > 1970 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      utcDate = new Date(Date.UTC(year, month - 1, day));
    }
  } else {
    const parsed = new Date(cleaned);
    if (!Number.isNaN(parsed.getTime())) {
      utcDate = new Date(
        Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
      );
    }
  }

  if (!utcDate || Number.isNaN(utcDate.getTime())) {
    return {
      formatted: cleaned,
      isUrgent:
        typeof sisaHariFromApi === 'number' && sisaHariFromApi <= 7,
    };
  }

  let isUrgent = false;
  if (typeof sisaHariFromApi === 'number') {
    isUrgent = sisaHariFromApi <= 7;
  } else {
    const now = new Date();
    const todayUtc = Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const diffDays = Math.ceil(
      (utcDate.getTime() - todayUtc) / (1000 * 60 * 60 * 24)
    );
    isUrgent = diffDays <= 7;
  }

  return {
    formatted: expDateFormatterId.format(utcDate),
    isUrgent,
  };
}

export function resolveProductImageUrl(
  rawUrl?: string | null
): string | null {
  if (!rawUrl || rawUrl.trim() === '') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const baseUrl = (
    api.defaults.baseURL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080'
  ).replace(/\/+$/, '');
  return `${baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export interface ProductPromoInfo {
  isClearance: boolean;
  discountPercent: number;
  originalPrice: number | null;
  effectivePrice: number;
  finalPrice: number;
  labelDeal: string | null;
  stokClearance: number;
  nearestExpDate: string | null;
}

export function extractProductPromo(
  product: ProductCatalogResponse,
  overridePercent?: number
): ProductPromoInfo {
  const raw = product as unknown as Record<string, unknown>;
  const basePrice = Number(product.hargaEceran || 0);

  const firstBatch =
    Array.isArray(product.activeBatches) && product.activeBatches.length > 0
      ? product.activeBatches[0]
      : null;

  const nearestExpDate =
    typeof product.nearestExpDate === 'string' &&
    product.nearestExpDate.trim() !== ''
      ? product.nearestExpDate.trim()
      : firstBatch &&
          typeof firstBatch.tanggalExp === 'string' &&
          firstBatch.tanggalExp.trim() !== ''
        ? firstBatch.tanggalExp.trim()
        : typeof raw.tanggalExp === 'string' && raw.tanggalExp.trim() !== ''
          ? raw.tanggalExp.trim()
          : null;

  const isClearance = Boolean(product.isClearance ?? raw.isClearance);
  const stokClearance =
    typeof product.stokClearance === 'number' ? product.stokClearance : 0;

  const dealPriceCandidate =
    typeof product.hargaClearance === 'number' && product.hargaClearance > 0
      ? product.hargaClearance
      : typeof product.hargaSetelahDiskon === 'number' &&
          product.hargaSetelahDiskon > 0
        ? product.hargaSetelahDiskon
        : firstBatch &&
            firstBatch.isDeal &&
            typeof firstBatch.hargaEfektif === 'number' &&
            firstBatch.hargaEfektif > 0
          ? firstBatch.hargaEfektif
          : null;

  if (
    (isClearance || (dealPriceCandidate !== null && dealPriceCandidate < basePrice)) &&
    dealPriceCandidate !== null &&
    dealPriceCandidate < basePrice
  ) {
    const apiPct =
      typeof product.diskonPersen === 'number' && product.diskonPersen > 0
        ? Math.round(product.diskonPersen)
        : null;
    const pct =
      apiPct ??
      Math.max(
        1,
        Math.round(((basePrice - dealPriceCandidate) / basePrice) * 100)
      );
    return {
      isClearance: true,
      discountPercent: pct,
      originalPrice: basePrice,
      effectivePrice: dealPriceCandidate,
      finalPrice: dealPriceCandidate,
      labelDeal:
        product.labelDeal ||
        (pct >= 50 ? `CLEARANCE H-7 (-${pct}%)` : `FEFO DEAL (-${pct}%)`),
      stokClearance,
      nearestExpDate,
    };
  }

  if (isClearance && basePrice > 0) {
    const pct =
      typeof product.diskonPersen === 'number' && product.diskonPersen > 0
        ? Math.round(product.diskonPersen)
        : overridePercent ?? 50;
    const calculatedClearance = Math.round((basePrice * (100 - pct)) / 100);
    return {
      isClearance: true,
      discountPercent: pct,
      originalPrice: basePrice,
      effectivePrice: calculatedClearance,
      finalPrice: calculatedClearance,
      labelDeal:
        product.labelDeal ||
        (pct >= 50 ? `CLEARANCE H-7 (-${pct}%)` : `FEFO DEAL (-${pct}%)`),
      stokClearance,
      nearestExpDate,
    };
  }

  if (overridePercent && overridePercent > 0 && overridePercent < 90) {
    const discounted = Math.round((basePrice * (100 - overridePercent)) / 100);
    return {
      isClearance: false,
      discountPercent: overridePercent,
      originalPrice: basePrice,
      effectivePrice: discounted,
      finalPrice: discounted,
      labelDeal: `PROMO SPESIAL (-${overridePercent}%)`,
      stokClearance: 0,
      nearestExpDate,
    };
  }

  return {
    isClearance: false,
    discountPercent: 0,
    originalPrice: null,
    effectivePrice: basePrice,
    finalPrice: basePrice,
    labelDeal: null,
    stokClearance: 0,
    nearestExpDate,
  };
}

export default function ProductCard({
  product,
  promoPercent,
  onAddedToCart,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const openChatWithProduct = useChatStore(
    (state) => state.openChatWithProduct
  );
  const [added, setAdded] = useState(false);

  const explicitStock = hasExplicitStock(product);
  const stock = getProductStock(product);
  const isOutOfStock =
    product.isActive === false || (explicitStock && stock <= 0) || stock <= 0;
  const isLowStock = !isOutOfStock && explicitStock && stock <= 10;
  const isB2B = user?.tipeAkun === 'B2B';

  const {
    isClearance,
    discountPercent,
    originalPrice,
    effectivePrice,
    stokClearance,
    nearestExpDate,
  } = extractProductPromo(product, promoPercent);

  const raw = product as unknown as Record<string, unknown>;
  const hasTiering =
    Array.isArray(raw.tieringPrices) && raw.tieringPrices.length > 0;

  const firstBatchSisaHari =
    Array.isArray(product.activeBatches) && product.activeBatches.length > 0
      ? product.activeBatches[0].sisaHariExpired
      : null;

  const imageUrl = resolveProductImageUrl(product.gambar);
  const expInfo = formatProductExpDate(
    nearestExpDate,
    product.sisaHariExpired ?? firstBatchSisaHari ?? (isClearance ? 7 : null)
  );

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;

    const itemToAdd =
      discountPercent > 0 &&
      !product.hargaClearance &&
      !product.hargaSetelahDiskon
        ? {
            ...product,
            isClearance: true,
            hargaClearance: effectivePrice,
            hargaSetelahDiskon: effectivePrice,
            diskonPersen: discountPercent,
          }
        : product;

    addItem(itemToAdd, 1);
    setAdded(true);
    if (onAddedToCart) {
      onAddedToCart(product);
    }
    setTimeout(() => setAdded(false), 1400);
  };

  const handleAskProduct = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    openChatWithProduct(product, effectivePrice, discountPercent);
  };

  return (
    <Link
      href={`/products/${product.idProduk}`}
      className={`@container group rounded-2xl border bg-white shadow-xs hover:shadow-md motion-safe:hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none flex flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
        isClearance && !isOutOfStock
          ? 'border-[#F75C03]/60 hover:border-[#F75C03]'
          : 'border-[#E6E8F0] hover:border-slate-300'
      } ${isOutOfStock ? 'opacity-70' : ''}`}
    >
      {/* Foto Produk + Overlay Badge (Minimal 12px & Berat 700) */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.namaProduk}
            loading="lazy"
            className={`w-full h-full object-cover motion-safe:group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none ${
              isOutOfStock ? 'grayscale-[35%]' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#4737FF]/45 bg-slate-50 p-3 text-center">
            <Snowflake className="w-9 h-9 mb-1.5" />
            <span className="text-xs font-medium text-[#5F6479]">
              Lezzat Frozen Food
            </span>
          </div>
        )}

        {/* Overlay Atas: Badge Promo/Clearance & Grosir B2B */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1.5 pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5">
            {isOutOfStock ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-700 text-white text-xs font-bold shadow-2xs">
                Habis
              </span>
            ) : isClearance ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F75C03] text-white text-xs font-bold shadow-xs">
                <Flame className="w-3.5 h-3.5 fill-white shrink-0" />
                <span>CLEARANCE -{discountPercent}%</span>
              </span>
            ) : discountPercent > 0 ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-[#F75C03] text-white text-xs font-bold shadow-2xs">
                Promo -{discountPercent}%
              </span>
            ) : isLowStock ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-[#F75C03] text-white text-xs font-bold shadow-2xs">
                Stok terbatas
              </span>
            ) : null}
          </div>

          {(isB2B || hasTiering) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#4737FF] text-white text-xs font-bold shadow-2xs shrink-0">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Grosir B2B</span>
            </span>
          )}
        </div>

        {/* Overlay Bawah: Pill Stok/Sisa Promo & Pill Berat */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
          {isClearance && !isOutOfStock ? (
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-300 text-[#171725] text-xs font-bold shadow-2xs truncate tabular-nums">
              {stokClearance > 0
                ? `Sisa ${stokClearance} promo`
                : `Stok: ${stock} unit`}
            </span>
          ) : !isOutOfStock ? (
            <span className="px-2.5 py-0.5 rounded-lg bg-[#159A68] text-white text-xs font-bold shadow-2xs tabular-nums">
              Stok: {stock}
            </span>
          ) : null}

          <span className="ml-auto px-2.5 py-0.5 rounded-lg bg-white/95 text-[#171725] text-xs font-bold shadow-2xs shrink-0 tabular-nums">
            {formatGramLabel(product.berat)}
          </span>
        </div>
      </div>

      {/* Bagian Bawah Kartu: 4 Baris Vertikal Terpisah Selebar Penuh Kartu */}
      <div className="p-3.5 @[220px]:p-4 flex-1 flex flex-col justify-between gap-3 w-full">
        <div className="space-y-2.5 w-full">
          {/* 1. Baris Meta: Chip Kategori (kiri) & Tanggal Exp (kanan, Intl.DateTimeFormat 'id-ID') */}
          <div className="w-full flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-h-[24px]">
            <span className="inline-block px-2 py-0.5 rounded-md bg-[#4737FF]/10 text-[#4737FF] text-xs font-semibold truncate max-w-full">
              {product.kategori || 'Frozen Food'}
            </span>

            {expInfo && (
              <span
                className={`inline-flex items-center gap-1 text-xs shrink-0 tabular-nums ml-auto ${
                  expInfo.isUrgent
                    ? 'font-semibold text-[#C2410C]'
                    : 'font-medium text-[#5F6479]'
                }`}
              >
                <CalendarClock
                  className={`hidden @[210px]:inline-block w-3.5 h-3.5 shrink-0 ${
                    expInfo.isUrgent ? 'text-[#C2410C]' : 'text-[#5F6479]'
                  }`}
                />
                <span>Exp {expInfo.formatted}</span>
              </span>
            )}
          </div>

          {/* 2. Baris Nama Produk: 16px, berat 600, line-height 1.35, maks 2 baris, tinggi minimum 2 baris */}
          <h3 className="w-full font-heading text-base font-semibold text-[#171725] group-hover:text-[#4737FF] transition-colors line-clamp-2 min-h-[2.7rem] leading-[1.35]">
            {product.namaProduk}
          </h3>
        </div>

        <div className="pt-3 border-t border-[#E6E8F0] space-y-3 w-full mt-auto">
          {/* 3. Baris Harga (Tanpa truncate, tanpa ellipsis, tidak pernah terpotong) */}
          <div className="w-full flex flex-col gap-1">
            {originalPrice && discountPercent > 0 ? (
              <div className="w-full flex flex-wrap items-center gap-2 min-h-[22px]">
                <span className="text-[13px] leading-tight text-[#5F6479] line-through font-medium tabular-nums">
                  {formatRupiah(originalPrice)}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#FFEDD5] text-[#C2410C] text-xs font-bold leading-none tabular-nums">
                  -{discountPercent}%
                </span>
              </div>
            ) : (
              <div className="w-full min-h-[22px]" aria-hidden="true" />
            )}

            <div className="w-full flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={`text-[20px] @[240px]:text-[21px] font-bold tabular-nums leading-tight ${
                  isClearance ? 'text-[#171725]' : 'text-[#4737FF]'
                }`}
              >
                {formatRupiah(effectivePrice)}
              </span>
              <span className="text-xs font-medium text-[#5F6479]">
                Harga satuan
              </span>
            </div>
          </div>

          {/* 4. Baris Tombol: Lebar penuh di bawah harga, tinggi 40-44px, gap 8px, container query < 280px */}
          <div className="w-full flex items-center gap-2">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              aria-label={
                isOutOfStock
                  ? `${product.namaProduk} habis`
                  : `Tambah ${product.namaProduk} ke keranjang`
              }
              className={`flex-1 min-w-0 h-10 @[220px]:h-11 px-2 @[220px]:px-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
                isOutOfStock
                  ? 'bg-slate-100 text-[#5F6479] cursor-not-allowed'
                  : added
                    ? 'bg-[#159A68] text-white'
                    : 'bg-[#F75C03] hover:bg-[#D94800] text-white shadow-2xs'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Masuk</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="hidden @[210px]:inline-block w-4 h-4 shrink-0" />
                  <span>+ Keranjang</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleAskProduct}
              title={`Tanya admin tentang ${product.namaProduk}`}
              aria-label="Tanya admin tentang produk ini"
              className="h-10 w-10 @[220px]:h-11 @[220px]:w-11 @[280px]:w-auto @[280px]:px-3.5 rounded-xl border border-[#4737FF]/40 bg-white hover:bg-[#4737FF] text-[#4737FF] hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
            >
              <MessageCircleQuestion className="w-4 h-4 shrink-0" />
              <span className="hidden @[280px]:inline">Tanya</span>
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
