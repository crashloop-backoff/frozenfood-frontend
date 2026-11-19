'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  useCallback,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle,
  X,
  Send,
  Snowflake,
  Sparkles,
  Tag,
  ExternalLink,
  Check,
  CheckCheck,
  Store,
  LogIn,
  Maximize2,
  Minimize2,
  Clock,
  Package,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/axios';
import { OrderResponse } from '@/types/api';
import { useAuthStore } from '@/store/auth-store';
import { formatRupiah } from '@/lib/utils';
import { resolveProductImageUrl } from '@/components/shop/product-card';
import {
  useChatStore,
  STORE_OPERATING_HOURS,
  AttachedProductInfo,
  ChatMessageItem,
  fetchCustomerMessages,
  sendChatMessage,
  markCustomerMessagesRead,
} from '@/store/chat-store';

export { STORE_OPERATING_HOURS };

function checkStoreOnline(): boolean {
  if (typeof window === 'undefined') return true;
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: STORE_OPERATING_HOURS.timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hourWib = Number(formatter.format(now));
    if (!Number.isNaN(hourWib)) {
      return (
        hourWib >= STORE_OPERATING_HOURS.openHour &&
        hourWib < STORE_OPERATING_HOURS.closeHour
      );
    }
  } catch {
    // Fallback ke jam lokal perangkat
  }
  const localHour = now.getHours();
  return (
    localHour >= STORE_OPERATING_HOURS.openHour &&
    localHour < STORE_OPERATING_HOURS.closeHour
  );
}

const CHAT_POS_STORAGE_KEY = 'froznfood-chat-pos';
const LAST_ROUTE_STORAGE_KEY = 'froznfood-chat-prev-route';
const PANEL_MARGIN = 16;
const DEFAULT_PANEL_WIDTH = 400;
const DEFAULT_PANEL_HEIGHT = 600;

interface FloatingPosition {
  x: number;
  y: number;
}

function clampFloatingPosition(
  pos: FloatingPosition,
  panelWidth: number = DEFAULT_PANEL_WIDTH,
  panelHeight: number = DEFAULT_PANEL_HEIGHT
): FloatingPosition {
  if (typeof window === 'undefined') return pos;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const effectiveWidth = Math.min(panelWidth, vw - PANEL_MARGIN * 2);
  const effectiveHeight = Math.min(panelHeight, vh - PANEL_MARGIN * 2);

  const minX = PANEL_MARGIN;
  const maxX = Math.max(PANEL_MARGIN, vw - effectiveWidth - PANEL_MARGIN);
  const minY = PANEL_MARGIN;
  const maxY = Math.max(PANEL_MARGIN, vh - effectiveHeight - PANEL_MARGIN);

  return {
    x: Math.round(Math.min(Math.max(pos.x, minX), maxX)),
    y: Math.round(Math.min(Math.max(pos.y, minY), maxY)),
  };
}

function readSavedChatPosition(): FloatingPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHAT_POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FloatingPosition>;
    if (
      typeof parsed?.x === 'number' &&
      Number.isFinite(parsed.x) &&
      typeof parsed?.y === 'number' &&
      Number.isFinite(parsed.y)
    ) {
      return clampFloatingPosition({ x: parsed.x, y: parsed.y });
    }
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
  return null;
}

function writeSavedChatPosition(pos: FloatingPosition | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (pos === null) {
      window.localStorage.removeItem(CHAT_POS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CHAT_POS_STORAGE_KEY, JSON.stringify(pos));
    }
  } catch {
    // Abaikan jika localStorage penuh / diblokir
  }
}

