'use client';

import React, { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Snowflake,
  ShieldCheck,
  Truck,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  Layers,
  CheckCircle2,
  Building2,
  Clock,
  FileText,
  ArrowRight,
  Star,
  Sparkles,
  Tag,
  Utensils,
  Fish,
  Beef,
  Soup,
  Cookie,
  PackageCheck,
  Quote,
  ThumbsUp,
  Zap,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { api } from '@/lib/axios';
import { ProductCatalogResponse } from '@/types/api';
import { formatRupiah, getErrorMessage, getProductStock } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useCartStore } from '@/store/cart-store';
import ShopSidebar from '@/components/shop/sidebar';
import ProductCard, {
  extractProductPromo,
  formatProductExpDate,
  resolveProductImageUrl,
} from '@/components/shop/product-card';
import HeroCarousel from '@/components/shop/hero-carousel';
import ShopFooter from '@/components/shop/footer';
import IncompleteProfileBanner from '@/components/auth/incomplete-profile-banner';
import CustomerAvatar from '@/components/shop/customer-avatar';

const DEALS_MARQUEE_TEXTS = [
  '🔥 DISKON SPESIAL CLEARANCE H-7 HINGGA 50% & FEFO DEAL H-30 DISKON 20%!',
  '❄️ 100% TERJAGA BEKU PADA SUHU RANTAI DINGIN -18°C & SIAP MASAK HARI INI',
  '💸 HARGA PROMO OTOMATIS TERPOTONG DI KERANJANG & SAAT PEMBAYARAN MIDTRANS',
  '📦 STOK BATCH PROMO TERBATAS — SIAPA CEPAT DIA DAPAT!',
  '🚚 GRATIS ONGKIR RADIUS ≤ 5 KM DENGAN KURIR TOKO BERINSULASI',
];

function getCategoryVisual(categoryName: string) {
  const lower = categoryName.toLowerCase();
  if (
    lower.includes('ikan') ||
    lower.includes('seafood') ||
    lower.includes('udang') ||
    lower.includes('cumi')
  ) {
    return { Icon: Fish, desc: 'Olahan laut segar bebas pengawet' };
  }
  if (
    lower.includes('sapi') ||
    lower.includes('daging') ||
    lower.includes('beef') ||
    lower.includes('sosis')
  ) {
    return { Icon: Beef, desc: 'Potongan & olahan daging pilihan' };
  }
  if (
    lower.includes('bakso') ||
    lower.includes('dimsum') ||
    lower.includes('kuah') ||
    lower.includes('dumpling')
  ) {
    return { Icon: Soup, desc: 'Kenyal, gurih & praktis disajikan' };
  }
  if (
    lower.includes('nugget') ||
    lower.includes('ayam') ||
    lower.includes('chicken') ||
    lower.includes('karaage')
  ) {
    return { Icon: Utensils, desc: 'Lauk praktis favorit keluarga' };
  }
  if (
    lower.includes('kentang') ||
    lower.includes('snack') ||
    lower.includes('camilan') ||
    lower.includes('roti')
  ) {
    return { Icon: Cookie, desc: 'Camilan renyah pendamping santai' };
  }
  return { Icon: Snowflake, desc: 'Kualitas rantai dingin -18°C' };
}

const CUSTOMER_REVIEWS = [
  {
    id: 1,
    name: 'Ibu Ratna Sari',
    role: 'Pelanggan Retail (B2C) • Sleman',
    rating: 5,
    date: '2 hari lalu',
    tag: 'Pengiriman Sameday Cepat',
    comment:
      'Pesan jam 11 siang, jam 1 siang sudah sampai di rumah dalam kondisi masih beku karena kurir tokonya pakai cooler box. Nugget dan dimsumnya segar!',
    verified: true,
  },
  {
    id: 2,
    name: 'Hendra Wijaya (Kedai Dimsum)',
    role: 'Mitra Bisnis (B2B) • Malioboro',
    rating: 5,
    date: '4 hari lalu',
    tag: 'Stok FEFO & Nota PDF',
    comment:
      'Sangat terbantu dengan sistem FEFO Lezzat Frozen Food. Setiap restock untuk kedai, masa kedaluwarsanya selalu panjang dan langsung dapat Nota PDF otomatis.',
    verified: true,
  },
  {
    id: 3,
    name: 'Nadia Putri',
    role: 'Pelanggan Retail (B2C) • Yogyakarta',
    rating: 5,
    date: 'Minggu lalu',
    tag: 'Gratis Ongkir ≤ 5 KM',
    comment:
      'Rumah saya jaraknya 3,8 km dari gudang dan benar-benar dapat Gratis Ongkir! Pembayaran pakai QRIS Midtrans langsung lunas otomatis.',
    verified: true,
  },
  {
    id: 4,
    name: 'Bapak Arifin (Katering Berkah)',
    role: 'Mitra Bisnis (B2B) • Bantul',
    rating: 5,
    date: 'Minggu lalu',
    tag: 'Harga Grosir B2B',
    comment:
      'Begitu login pakai akun B2B, harga grosirnya sangat masuk untuk usaha katering kami. Kualitas bakso sapi dan sosis bratwurst-nya konsisten.',
    verified: true,
  },
];