function getOrderStatusBadgeStyle(status: string): string {
  const s = (status || '').toUpperCase();
  if (s === 'LUNAS' || s === 'DIBAYAR' || s === 'SELESAI') {
    return 'bg-emerald-50 text-[#159A68] border-emerald-200';
  }
  if (s === 'DIPROSES' || s === 'DIKIRIM') {
    return 'bg-[#4737FF]/10 text-[#4737FF] border-[#4737FF]/25';
  }
  if (s === 'DIBATALKAN' || s === 'GAGAL' || s === 'EXPIRED') {
    return 'bg-red-50 text-red-600 border-red-200';
  }
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

const emptySubscribe = () => () => {};
void Sparkles;
void Tag;
void ExternalLink;

const BASE_QUICK_REPLIES = [
  'Stok masih tersedia?',
  'Bisa dikirim Sameday hari ini?',
  'Kapan Exp batch terdekat?',
] as const;

export interface ChatWidgetProps {
  isDesktopSidebarHidden?: boolean;
  embeddedExpanded?: boolean;
}

export default function ChatWidget({
  embeddedExpanded = false,
}: ChatWidgetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const {
    mode,
    isOpen,
    pendingProduct,
    setMode,
    openChat,
    closeChat,
    clearPendingProduct,
  } = useChatStore();

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isOnChatRoute =
    pathname === '/chat' || pathname.startsWith('/chat/');

  const [isOnline, setIsOnline] = useState<boolean>(() => checkStoreOnline());
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dismissedContextKey, setDismissedContextKey] = useState<string | null>(
    null
  );

  // State khusus fitur Draggable (hanya aktif di mode floating pada desktop >= 1024px)
  const [isDesktopLg, setIsDesktopLg] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  const [floatingPos, setFloatingPos] = useState<FloatingPosition | null>(() =>
    readSavedChatPosition()
  );
  const [isDragging, setIsDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
    width: number;
    height: number;
  } | null>(null);

  // Simpan route storefront terakhir di luar /chat agar tombol X / Kecilkan bisa kembali dengan akurat
  useEffect(() => {
    if (!pathname) return;
    if (!isOnChatRoute) {
      try {
        window.sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, pathname);
      } catch {
        // Abaikan
      }
      if (mode === 'expanded') {
        setMode('minimized');
      }
    } else if (embeddedExpanded && mode !== 'expanded') {
      setMode('expanded');
    }
  }, [pathname, isOnChatRoute, embeddedExpanded, mode, setMode]);

  // Kunci scroll body saat berada di halaman /chat agar halaman lain tidak pernah ikut ter-scroll
  useEffect(() => {
    if (!embeddedExpanded) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [embeddedExpanded]);

  // Perbarui status jam operasional secara berkala
  useEffect(() => {
    const statusTimer = setInterval(() => {
      setIsOnline(checkStoreOnline());
    }, 60_000);
    return () => clearInterval(statusTimer);
  }, []);

  // Hitung ulang batas viewport (clamp) saat window di-resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const desktopNow = window.innerWidth >= 1024;
      setIsDesktopLg(desktopNow);
      setFloatingPos((prev) => {
        if (!prev) return null;
        const rect = panelRef.current?.getBoundingClientRect();
        const clamped = clampFloatingPosition(
          prev,
          rect?.width || DEFAULT_PANEL_WIDTH,
          rect?.height || DEFAULT_PANEL_HEIGHT
        );
        writeSavedChatPosition(clamped);
        return clamped;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pastikan user-select selalu dibersihkan bila komponen unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = '';
      }
    };
  }, []);

  const navigateBackOrHome = useCallback(() => {
    let hasSavedPrevRoute = false;
    try {
      const saved = window.sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY);
      if (saved && saved !== '/chat') {
        hasSavedPrevRoute = true;
      }
    } catch {
      // Abaikan
    }

    if (
      typeof window !== 'undefined' &&
      window.history.length > 1 &&
      hasSavedPrevRoute
    ) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  const handleExpandToRoute = useCallback(() => {
    setMode('expanded');
    if (!isOnChatRoute) {
      router.push('/chat');
    }
  }, [setMode, isOnChatRoute, router]);

  const handleShrinkToFloating = useCallback(() => {
    setMode('floating');
    if (isOnChatRoute) {
      navigateBackOrHome();
    }
  }, [setMode, isOnChatRoute, navigateBackOrHome]);

  const handleCloseExpandedOrFloating = useCallback(() => {
    closeChat();
    if (isOnChatRoute) {
      navigateBackOrHome();
    }
  }, [closeChat, isOnChatRoute, navigateBackOrHome]);

  // Tombol Escape: di mode expanded kembali ke floating; di mode floating kembali ke minimized
  useEffect(() => {
    const activeView = embeddedExpanded
      ? 'expanded'
      : isOnChatRoute
        ? 'none'
        : mode;
    if (activeView === 'minimized' || activeView === 'none') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeView === 'expanded') {
          handleShrinkToFloating();
        } else {
          closeChat();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    embeddedExpanded,
    isOnChatRoute,
    mode,
    handleShrinkToFloating,
    closeChat,
  ]);

  // Fokus otomatis ke input saat panel dibuka atau setelah berganti mode
  useEffect(() => {
    const isVisibleNow = embeddedExpanded || (!isOnChatRoute && mode !== 'minimized');
    if (!isVisibleNow || !user) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 90);
    return () => clearTimeout(timer);
  }, [embeddedExpanded, isOnChatRoute, mode, user, pendingProduct]);

  const customerId =
    user?.idUser || user?.email || 'guest-customer';

  // Muat pesan & polling setiap 2.5 detik
  useEffect(() => {
    if (!mounted || !user) return;
    if (!embeddedExpanded && isOnChatRoute) return;

    const shouldMarkRead = embeddedExpanded || isOpen;

    const load = async () => {
      const list = await fetchCustomerMessages(customerId);
      setMessages(list);
      if (shouldMarkRead) {
        await markCustomerMessagesRead(customerId, 'CUSTOMER');
      }
    };

    load();
    const timer = setInterval(load, 2500);
    const handleStorage = () => load();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('ff-chat-updated', handleStorage);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('ff-chat-updated', handleStorage);
    };
  }, [mounted, user, customerId, isOpen, embeddedExpanded, isOnChatRoute]);

  // Auto-scroll ke pesan terbaru saat dibuka, ganti mode, atau ada pesan baru
  useEffect(() => {
    const isVisibleNow = embeddedExpanded || (!isOnChatRoute && mode !== 'minimized');
    if (isVisibleNow) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [
    embeddedExpanded,
    isOnChatRoute,
    mode,
    messages.length,
    pendingProduct,
    isSending,
  ]);

  // Query 3 pesanan terakhir pelanggan untuk panel info di mode expanded (jika tersedia)
  const { data: myOrders = [] } = useQuery<OrderResponse[]>({
    queryKey: ['my-orders', user?.idUser],
    queryFn: async () => {
      const res = await api.get<OrderResponse[]>('/api/orders/my');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(mounted && user && embeddedExpanded),
    staleTime: 60_000,
    retry: false,
  });

  const recentOrders = useMemo(() => {
    if (!Array.isArray(myOrders) || myOrders.length === 0) return [];
    return [...myOrders]
      .sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      )
      .slice(0, 3);
  }, [myOrders]);

  // Sampai 3 produk terakhir yang ditanyakan (tanpa duplikat, yang terbaru di atas)
  const recentInquiredProducts = useMemo<AttachedProductInfo[]>(() => {
    const list: AttachedProductInfo[] = [];
    const seen = new Set<string>();

    if (pendingProduct && pendingProduct.idProduk) {
      seen.add(pendingProduct.idProduk);
      list.push(pendingProduct);
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const prod = messages[i].attachedProduct;
      if (prod && prod.idProduk && !seen.has(prod.idProduk)) {
        seen.add(prod.idProduk);
        list.push(prod);
        if (list.length >= 3) break;
      }
    }

    return list;
  }, [pendingProduct, messages]);

  const quickReplies = useMemo(() => {
    const roleChip =
      user?.tipeAkun === 'B2B'
        ? 'Ada harga grosir?'
        : 'Berapa ongkir ke alamatku?';
    return [...BASE_QUICK_REPLIES, roleChip];
  }, [user?.tipeAkun]);

  // Handler Drag pada Header (hanya mode floating & desktop >= 1024px)
  const finishDrag = useCallback((pointerId?: number) => {
    const state = dragStateRef.current;
    if (!state) return;
    if (pointerId !== undefined && state.pointerId !== pointerId) return;

    dragStateRef.current = null;
    setIsDragging(false);
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = '';
    }
  }, []);

  const handleHeaderPointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (embeddedExpanded || mode !== 'floating') return;
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) return;

    const panelEl = panelRef.current;
    if (!panelEl) return;

    const rect = panelEl.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Abaikan jika gagal setPointerCapture
    }

    setIsDragging(true);
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none';
    }
  };

  const handleHeaderPointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    const nextPos = clampFloatingPosition(
      {
        x: state.startLeft + (e.clientX - state.startClientX),
        y: state.startTop + (e.clientY - state.startClientY),
      },
      state.width,
      state.height
    );
    setFloatingPos(nextPos);
  };

  const handleHeaderPointerUp = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Abaikan
    }

    const finalPos = clampFloatingPosition(
      {
        x: state.startLeft + (e.clientX - state.startClientX),
        y: state.startTop + (e.clientY - state.startClientY),
      },
      state.width,
      state.height
    );

    finishDrag(e.pointerId);
    setFloatingPos(finalPos);
    writeSavedChatPosition(finalPos);
  };

  const handleHeaderPointerCancel = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    finishDrag(e.pointerId);
  };

  const handleHeaderDoubleClick = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (embeddedExpanded || mode !== 'floating') return;
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) return;

    finishDrag();
    setFloatingPos(null);
    writeSavedChatPosition(null);
  };

  if (!mounted) return null;

  // Jangan tampilkan widget pelanggan jika yang login adalah ADMIN
  if (user?.tipeAkun === 'ADMIN') return null;

  // Jika ini instance global di Sidebar dan sedang berada di route /chat, biarkan instance halaman /chat yang tampil
  if (!embeddedExpanded && isOnChatRoute) return null;

  const unreadFromAdmin = messages.filter(
    (m) => m.senderRole === 'ADMIN' && !m.isRead
  ).length;

  const currentContextKey = pendingProduct
    ? `product:${pendingProduct.idProduk}`
    : 'general';
  const hasCustomerSentMessage = messages.some(
    (m) => m.senderRole === 'CUSTOMER'
  );
  const showQuickReplies =
    dismissedContextKey !== currentContextKey &&
    dismissedContextKey !== 'all' &&
    (!hasCustomerSentMessage || Boolean(pendingProduct));

  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const isWaitingForAdminReply =
    !isSending && lastMessage?.senderRole === 'CUSTOMER';

  const handleSend = async (customText?: string) => {
    if (!user) return;
    const textToSend = (customText ?? inputText).trim();
    if (!textToSend && !pendingProduct) return;

    const productSnapshot = pendingProduct ? { ...pendingProduct } : null;
    const defaultProductQuestion = productSnapshot
      ? `Halo Admin, saya ingin menanyakan tentang ${productSnapshot.namaProduk}.`
      : '';

    setDismissedContextKey(currentContextKey);
    setInputText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    clearPendingProduct();
    setIsSending(true);

    try {
      const saved = await sendChatMessage({
        idCustomer: customerId,
        namaCustomer: user.nama || 'Pelanggan',
        emailCustomer: user.email,
        tipeAkun: user.tipeAkun || 'B2C',
        senderRole: 'CUSTOMER',
        pesan: textToSend || defaultProductQuestion,
        attachedProduct: productSnapshot,
      });

      const updated = await fetchCustomerMessages(customerId);
      setMessages(updated.length > 0 ? updated : [saved]);
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && inputText.trim()) {
        handleSend();
      }
    }
  };

  const isExpanded = embeddedExpanded;
  const isFloating = !embeddedExpanded && mode !== 'minimized';

  // Inline style untuk posisi custom saat di-drag pada desktop (>= 1024px) di mode floating
  const floatingDragStyle: React.CSSProperties | undefined =
    isFloating && isDesktopLg && floatingPos
      ? {
          left: `${floatingPos.x}px`,
          top: `${floatingPos.y}px`,
          right: 'auto',
          bottom: 'auto',
        }
      : undefined;

  return (
    <>
      {/* MODE 1: "minimized" — Launcher Pill di Pojok Kanan Bawah */}
      {!embeddedExpanded && mode === 'minimized' && (
        <button
          type="button"
          onClick={() => {
            openChat();
            setMode('floating');
          }}
          aria-label={
            unreadFromAdmin > 0
              ? `Chat Admin (${unreadFromAdmin} pesan belum dibaca)`
              : 'Chat Admin — Tanya stok & ongkir'
          }
          className="ff-chat-launcher fixed bottom-5 right-5 z-50 inline-flex items-center justify-center sm:justify-start gap-2.5 w-13 h-13 sm:w-auto sm:h-auto p-0 sm:px-4 sm:py-2.5 rounded-full bg-[#4737FF] hover:bg-[#3529BF] text-white shadow-xl shadow-[#4737FF]/30 border border-white/15 transition-all duration-150 motion-reduce:transition-none cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
        >
          <span className="relative flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white/15 shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
            {unreadFromAdmin > 0 && (
              <span
                aria-label={`${unreadFromAdmin} pesan belum dibaca`}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F75C03] text-white text-[10px] font-extrabold flex items-center justify-center leading-none ring-2 ring-[#4737FF]"
              >
                {unreadFromAdmin > 99 ? '99+' : unreadFromAdmin}
              </span>
            )}
          </span>
          <span className="hidden sm:block text-left pr-0.5">
            <span className="block font-heading text-xs font-extrabold leading-tight text-white">
              Chat Admin
            </span>
            <span className="block text-[11px] text-white/85 leading-tight mt-0.5">
              Tanya stok &amp; ongkir
            </span>
          </span>
        </button>
      )}

      {/* MODE 2 ("floating") & MODE 3 ("expanded" di halaman /chat) */}
      {(isFloating || isExpanded) && (
        <div
          className={
            isExpanded
              ? 'ff-chat-expanded w-full h-dvh sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-2.5rem)] max-h-full min-h-0 flex flex-col overflow-hidden'
              : 'contents'
          }
        >
          <div
            className={
              isExpanded
                ? 'w-full max-w-[1080px] mx-auto flex-1 h-full min-h-0 flex items-stretch gap-5 overflow-hidden'
                : 'contents'
            }
          >
            {/* Kolom Utama Chat (Floating Panel 400px ATAU Kolom Kiri Mode Expanded max-w 720px) */}
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              aria-label="Chat dengan admin toko"
              style={floatingDragStyle}
              className={
                isExpanded
                  ? 'w-full lg:max-w-[720px] flex-1 min-w-0 h-full min-h-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all duration-150 ease-out motion-reduce:transition-none'
                  : `ff-chat-panel fixed inset-0 sm:inset-auto sm:bottom-5 sm:right-5 z-50 w-full h-dvh sm:w-[400px] sm:max-w-[calc(100vw-2rem)] sm:h-[min(600px,calc(100dvh-2.5rem))] min-h-0 rounded-none sm:rounded-2xl bg-white sm:border sm:border-slate-200 shadow-2xl flex flex-col overflow-hidden ${
                      isDragging
                        ? 'transition-none'
                        : 'transition-[width,height,transform,opacity] duration-150 ease-out motion-reduce:transition-none'
                    }`
              }
            >
              {/* Header Chat (Draggable pada mode floating desktop >= 1024px) */}
              <div
                onPointerDown={handleHeaderPointerDown}
                onPointerMove={handleHeaderPointerMove}
                onPointerUp={handleHeaderPointerUp}
                onPointerCancel={handleHeaderPointerCancel}
                onDoubleClick={handleHeaderDoubleClick}
                title={
                  isFloating && isDesktopLg
                    ? 'Geser untuk memindahkan panel • Klik 2x untuk reset posisi'
                    : undefined
                }
                className={`ff-hero-gradient text-white px-4 py-3 flex items-center justify-between gap-3 shrink-0 ${
                  isFloating
                    ? isDragging
                      ? 'lg:cursor-grabbing select-none'
                      : 'lg:cursor-grab select-none'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading text-sm font-extrabold leading-tight truncate">
                      Admin Lezzat Frozen Food
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        aria-hidden="true"
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOnline
                            ? 'bg-emerald-400 motion-safe:animate-pulse'
                            : 'bg-amber-300'
                        }`}
                      />
                      <p className="text-[11px] text-white/90 font-medium leading-tight truncate">
                        {isOnline
                          ? 'Online'
                          : 'Offline - dibalas saat jam buka'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Header: Perbesar / Kecilkan & Tutup (X) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isFloating ? (
                    <button
                      type="button"
                      onClick={handleExpandToRoute}
                      aria-label="Perbesar tampilan chat"
                      aria-expanded={false}
                      aria-pressed={false}
                      title="Perbesar tampilan chat"
                      className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleShrinkToFloating}
                      aria-label="Kecilkan tampilan chat ke panel mengambang"
                      aria-expanded={true}
                      aria-pressed={true}
                      title="Kecilkan ke panel mengambang"
                      className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Kecilkan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseExpandedOrFloating}
                    aria-label="Tutup panel chat"
                    title="Tutup chat"
                    className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Jika Pelanggan Belum Login */}
              {!user ? (
                <div className="flex-1 min-h-0 overflow-y-auto ff-chat-scroll p-6 flex flex-col items-center justify-center text-center bg-slate-50 space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#4737FF]/10 text-[#4737FF] flex items-center justify-center">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-heading text-sm font-extrabold text-slate-800">
                      Masuk untuk Chat dengan Admin
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                      Silakan masuk ke akun pelanggan Anda agar riwayat
                      tanya-jawab seputar stok, tanggal kedaluwarsa, dan ongkir
                      tersimpan.
                    </p>
                  </div>
                  {pendingProduct && (
                    <div className="w-full max-w-sm p-2.5 rounded-xl bg-white border border-slate-200 text-left flex items-center gap-2.5 text-xs shadow-2xs">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {resolveProductImageUrl(pendingProduct.gambar) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveProductImageUrl(pendingProduct.gambar)!}
                            alt={pendingProduct.namaProduk}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Snowflake className="w-4 h-4 text-[#4737FF]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">
                          {pendingProduct.namaProduk}
                        </p>
                        <p className="text-[#F75C03] font-extrabold mt-0.5">
                          {formatRupiah(pendingProduct.harga)}
                        </p>
                      </div>
                    </div>
                  )}
                  <Link
                    href="/login"
                    onClick={closeChat}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4737FF] hover:bg-[#3529BF] text-white text-xs font-bold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk Sekarang</span>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Area Pesan (flex-1 min-h-0, overflow-y-auto, scrollbar tipis .ff-chat-scroll, maks bubble 80%) */}
                  <div
                    aria-live="polite"
                    className="ff-chat-scroll flex-1 min-h-0 p-3.5 sm:p-4 overflow-y-auto bg-slate-50 space-y-3"
                  >
                    {/* Sapaan Admin sebagai bubble admin biasa (rata kiri, avatar kecil, maks 80%) */}
                    <div className="flex items-end gap-2 justify-start">
                      <div
                        aria-hidden="true"
                        className="w-7 h-7 rounded-full bg-[#4737FF]/10 border border-[#4737FF]/20 text-[#4737FF] flex items-center justify-center shrink-0"
                      >
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <div className="max-w-[80%] flex flex-col items-start min-w-0">
                        <div className="rounded-2xl rounded-bl-xs bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 shadow-2xs space-y-1 break-words">
                          <p className="font-bold text-slate-900">
                            Halo, {user.nama}! 👋
                          </p>
                          <p className="text-slate-600 leading-relaxed">
                            Ada yang ingin ditanyakan seputar stok, tanggal
                            kedaluwarsa, harga grosir, atau ongkir?
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Daftar Riwayat Pesan */}
                    {messages.map((msg) => {
                      const isCustomer = msg.senderRole === 'CUSTOMER';
                      const timeStr = new Date(
                        msg.createdAt
                      ).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={msg.idMessage}
                          className={`flex items-end gap-2 ${
                            isCustomer ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isCustomer && (
                            <div
                              aria-hidden="true"
                              className="w-7 h-7 rounded-full bg-[#4737FF]/10 border border-[#4737FF]/20 text-[#4737FF] flex items-center justify-center shrink-0 mb-4"
                            >
                              <Store className="w-3.5 h-3.5" />
                            </div>
                          )}

                          <div
                            className={`max-w-[80%] min-w-0 flex flex-col ${
                              isCustomer ? 'items-end' : 'items-start'
                            }`}
                          >
                            <div
                              className={`w-full rounded-2xl px-3.5 py-2.5 text-xs space-y-2 shadow-2xs break-words ${
                                isCustomer
                                  ? 'bg-[#4737FF] text-white rounded-br-xs'
                                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                              }`}
                            >
                              {/* Mini Card Konteks Produk di dalam bubble pelanggan */}
                              {msg.attachedProduct && (
                                <Link
                                  href={`/products/${msg.attachedProduct.idProduk}`}
                                  onClick={() => {
                                    if (isExpanded) setMode('floating');
                                  }}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                                    isCustomer
                                      ? 'bg-white/15 border-white/20 text-white hover:bg-white/20'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-[#4737FF]'
                                  }`}
                                >
                                  <div className="w-10 h-10 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center">
                                    {resolveProductImageUrl(
                                      msg.attachedProduct.gambar
                                    ) ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={
                                          resolveProductImageUrl(
                                            msg.attachedProduct.gambar
                                          )!
                                        }
                                        alt={msg.attachedProduct.namaProduk}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Snowflake className="w-4 h-4 text-[#4737FF]" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold truncate text-xs leading-snug">
                                      {msg.attachedProduct.namaProduk}
                                    </p>
                                    <p
                                      className={`font-extrabold text-[11px] mt-0.5 ${
                                        isCustomer
                                          ? 'text-amber-300'
                                          : 'text-[#F75C03]'
                                      }`}
                                    >
                                      {formatRupiah(msg.attachedProduct.harga)}
                                    </p>
                                  </div>
                                </Link>
                              )}

                              <p className="leading-relaxed whitespace-pre-wrap break-words">
                                {msg.pesan}
                              </p>
                            </div>

                            {/* Jam di bawah bubble + status centang nyata */}
                            <div
                              className={`flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1 ${
                                isCustomer ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <span>{timeStr}</span>
                              {isCustomer &&
                                (msg.isRead ? (
                                  <span
                                    className="inline-flex items-center text-[#4737FF]"
                                    title="Dibaca"
                                    aria-label="Dibaca"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center text-slate-400"
                                    title="Terkirim"
                                    aria-label="Terkirim"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Indikator mengetik / mengirim atau catatan menunggu balasan */}
                    {isSending && (
                      <div className="flex items-end gap-2 justify-start">
                        <div
                          aria-hidden="true"
                          className="w-7 h-7 rounded-full bg-[#4737FF]/10 border border-[#4737FF]/20 text-[#4737FF] flex items-center justify-center shrink-0"
                        >
                          <Store className="w-3.5 h-3.5" />
                        </div>
                        <div className="rounded-2xl rounded-bl-xs bg-white border border-slate-200 px-3.5 py-2.5 shadow-2xs inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}

                    {isWaitingForAdminReply && (
                      <p className="text-[11px] text-slate-400 text-right pr-1">
                        Admin akan membalas secepatnya.
                      </p>
                    )}

                    <div ref={bottomRef} />
                  </div>

                  {/* Kartu Konteks Produk sebelum dikirim (foto 40px, nama, harga, tombol X) */}
                  {pendingProduct && (
                    <div className="px-3.5 py-2 bg-[#FFF7ED] border-t border-[#FED7AA] flex items-center justify-between gap-2.5 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-white border border-amber-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {resolveProductImageUrl(pendingProduct.gambar) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                resolveProductImageUrl(pendingProduct.gambar)!
                              }
                              alt={pendingProduct.namaProduk}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Snowflake className="w-4 h-4 text-[#4737FF]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {pendingProduct.namaProduk}
                          </p>
                          <p className="text-xs font-extrabold text-[#F75C03] mt-0.5">
                            {formatRupiah(pendingProduct.harga)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearPendingProduct}
                        aria-label={`Hapus konteks produk ${pendingProduct.namaProduk}`}
                        className="w-7 h-7 rounded-full bg-white hover:bg-amber-100 text-slate-500 hover:text-slate-700 border border-amber-200/80 flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Quick Replies (Chips): satu baris horizontal, >=13px, hilang setelah kirim/pilih chip */}
                  {showQuickReplies && (
                    <div className="px-3.5 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto flex-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
                      {quickReplies.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleSend(q)}
                          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-[#4737FF]/10 text-slate-700 hover:text-[#4737FF] border border-slate-200/80 hover:border-[#4737FF]/30 text-[13px] font-semibold leading-tight whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input Ketik Pesan (Enter = kirim, Shift+Enter = baris baru, 16px di mobile, selalu terlihat) */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!isSending && inputText.trim()) {
                        handleSend();
                      }
                    }}
                    className="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
                  >
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={inputText}
                      onChange={handleTextareaChange}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder={
                        pendingProduct
                          ? `Tanyakan tentang ${pendingProduct.namaProduk}...`
                          : 'Tulis pesan untuk admin...'
                      }
                      aria-label={
                        pendingProduct
                          ? `Tanyakan tentang ${pendingProduct.namaProduk}`
                          : 'Tulis pesan untuk admin'
                      }
                      className="flex-1 max-h-24 resize-none rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3.5 py-2 text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#4737FF] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#4737FF] leading-snug"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !inputText.trim()}
                      aria-label="Kirim pesan"
                      className="w-10 h-10 rounded-xl bg-[#F75C03] hover:bg-[#D94800] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Kolom Kanan Mode Expanded: Panel Info (Lebar 320px, disembunyikan di < 1024px) */}
            {isExpanded && (
              <aside
                aria-label="Informasi chat dan pesanan"
                className="ff-chat-scroll hidden lg:flex lg:w-[320px] shrink-0 h-full min-h-0 flex-col gap-4 overflow-y-auto pr-0.5"
              >
                {/* 1. Produk terakhir ditanyakan (maksimal 3 produk unik, terbaru di atas) */}
                {recentInquiredProducts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F75C03]">
                        Produk terakhir ditanyakan
                      </span>
                      {pendingProduct && (
                        <button
                          type="button"
                          onClick={clearPendingProduct}
                          aria-label={`Hapus konteks produk ${pendingProduct.namaProduk}`}
                          className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#4737FF] rounded"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {recentInquiredProducts.map((prod) => (
                        <Link
                          key={prod.idProduk}
                          href={`/products/${prod.idProduk}`}
                          onClick={() => setMode('floating')}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-[#4737FF]/5 border border-slate-200/80 hover:border-[#4737FF]/30 transition-colors focus-visible:outline-2 focus-visible:outline-[#4737FF]"
                        >
                          <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {resolveProductImageUrl(prod.gambar) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveProductImageUrl(prod.gambar)!}
                                alt={prod.namaProduk}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Snowflake className="w-4 h-4 text-[#4737FF]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {prod.namaProduk}
                            </p>
                            <p className="text-xs font-extrabold text-[#F75C03] mt-0.5">
                              {formatRupiah(prod.harga)}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Pesanan Terakhir Pelanggan (Hanya tampil jika datanya tersedia) */}
                {recentOrders.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-heading text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        PESANAN TERAKHIR
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {recentOrders.length} pesanan
                      </span>
                    </div>

                    <div className="space-y-2">
                      {recentOrders.map((ord) => {
                        const dateStr = ord.createdAt
                          ? new Date(ord.createdAt).toLocaleDateString(
                              'id-ID',
                              {
                                day: '2-digit',
                                month: 'short',
                              }
                            )
                          : '';
                        return (
                          <Link
                            key={ord.idOrder}
                            href={`/orders/${ord.idOrder}`}
                            onClick={() => setMode('floating')}
                            className="block p-2.5 rounded-xl bg-slate-50 hover:bg-[#4737FF]/5 border border-slate-200/80 hover:border-[#4737FF]/30 transition-colors space-y-1.5 focus-visible:outline-2 focus-visible:outline-[#4737FF]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-slate-800 truncate">
                                #{ord.idOrder.slice(0, 8).toUpperCase()}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${getOrderStatusBadgeStyle(
                                  ord.status
                                )}`}
                              >
                                {ord.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>
                                {ord.items?.length || 0} item
                                {dateStr ? ` • ${dateStr}` : ''}
                              </span>
                              <span className="font-extrabold text-[#4737FF]">
                                {formatRupiah(ord.totalTagihan)}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Jam Operasional Toko (09.00 - 21.00 WIB dari konstanta tunggal + status dinamis) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#4737FF]/10 text-[#4737FF] flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-heading text-xs font-extrabold text-slate-800">
                        Jam Operasional
                      </h4>
                      <p className="text-xs font-bold text-[#4737FF]">
                        {STORE_OPERATING_HOURS.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span
                      aria-hidden="true"
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOnline ? 'bg-[#159A68]' : 'bg-amber-500'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-bold ${
                        isOnline ? 'text-[#159A68]' : 'text-amber-700'
                      }`}
                    >
                      {isOnline ? 'Online' : 'Offline - dibalas saat jam buka'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Admin melayani pertanyaan stok, tanggal kedaluwarsa, dan
                    pengiriman.
                  </p>
                </div>

                {/* 4. Tautan Cepat ke "Pesanan Saya" */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5 shrink-0">
                  <p className="text-xs font-bold text-slate-800">
                    Ingin melacak pengiriman atau unduh nota?
                  </p>
                  <Link
                    href="/orders"
                    onClick={() => setMode('minimized')}
                    className="w-full inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#4737FF] hover:bg-[#3529BF] text-white text-xs font-bold shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <span>Pesanan Saya</span>
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </>
  );
}