const emptySubscribe = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function getClientMidnightMs(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export default function HomePage() {
  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const getTotalItems = useCartStore((state) => state.getTotalItems);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );
  const todayMs = useMemo(() => (mounted ? getClientMidnightMs() : null), [mounted]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [addedDealId, setAddedDealId] = useState<string | null>(null);
  const [isDealsPaused, setIsDealsPaused] = useState(false);

  const dealsSliderRef = useRef<HTMLDivElement>(null);

  const scrollDealsSlider = (direction: 'left' | 'right') => {
    const slider = dealsSliderRef.current;
    if (!slider) return;
    const step = 362;
    if (direction === 'right') {
      const isAtEnd =
        slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 24;
      if (isAtEnd) {
        slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slider.scrollBy({ left: step, behavior: 'smooth' });
      }
    } else {
      slider.scrollBy({ left: -step, behavior: 'smooth' });
    }
  };

  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProductCatalogResponse[]>({
    queryKey: ['catalog-products'],
    queryFn: async () => {
      const res = await api.get<ProductCatalogResponse[]>('/api/products');
      return res.data;
    },
  });

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive !== false),
    [products]
  );

  const categories = useMemo(() => {
    const map = new Map<string, { count: number; sampleImg?: string }>();
    activeProducts.forEach((p) => {
      const cat = (p.kategori || 'Lainnya').trim();
      const prev = map.get(cat) || { count: 0, sampleImg: undefined };
      map.set(cat, {
        count: prev.count + 1,
        sampleImg: prev.sampleImg || p.gambar || undefined,
      });
    });
    return Array.from(map.entries()).map(([name, info]) => ({
      name,
      count: info.count,
      sampleImg: info.sampleImg,
    }));
  }, [activeProducts]);

  const fefoDealProducts = useMemo(() => {
    const available = activeProducts.filter((p) => getProductStock(p) > 0);
    const clearanceItems = available.filter((p) => {
      const raw = p as unknown as Record<string, unknown>;
      return Boolean(raw.isClearance);
    });

    const sourceList =
      clearanceItems.length > 0
        ? clearanceItems
        : [...available]
            .sort((a, b) => getProductStock(a) - getProductStock(b))
            .slice(0, 8);

    return sourceList.map((product, idx) => {
      const totalStock = getProductStock(product);
      const fallbackPct = idx % 2 === 0 ? 20 : 15;
      const promo = extractProductPromo(
        product,
        clearanceItems.length > 0 ? undefined : fallbackPct
      );

      const originalPrice = promo.originalPrice ?? product.hargaEceran;
      const discountedPrice = promo.effectivePrice;
      const savedAmount = Math.max(0, originalPrice - discountedPrice);
      const displayStock =
        promo.stokClearance > 0 ? promo.stokClearance : totalStock;

      let daysLeft: number | null = null;
      if (promo.nearestExpDate && todayMs !== null) {
        const expDate = new Date(`${promo.nearestExpDate}T00:00:00`);
        if (!Number.isNaN(expDate.getTime())) {
          const diffDays = Math.ceil(
            (expDate.getTime() - todayMs) / (1000 * 60 * 60 * 24)
          );
          daysLeft = Math.max(0, diffDays);
        }
      }

      return {
        product,
        isRealClearance: promo.isClearance,
        displayStock,
        nearestExpDate: promo.nearestExpDate,
        daysLeft,
        discountPct: promo.discountPercent,
        originalPrice,
        discountedPrice,
        savedAmount,
      };
    });
  }, [activeProducts, todayMs]);

  useEffect(() => {
    if (isDealsPaused || fefoDealProducts.length <= 1) return;
    const timer = setInterval(() => {
      const slider = dealsSliderRef.current;
      if (!slider) return;
      const isAtEnd =
        slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 24;
      if (isAtEnd) {
        slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slider.scrollBy({ left: 362, behavior: 'smooth' });
      }
    }, 3200);

    return () => clearInterval(timer);
  }, [isDealsPaused, fefoDealProducts.length]);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      const matchesCat =
        selectedCategory === 'ALL' ||
        (product.kategori || 'Lainnya').toLowerCase() ===
          selectedCategory.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.namaProduk.toLowerCase().includes(q) ||
        (product.kategori && product.kategori.toLowerCase().includes(q)) ||
        (product.deskripsiProduk &&
          product.deskripsiProduk.toLowerCase().includes(q));

      const matchesStock = !onlyAvailable || getProductStock(product) > 0;

      return matchesCat && matchesSearch && matchesStock;
    });
  }, [activeProducts, selectedCategory, searchQuery, onlyAvailable]);

  const handleQuickAddDeal = (
    product: ProductCatalogResponse,
    discountedPrice: number
  ) => {
    if (getProductStock(product) <= 0) return;
    addItem(
      {
        ...product,
        hargaEceran: discountedPrice,
      },
      1
    );
    setAddedDealId(product.idProduk);
    setTimeout(() => setAddedDealId(null), 1300);
  };

  const totalCartItems = mounted ? getTotalItems() : 0;
  void items;

  return (
    <div className="lezzat-shell">
      <ShopSidebar />

      <main className="lezzat-main">
        <div className="max-w-[1200px] mx-auto space-y-5 sm:space-y-6">
          <IncompleteProfileBanner />

          {/* Header Bar Pencarian, Foto Profil & Keranjang */}
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-xl">
              <Search className="w-4 h-4 text-[#5F6479] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari bakso, nugget, dimsum, sosis premium..."
                className="w-full min-h-[40px] rounded-xl border border-[#E6E8F0] bg-slate-50 focus:bg-white pl-10 pr-3.5 py-2 text-sm text-[#171725] placeholder:text-[#5F6479] focus:border-[#4737FF] focus-visible:outline-2 focus-visible:outline-[#4737FF] transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5">
              {mounted && user && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-[#E6E8F0] text-sm">
                  <CustomerAvatar
                    user={user as unknown as Record<string, unknown>}
                    size="sm"
                    enablePreview
                  />
                  <Link
                    href="/profile"
                    className="hidden sm:flex items-center gap-1.5 hover:text-[#4737FF] transition-colors"
                  >
                    <span className="text-[#4B5068]">Halo,</span>
                    <strong className="font-semibold text-[#171725]">
                      {user.nama}
                    </strong>
                    <span className="px-2 py-0.5 rounded-md bg-[#4737FF]/10 text-[#4737FF] text-xs font-bold">
                      {user.tipeAkun}
                    </span>
                  </Link>
                </div>
              )}

              <Link
                href="/checkout"
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F75C03] hover:bg-[#D94800] text-white text-sm font-semibold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Keranjang</span>
                <span className="px-2 py-0.5 rounded-md bg-white text-[#C2410C] text-xs font-bold tabular-nums">
                  {totalCartItems}
                </span>
              </Link>
            </div>
          </div>

          {/* Banner Hero Ringkas + Running Marquee */}
          <HeroCarousel featuredProducts={activeProducts} />

          {/* Strip Keunggulan Utama */}
          <section className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E6E8F0]">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Produk Berkualitas',
                  desc: 'Bahan pilihan berkualitas tinggi & bersertifikasi higienis.',
                },
                {
                  icon: Snowflake,
                  title: 'Suhu -18°C Terjaga',
                  desc: 'Freezer dikontrol ketat dengan rotasi stok terjadwal.',
                },
                {
                  icon: Truck,
                  title: 'Pengiriman Aman',
                  desc: 'Kurir berinsulasi menjaga kesegaran hingga pintu Anda.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Belanja Praktis',
                  desc: 'Pemesanan cepat, transparan & nota PDF otomatis.',
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className={`flex items-start gap-3 ${
                      idx > 0 ? 'pt-3 sm:pt-0 sm:pl-4' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#4737FF]/10 text-[#4737FF] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-semibold text-[#171725]">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#4B5068] mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 1. SHOP BY CATEGORY */}
          {categories.length > 0 && (
            <section
              id="kategori-pilihan"
              className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="ff-eyebrow inline-flex items-center gap-1.5 text-xs font-semibold text-[#4737FF]">
                    <Sparkles className="w-3.5 h-3.5 text-[#F75C03]" />
                    <span>SHOP BY CATEGORY</span>
                  </span>
                  <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#171725] mt-0.5">
                    Belanja Berdasarkan Kategori
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    document
                      .getElementById('katalog-produk')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-sm font-semibold text-[#4737FF] hover:underline cursor-pointer"
                >
                  Semua Kategori ({activeProducts.length}) →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {categories.map((cat) => {
                  const visual = getCategoryVisual(cat.name);
                  const Icon = visual.Icon;
                  const isSelected = selectedCategory === cat.name;

                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(isSelected ? 'ALL' : cat.name);
                        document
                          .getElementById('katalog-produk')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`group text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[120px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
                        isSelected
                          ? 'bg-[#4737FF] border-[#4737FF] text-white shadow-xs'
                          : 'bg-slate-50 border-[#E6E8F0] hover:bg-[#4737FF]/8 hover:border-[#4737FF]/30 text-[#171725]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[#4737FF]/10 text-[#4737FF]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-[#4B5068] border border-[#E6E8F0]'
                          }`}
                        >
                          {cat.count} item
                        </span>
                      </div>

                      <div className="mt-3">
                        <p
                          className={`font-heading text-sm font-semibold line-clamp-1 ${
                            isSelected ? 'text-white' : 'text-[#171725]'
                          }`}
                        >
                          {cat.name}
                        </p>
                        <p
                          className={`text-xs line-clamp-1 mt-0.5 ${
                            isSelected ? 'text-white/85' : 'text-[#5F6479]'
                          }`}
                        >
                          {visual.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. FEFO FLASH FOOD DEALS */}
          {fefoDealProducts.length > 0 && (
            <section
              id="fefo-deals"
              onMouseEnter={() => setIsDealsPaused(true)}
              onMouseLeave={() => setIsDealsPaused(false)}
              className="relative rounded-2xl overflow-hidden border border-[#F75C03]/40 shadow-xs text-white"
              style={{
                background:
                  'linear-gradient(135deg, #F75C03 0%, #D93800 50%, #3529BF 100%)',
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(255, 255, 255, 0.75) 1px, transparent 1px), repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 8px, transparent 8px, transparent 16px)',
                  backgroundSize: '14px 14px, 100% 100%',
                }}
              />

              {/* Pita Teks Berjalan Diskon Spesial */}
              <div className="relative z-10 bg-black/20 backdrop-blur-xs border-b border-white/15 py-2 overflow-hidden">
                <div className="ff-marquee-track">
                  {[...DEALS_MARQUEE_TEXTS, ...DEALS_MARQUEE_TEXTS].map(
                    (text, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-2 px-5 text-xs font-bold text-amber-200 whitespace-nowrap tracking-wide"
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
                        <span>{text}</span>
                        <span className="text-white/50 ml-3">•</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="relative z-10 p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/20">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-300 text-[#171725] text-xs font-bold uppercase tracking-wider shadow-2xs">
                        <Zap className="w-3.5 h-3.5 fill-[#171725]" />
                        <span>BIG DEALS • FLASH SALE</span>
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/15 border border-white/20 text-xs font-semibold text-white">
                        <Snowflake className="w-3.5 h-3.5 text-amber-300" />
                        <span>Kualitas Fresh -18°C Terjamin</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-300/30 text-xs font-bold text-emerald-100">
                        <span>
                          {isDealsPaused ? '⏸ Dijeda' : '▶ Geser Otomatis'}
                        </span>
                      </span>
                    </div>

                    <h2 className="font-heading text-lg sm:text-xl font-bold text-white">
                      Penawaran Batch Prioritas (H-30 Diskon 20% • Clearance H-7 Diskon 50%)
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-white/90 mr-1 hidden md:inline tabular-nums">
                      {fefoDealProducts.length} produk promo
                    </span>
                    <button
                      type="button"
                      onClick={() => scrollDealsSlider('left')}
                      aria-label="Geser produk promo ke kiri"
                      className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollDealsSlider('right')}
                      aria-label="Geser produk promo ke kanan"
                      className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={dealsSliderRef}
                  className="flex items-stretch gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {fefoDealProducts.map(
                    ({
                      product,
                      displayStock,
                      nearestExpDate,
                      daysLeft,
                      discountPct,
                      originalPrice,
                      discountedPrice,
                      savedAmount,
                    }) => {
                      const isAdded = addedDealId === product.idProduk;
                      const imgUrl = resolveProductImageUrl(product.gambar);
                      const dealExpInfo = formatProductExpDate(
                        nearestExpDate,
                        daysLeft
                      );

                      return (
                        <div
                          key={product.idProduk}
                          className="w-[320px] sm:w-[360px] shrink-0 snap-start group rounded-2xl bg-white text-[#171725] p-3.5 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
                        >
                          <Link
                            href={`/products/${product.idProduk}`}
                            className="relative w-26 h-26 rounded-xl bg-slate-100 overflow-hidden block shrink-0"
                          >
                            {imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgUrl}
                                alt={product.namaProduk}
                                className="w-full h-full object-cover motion-safe:group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#4737FF]/40">
                                <Snowflake className="w-6 h-6" />
                              </div>
                            )}

                            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F75C03] text-white text-xs font-bold shadow-2xs tabular-nums">
                              <Tag className="w-3 h-3" />
                              <span>-{discountPct}%</span>
                            </div>

                            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                              <span className="px-2 py-0.5 rounded-md bg-white/95 text-[#C2410C] text-xs font-bold truncate shadow-2xs tabular-nums">
                                {dealExpInfo
                                  ? `Exp ${dealExpInfo.formatted}`
                                  : daysLeft !== null
                                    ? `Exp ${daysLeft} hari`
                                    : 'Promo Batch'}
                              </span>
                            </div>
                          </Link>

                          <div className="flex-1 min-w-0 flex flex-col justify-between h-full space-y-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-semibold text-[#4737FF] truncate">
                                  {product.kategori || 'Frozen Food'}
                                </span>
                                {savedAmount > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#C2410C] text-xs font-bold shrink-0 tabular-nums">
                                    Hemat {formatRupiah(savedAmount)}
                                  </span>
                                )}
                              </div>

                              <Link
                                href={`/products/${product.idProduk}`}
                                className="font-heading text-sm font-semibold text-[#171725] hover:text-[#4737FF] line-clamp-1 block"
                              >
                                {product.namaProduk}
                              </Link>

                              <div className="pt-0.5">
                                <div className="flex justify-between text-xs text-[#5F6479] mb-1 tabular-nums">
                                  <span>Stok Promo</span>
                                  <span className="font-semibold text-[#C2410C]">
                                    Sisa {displayStock} pack
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#F75C03] to-amber-500 rounded-full"
                                    style={{
                                      width: `${Math.min(
                                        90,
                                        Math.max(25, 100 - displayStock)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#E6E8F0] flex flex-wrap items-end justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2 leading-none">
                                  <span className="text-[13px] text-[#5F6479] line-through font-medium tabular-nums">
                                    {formatRupiah(originalPrice)}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#FFEDD5] text-[#C2410C] text-xs font-bold leading-none tabular-nums">
                                    -{discountPct}%
                                  </span>
                                </div>
                                <span className="font-heading text-base font-bold text-[#C2410C] block mt-0.5 tabular-nums">
                                  {formatRupiah(discountedPrice)}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickAddDeal(product, discountedPrice)
                                }
                                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-2xs ${
                                  isAdded
                                    ? 'bg-[#159A68] text-white'
                                    : 'bg-[#F75C03] hover:bg-[#D94800] text-white'
                                }`}
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>
                                  {isAdded ? 'Masuk!' : '+ Ambil Deal'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 3. C. KATALOG LENGKAP FROZEN FOOD & TAB KATEGORI */}
          <section id="katalog-produk" className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-[#171725]">
                    Katalog Lengkap Lezzat Frozen Food
                  </h2>
                  <p className="text-sm text-[#5F6479] mt-0.5">
                    Menampilkan {filteredProducts.length} produk dari inventori
                    aktif siap kirim
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#4737FF]/10 text-[#4737FF] text-sm font-semibold cursor-pointer"
                    >
                      Filter: {selectedCategory} ✕
                    </button>
                  )}

                  <label className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-[#E6E8F0] text-sm font-medium text-[#171725] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyAvailable}
                      onChange={(e) => setOnlyAvailable(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#4737FF]"
                    />
                    <span>Stok Tersedia</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-[#E6E8F0] text-sm font-medium text-[#171725] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                  >
                    <RefreshCw className="w-4 h-4 text-[#4737FF]" />
                    <span>Segarkan</span>
                  </button>
                </div>
              </div>

              {/* Tab Kategori: 14px, berat 500 (aktif 600), tinggi >= 40px, scroll-snap di mobile */}
              {categories.length > 0 && (
                <div
                  role="tablist"
                  aria-label="Filter kategori produk"
                  className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth pt-1 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === 'ALL'}
                    onClick={() => setSelectedCategory('ALL')}
                    className={`snap-start min-h-[40px] px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
                      selectedCategory === 'ALL'
                        ? 'bg-[#4737FF] text-white font-semibold shadow-2xs'
                        : 'bg-slate-50 border border-[#E6E8F0] text-[#4B5068] font-medium hover:bg-slate-100 hover:text-[#171725]'
                    }`}
                  >
                    Semua ({activeProducts.length})
                  </button>
                  {categories.map((cat) => {
                    const isActive = selectedCategory === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`snap-start min-h-[40px] px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
                          isActive
                            ? 'bg-[#4737FF] text-white font-semibold shadow-2xs'
                            : 'bg-slate-50 border border-[#E6E8F0] text-[#4B5068] font-medium hover:bg-slate-100 hover:text-[#171725]'
                        }`}
                      >
                        {cat.name} ({cat.count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isLoading && (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div
                    key={n}
                    className="rounded-2xl border border-[#E6E8F0] bg-white h-80 animate-pulse p-4 space-y-3"
                  >
                    <div className="h-40 rounded-xl bg-slate-100" />
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                    <div className="h-5 w-1/2 rounded bg-slate-100" />
                    <div className="h-10 w-full rounded-xl bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && isError && (
              <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-6 text-center max-w-md mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <h3 className="font-heading text-base font-bold text-[#171725] mb-1">
                  Gagal Memuat Katalog Produk
                </h3>
                <p className="text-sm text-[#4B5068] mb-4">
                  {getErrorMessage(
                    error,
                    'Pastikan server backend sedang berjalan.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#4737FF] text-white text-sm font-semibold cursor-pointer"
                >
                  Muat Ulang Katalog
                </button>
              </div>
            )}

            {!isLoading && !isError && filteredProducts.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-8 text-center">
                <Layers className="w-8 h-8 text-[#4737FF]/50 mx-auto mb-2" />
                <h3 className="font-heading text-base font-bold text-[#171725] mb-1">
                  Produk Tidak Ditemukan
                </h3>
                <p className="text-sm text-[#4B5068] mb-4">
                  Coba ubah kata kunci pencarian atau reset filter kategori.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setOnlyAvailable(false);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#4737FF] text-white text-sm font-semibold cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            )}

            {/* Grid Katalog: 2 kolom di mobile & sm, 3 kolom di lg (>=1024px), 4 kolom di xl (>=1280px) */}
            {!isLoading && !isError && filteredProducts.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.idProduk} product={product} />
                ))}
              </div>
            )}
          </section>

          {/* 4. PENILAIAN & ULASAN PELANGGAN */}
          <section
            id="ulasan-pelanggan"
            className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-4 sm:p-5 space-y-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pb-4 border-b border-[#E6E8F0]">
              <div className="lg:col-span-5 flex items-center gap-4">
                <div className="w-18 h-18 rounded-2xl bg-[#4737FF] text-white flex flex-col items-center justify-center shrink-0 p-3 tabular-nums">
                  <span className="font-heading text-2xl font-bold leading-none">
                    4.9
                  </span>
                  <span className="text-xs text-white/85 mt-1">
                    dari 5.0
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#159A68] text-xs font-bold">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>99% Pelanggan Puas</span>
                  </span>
                  <h2 className="font-heading text-lg sm:text-xl font-bold text-[#171725]">
                    Penilaian Toko dari Pelanggan
                  </h2>
                  <p className="text-sm text-[#5F6479]">
                    Ulasan terverifikasi pelanggan B2C &amp; mitra usaha B2B.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E6E8F0]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#171725]">
                      Suhu Beku
                    </span>
                    <span className="font-bold text-[#159A68] tabular-nums">
                      5.0 ★
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5068]">
                    Tetap -18°C saat tiba
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E6E8F0]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#171725]">
                      Kurir Toko
                    </span>
                    <span className="font-bold text-[#4737FF] tabular-nums">
                      4.9 ★
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5068]">
                    Tepat sesuai estimasi WIB
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E6E8F0]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#171725]">
                      Kualitas Stok
                    </span>
                    <span className="font-bold text-[#4737FF] tabular-nums">
                      4.9 ★
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5068]">
                    Masa kedaluwarsa panjang
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {CUSTOMER_REVIEWS.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-xl bg-slate-50 border border-[#E6E8F0] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5 text-[#F75C03]">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star
                            key={i}
                            className="w-3.5 h-3.5 fill-[#F75C03] text-[#F75C03]"
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[#5F6479]">{rev.date}</span>
                    </div>

                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#4737FF]/10 text-[#4737FF] text-xs font-semibold">
                      {rev.tag}
                    </span>

                    <p className="text-sm text-[#4B5068] leading-relaxed">
                      <Quote className="w-3.5 h-3.5 text-[#5F6479] inline mr-1 -mt-0.5" />
                      {rev.comment}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[#E6E8F0] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#171725] truncate">
                        {rev.name}
                      </p>
                      <p className="text-xs text-[#5F6479] truncate">
                        {rev.role}
                      </p>
                    </div>
                    {rev.verified && (
                      <span
                        title="Transaksi Terverifikasi"
                        className="w-6 h-6 rounded-full bg-emerald-50 text-[#159A68] flex items-center justify-center shrink-0"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. TENTANG LEZZAT FROZEN FOOD */}
          <section className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-7 space-y-2.5">
              <span className="ff-eyebrow inline-block px-2.5 py-0.5 rounded-md bg-[#4737FF]/10 text-[#4737FF] text-xs font-semibold">
                TENTANG LEZZAT FROZEN FOOD
              </span>
              <h2 className="font-heading text-lg sm:text-xl font-bold text-[#171725]">
                Solusi Rantai Dingin Terpadu untuk Rumah Tangga &amp; Bisnis Kuliner
              </h2>
              <p className="text-sm text-[#4B5068] leading-relaxed">
                <strong>Lezzat Frozen Food (Froznfood 2.0)</strong>{' '}
                mengintegrasikan manajemen inventori berdasarkan masa kedaluwarsa
                terdekat dengan pengiriman berpendingin. Baik untuk belanja rumah
                tangga (B2C) maupun pasokan rutin restoran, kafe, dan reseller
                (B2B).
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/register"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4737FF] hover:bg-[#3529BF] text-white text-sm font-semibold transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Gabung Mitra B2B / Pelanggan</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/orders"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#171725] text-sm font-semibold transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#4737FF]" />
                  <span>Lacak Pesanan &amp; Nota PDF</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E6E8F0] space-y-1">
                <div className="w-8 h-8 rounded-lg bg-[#4737FF]/10 text-[#4737FF] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="font-heading font-semibold text-[#171725]">
                  Jadwal Sameday
                </p>
                <p className="text-xs text-[#4B5068] leading-relaxed">
                  Buka 09.00–21.00 WIB. Pesan sebelum 15.00 WIB dikirim hari ini.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E6E8F0] space-y-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#159A68] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="font-heading font-semibold text-[#171725]">
                  Nota PDF Resmi
                </p>
                <p className="text-xs text-[#4B5068] leading-relaxed">
                  Pembayaran QRIS &amp; VA Midtrans disertai unduhan invoice PDF.
                </p>
              </div>
            </div>
          </section>

          <ShopFooter />
        </div>
      </main>
    </div>
  );
}
