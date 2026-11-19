'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  Suspense,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Send,
  Snowflake,
  ExternalLink,
  Check,
  CheckCheck,
  Sparkles,
  RefreshCw,
  Truck,
  Package,
  ArrowLeft,
  ArrowDown,
  AlertCircle,
  X,
} from 'lucide-react';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { formatRupiah } from '@/lib/utils';
import { resolveProductImageUrl } from '@/components/shop/product-card';
import {
  ChatMessageItem,
  AttachedProductInfo,
  STORE_OPERATING_HOURS,
  useAdminChatMessages,
  sendChatMessage,
  markCustomerMessagesRead,
} from '@/store/chat-store';

type ConversationFilterTab = 'ALL' | 'UNREAD' | 'B2B' | 'B2C';

interface CustomerConversation {
  idCustomer: string;
  namaCustomer: string;
  emailCustomer?: string;
  tipeAkun: 'B2B' | 'B2C' | null;
  lastMessage: ChatMessageItem;
  unreadCount: number;
  messages: ChatMessageItem[];
}

interface QuickReplyTemplate {
  label: string;
  content: string;
}

const SHORT_MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function getLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatConversationListTime(isoStr: string): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const todayKey = getLocalDayKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = getLocalDayKey(yesterday);

  const msgKey = getLocalDayKey(date);
  if (msgKey === todayKey) {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (msgKey === yesterdayKey) {
    return 'Kemarin';
  }
  const day = date.getDate();
  const month = SHORT_MONTHS_ID[date.getMonth()] || '';
  return `${day} ${month}`;
}

function formatDateSeparatorLabel(isoStr: string): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const todayKey = getLocalDayKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = getLocalDayKey(yesterday);

  const msgKey = getLocalDayKey(date);
  if (msgKey === todayKey) return 'Hari ini';
  if (msgKey === yesterdayKey) return 'Kemarin';

  const day = date.getDate();
  const month = SHORT_MONTHS_ID[date.getMonth()] || '';
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getInitials(name: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'PL';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function AdminChatsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCustomerId = (searchParams.get('c') || '').trim();

  const {
    messages: allMessages,
    unreadCount: totalUnreadMessages,
    isLoading,
    error: fetchError,
    refresh,
  } = useAdminChatMessages();

  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] =
    useState<ConversationFilterTab>('ALL');
  const [replyText, setReplyText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasNewMessageBelow, setHasNewMessageBelow] = useState<boolean>(false);

  const messageContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevConversationIdRef = useRef<string>('');
  const prevMessageCountRef = useRef<number>(0);

  // Debounce input pencarian 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Kelompokkan pesan per pelanggan di sisi klien & urutkan berdasarkan pesan terakhir (terbaru di atas)
  const conversations = useMemo<CustomerConversation[]>(() => {
    const map = new Map<string, ChatMessageItem[]>();
    allMessages.forEach((m) => {
      if (!m || !m.idCustomer) return;
      const list = map.get(m.idCustomer) || [];
      list.push(m);
      map.set(m.idCustomer, list);
    });

    const result: CustomerConversation[] = [];
    map.forEach((msgs, idCustomer) => {
      const sorted = [...msgs].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );
      const last = sorted[sorted.length - 1];
      const unreadCount = sorted.filter(
        (m) => m.senderRole === 'CUSTOMER' && !m.isRead
      ).length;

      // Cari nama, email, dan tipeAkun dari data pesan yang benar-benar ada (tanpa mengarang data)
      let resolvedName = '';
      let resolvedEmail: string | undefined;
      let resolvedTipe: 'B2B' | 'B2C' | null = null;

      for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const item = sorted[i];
        if (!resolvedName && item.namaCustomer && item.namaCustomer.trim()) {
          resolvedName = item.namaCustomer.trim();
        }
        if (!resolvedEmail && item.emailCustomer && item.emailCustomer.trim()) {
          resolvedEmail = item.emailCustomer.trim();
        }
        if (!resolvedTipe && item.tipeAkun) {
          const upper = item.tipeAkun.trim().toUpperCase();
          if (upper === 'B2B' || upper === 'B2C') {
            resolvedTipe = upper;
          }
        }
      }

      const fallbackName = `Pelanggan #${idCustomer.slice(0, 8)}`;

      result.push({
        idCustomer,
        namaCustomer: resolvedName || fallbackName,
        emailCustomer: resolvedEmail,
        tipeAkun: resolvedTipe,
        lastMessage: last,
        unreadCount,
        messages: sorted,
      });
    });

    return result.sort((a, b) =>
      b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt)
    );
  }, [allMessages]);

  const unreadConversationsCount = useMemo(
    () => conversations.filter((c) => c.unreadCount > 0).length,
    [conversations]
  );

  // Filter berdasarkan tab & kata kunci pencarian (nama, email, isi pesan terakhir, nama produk)
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (activeFilter === 'UNREAD' && conv.unreadCount === 0) return false;
      if (activeFilter === 'B2B' && conv.tipeAkun !== 'B2B') return false;
      if (activeFilter === 'B2C' && conv.tipeAkun !== 'B2C') return false;

      if (!debouncedSearch) return true;

      const nameMatch = conv.namaCustomer
        .toLowerCase()
        .includes(debouncedSearch);
      const emailMatch = Boolean(
        conv.emailCustomer &&
          conv.emailCustomer.toLowerCase().includes(debouncedSearch)
      );
      const lastMsgMatch = conv.lastMessage.pesan
        .toLowerCase()
        .includes(debouncedSearch);
      const productMatch = conv.messages.some(
        (m) =>
          m.attachedProduct &&
          (m.attachedProduct.namaProduk
            .toLowerCase()
            .includes(debouncedSearch) ||
            m.attachedProduct.idProduk.toLowerCase().includes(debouncedSearch))
      );

      return nameMatch || emailMatch || lastMsgMatch || productMatch;
    });
  }, [conversations, activeFilter, debouncedSearch]);

  const activeConversation = useMemo(
    () =>
      urlCustomerId
        ? conversations.find((c) => c.idCustomer === urlCustomerId) || null
        : null,
    [conversations, urlCustomerId]
  );

  const selectCustomer = useCallback(
    (idCustomer: string | null) => {
      setSendError(null);
      setHasNewMessageBelow(false);
      if (idCustomer) {
        router.replace(`/admin/chats?c=${encodeURIComponent(idCustomer)}`, {
          scroll: false,
        });
      } else {
        router.replace('/admin/chats', { scroll: false });
      }
    },
    [router]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    isNearBottomRef.current = true;
    setHasNewMessageBelow(false);
  }, []);

  const handleMessageScroll = () => {
    const el = messageContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= 96;
    isNearBottomRef.current = nearBottom;
    if (nearBottom && hasNewMessageBelow) {
      setHasNewMessageBelow(false);
    }
  };

  // Tandai pesan pelanggan sudah dibaca HANYA saat percakapan benar-benar dibuka & tab terlihat
  const markActiveConversationReadIfVisible = useCallback(async () => {
    if (!activeConversation || activeConversation.unreadCount <= 0) return;
    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return;
    }
    await markCustomerMessagesRead(activeConversation.idCustomer, 'ADMIN');
    await refresh({ silent: true });
  }, [activeConversation, refresh]);

  useEffect(() => {
    void markActiveConversationReadIfVisible();
  }, [markActiveConversationReadIfVisible]);

  useEffect(() => {
    if (!activeConversation) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void markActiveConversationReadIfVisible();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeConversation, markActiveConversationReadIfVisible]);

  // Auto-scroll saat berganti pelanggan, fokus ke textarea, atau tampilkan tombol "Pesan baru" jika sedang scroll di atas
  useEffect(() => {
    if (!activeConversation) {
      prevConversationIdRef.current = '';
      prevMessageCountRef.current = 0;
      return;
    }

    const isSwitchedCustomer =
      prevConversationIdRef.current !== activeConversation.idCustomer;
    const currentCount = activeConversation.messages.length;
    const hasNewMessages = currentCount > prevMessageCountRef.current;

    prevConversationIdRef.current = activeConversation.idCustomer;
    prevMessageCountRef.current = currentCount;

    if (isSwitchedCustomer) {
      isNearBottomRef.current = true;
      const scrollTimer = setTimeout(() => {
        scrollToBottom('smooth');
        textareaRef.current?.focus();
      }, 60);
      return () => clearTimeout(scrollTimer);
    }

    if (hasNewMessages) {
      const latestMsg =
        activeConversation.messages[activeConversation.messages.length - 1];
      if (latestMsg?.senderRole === 'ADMIN' || isNearBottomRef.current) {
        const scrollTimer = setTimeout(() => {
          scrollToBottom('smooth');
        }, 60);
        return () => clearTimeout(scrollTimer);
      } else {
        const timer = setTimeout(() => {
          setHasNewMessageBelow(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [activeConversation, scrollToBottom]);

  // Cari konteks produk pada pesan terakhir pelanggan (jika ada) untuk template Quick Reply pertama
  const latestCustomerProduct = useMemo<AttachedProductInfo | null>(() => {
    if (!activeConversation) return null;
    const customerMsgs = activeConversation.messages.filter(
      (m) => m.senderRole === 'CUSTOMER'
    );
    const lastCustomerMsg = customerMsgs[customerMsgs.length - 1];
    if (lastCustomerMsg?.attachedProduct) {
      return lastCustomerMsg.attachedProduct;
    }
    return null;
  }, [activeConversation]);

  // Template Quick Replies dengan pemisahan label pendek (maks 18 karakter) & isi lengkap
  const adminQuickReplies = useMemo<QuickReplyTemplate[]>(() => {
    const stockContent = latestCustomerProduct?.namaProduk
      ? `${latestCustomerProduct.namaProduk}: Stok masih tersedia & terjaga beku -18°C, silakan diorder Kak.`
      : 'Stok masih tersedia & terjaga beku -18°C, silakan diorder Kak.';

    return [
      {
        label: 'Stok tersedia',
        content: stockContent,
      },
      {
        label: `Sameday < ${STORE_OPERATING_HOURS.samedayCutoffHour}.00`,
        content: `Pesan sebelum ${STORE_OPERATING_HOURS.samedayCutoffLabel} bisa dikirim Sameday hari ini Kak.`,
      },
      {
        label: 'Konfirmasi ongkir',
        content:
          'Ongkir kurir pihak ketiga sudah kami konfirmasi, silakan lanjut pembayaran.',
      },
      {
        label: 'Harga grosir',
        content:
          'Pembelian grosir dalam jumlah tertentu otomatis mendapat harga Tiering di keranjang.',
      },
    ];
  }, [latestCustomerProduct]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh({ silent: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Klik chip hanya mengisi textarea dan memfokuskan kursor (TIDAK mengirim otomatis)
  const handleSelectQuickReplyChip = (templateText: string) => {
    setSendError(null);
    setReplyText(templateText);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
        const len = templateText.length;
        el.setSelectionRange(len, len);
      }
    }, 20);
  };

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (sendError) setSendError(null);
    setReplyText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
  };

  const handleSendAdminReply = async () => {
    if (!activeConversation || isSending) return;
    const text = replyText.trim();
    if (!text) return;

    setIsSending(true);
    setSendError(null);

    try {
      await sendChatMessage({
        idCustomer: activeConversation.idCustomer,
        namaCustomer: activeConversation.namaCustomer,
        emailCustomer: activeConversation.emailCustomer,
        tipeAkun: activeConversation.tipeAkun || undefined,
        senderRole: 'ADMIN',
        pesan: text,
        attachedProduct: null,
      });

      setReplyText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      await refresh({ silent: true });
      setTimeout(() => {
        scrollToBottom('smooth');
        textareaRef.current?.focus();
      }, 60);
    } catch {
      // Jika gagal kirim, teks tetap di textarea & tampilkan pesan error singkat
      setSendError('Gagal mengirim balasan. Silakan coba kirim kembali.');
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && replyText.trim()) {
        void handleSendAdminReply();
      }
    }
  };

  const hasSelectedCustomer = Boolean(activeConversation);

  return (
    <div className="lezzat-shell">
      <AdminSidebar />

      <main className="lezzat-main">
        {/* Header Halaman Ringkas */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#4737FF] uppercase">
              FROZNFOOD 2.0 • CHAT PELANGGAN
            </p>
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-[#171725] mt-0.5">
              Pusat Pesan &amp; Tanya Barang
            </h1>
            <p className="text-xs text-[#77788A] mt-0.5">
              {conversations.length} percakapan aktif •{' '}
              <strong className="text-[#171725]">
                {totalUnreadMessages} pesan belum dibaca
              </strong>{' '}
              • Jam operasional {STORE_OPERATING_HOURS.label}
            </p>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Muat ulang daftar pesan pelanggan"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E6E8F0] hover:bg-[#F1F3F8] disabled:opacity-60 text-[#171725] text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#4737FF] ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>Muat Ulang</span>
          </button>
        </div>

        {/* Kondisi Error Ambil Data */}
        {fetchError && !isLoading && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Kartu Utama Workspace 2 Kolom Proporsional */}
        <section
          aria-label="Ruang kerja chat pelanggan"
          className="bg-white rounded-2xl overflow-hidden border border-[#E6E8F0] shadow-sm grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] h-[calc(100dvh-11rem)] min-h-[480px] max-h-[760px]"
        >
          {/* KOLOM KIRI: Daftar Pelanggan, Pencarian & Filter */}
          <div
            className={`border-r border-[#E6E8F0] flex-col h-full min-h-0 bg-[#F8FAFF] ${
              hasSelectedCustomer ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Bar Pencarian + Tab Filter Satu Baris */}
            <div className="p-3 border-b border-[#E6E8F0] bg-white space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-[#77788A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label="Cari nama pelanggan, email, pesan, atau nama produk"
                  placeholder="Cari pelanggan, email, pesan, produk..."
                  className="w-full rounded-xl border border-[#E6E8F0] bg-[#F8FAFF] focus:bg-white pl-9 pr-8 py-2 text-xs text-[#171725] placeholder:text-[#77788A] focus:border-[#4737FF] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#4737FF] transition-colors"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    aria-label="Bersihkan kata kunci pencarian"
                    className="w-5 h-5 rounded-full hover:bg-slate-200/70 text-[#77788A] hover:text-[#171725] flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#4737FF]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tab Filter Satu Baris (Semua, Belum Dibaca, B2B, B2C) dengan fallback scroll & efek pudar di ujung */}
              <div className="relative">
                <div
                  role="tablist"
                  aria-label="Filter percakapan pelanggan"
                  className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-3 pb-0.5"
                >
                  {(
                    [
                      { key: 'ALL', label: 'Semua' },
                      {
                        key: 'UNREAD',
                        label: 'Belum Dibaca',
                        count: unreadConversationsCount,
                      },
                      { key: 'B2B', label: 'B2B' },
                      { key: 'B2C', label: 'B2C' },
                    ] as {
                      key: ConversationFilterTab;
                      label: string;
                      count?: number;
                    }[]
                  ).map((tab) => {
                    const isActive = activeFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`Filter ${tab.label}`}
                        onClick={() => setActiveFilter(tab.key)}
                        className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4737FF] ${
                          isActive
                            ? 'bg-[#4737FF] text-white'
                            : 'bg-[#F1F3F8] hover:bg-[#E6E8F0] text-[#5E5E6A]'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {typeof tab.count === 'number' && tab.count > 0 && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold leading-tight ${
                              isActive
                                ? 'bg-white text-[#4737FF]'
                                : 'bg-[#F75C03] text-white'
                            }`}
                          >
                            {tab.count > 99 ? '99+' : tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white to-transparent"
                />
              </div>
            </div>

            {/* Daftar Percakapan (Scroll Mandiri dengan Scrollbar Tipis .ff-chat-scroll) */}
            <div className="ff-chat-scroll flex-1 min-h-0 overflow-y-auto divide-y divide-[#E6E8F0]">
              {isLoading ? (
                <div
                  aria-busy="true"
                  aria-label="Memuat daftar percakapan"
                  className="p-3.5 space-y-3 animate-pulse"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/3 rounded bg-slate-200" />
                        <div className="h-3 w-full rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#77788A] space-y-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#E7EFFF] text-[#4737FF] flex items-center justify-center mx-auto">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="font-heading font-bold text-[#171725]">
                    Belum Ada Pesan Masuk
                  </p>
                  <p className="leading-relaxed">
                    Pertanyaan produk dan pengiriman dari pelanggan akan tampil
                    di daftar ini.
                  </p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#77788A] space-y-2.5">
                  <Search className="w-7 h-7 text-[#ACA5FF] mx-auto" />
                  <p className="font-heading font-bold text-[#171725]">
                    Hasil Pencarian Kosong
                  </p>
                  <p className="leading-relaxed">
                    Tidak ada percakapan yang cocok dengan filter atau kata
                    kunci tersebut.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setActiveFilter('ALL');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#4737FF] hover:bg-[#3529BF] text-white text-xs font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected =
                    activeConversation?.idCustomer === conv.idCustomer;
                  const isB2B = conv.tipeAkun === 'B2B';
                  const timeLabel = formatConversationListTime(
                    conv.lastMessage.createdAt
                  );

                  return (
                    <button
                      key={conv.idCustomer}
                      type="button"
                      onClick={() => selectCustomer(conv.idCustomer)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#4737FF] ${
                        isSelected
                          ? 'bg-[#E7EFFF]/85 border-l-4 border-l-[#4737FF]'
                          : 'bg-white hover:bg-[#F8FAFF]'
                      }`}
                    >
                      {/* Avatar Inisial 2 Huruf (B2B Oranye, B2C Indigo) */}
                      <div
                        aria-hidden="true"
                        className={`w-10 h-10 rounded-full font-heading text-xs font-extrabold flex items-center justify-center shrink-0 border ${
                          isB2B
                            ? 'bg-[#F75C03]/15 text-[#F75C03] border-[#F75C03]/30'
                            : 'bg-[#4737FF]/10 text-[#4737FF] border-[#4737FF]/25'
                        }`}
                      >
                        {getInitials(conv.namaCustomer)}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Baris 1: Nama, Badge B2B/B2C, Waktu */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`text-xs truncate ${
                                conv.unreadCount > 0 || isSelected
                                  ? 'font-extrabold text-[#171725]'
                                  : 'font-bold text-[#171725]'
                              }`}
                            >
                              {conv.namaCustomer}
                            </span>

                            {conv.tipeAkun && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 ${
                                  isB2B
                                    ? 'bg-[#F75C03]/15 text-[#F75C03]'
                                    : 'bg-[#4737FF]/10 text-[#4737FF]'
                                }`}
                              >
                                {conv.tipeAkun}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-[#77788A] shrink-0">
                            {timeLabel}
                          </span>
                        </div>

                        {/* Baris 2: Label Produk jika pesan terakhir menyertakan produk */}
                        {conv.lastMessage.attachedProduct && (
                          <p className="text-[10px] font-extrabold text-[#F75C03] truncate mt-0.5">
                            📦 {conv.lastMessage.attachedProduct.namaProduk}
                          </p>
                        )}

                        {/* Baris 3: Cuplikan Pesan Terakhir + Badge Belum Dibaca */}
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p
                            className={`text-[11px] truncate ${
                              conv.unreadCount > 0
                                ? 'font-semibold text-[#171725]'
                                : 'text-[#5E5E6A]'
                            }`}
                          >
                            {conv.lastMessage.senderRole === 'ADMIN'
                              ? 'Anda: '
                              : ''}
                            {conv.lastMessage.pesan}
                          </p>

                          {conv.unreadCount > 0 && (
                            <span
                              aria-label={`${conv.unreadCount} pesan belum dibaca`}
                              className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#F75C03] text-white text-[10px] font-extrabold inline-flex items-center justify-center leading-none shrink-0"
                            >
                              {conv.unreadCount > 99
                                ? '99+'
                                : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* KOLOM KANAN: Header Pelanggan, Ruang Percakapan, Quick Replies & Input */}
          <div
            className={`min-w-0 h-full min-h-0 flex-col bg-white ${
              hasSelectedCustomer ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {isLoading ? (
              <div
                aria-busy="true"
                aria-label="Memuat ruang percakapan"
                className="flex-1 p-6 space-y-4 animate-pulse flex flex-col justify-between"
              >
                <div className="h-12 w-full rounded-xl bg-slate-100" />
                <div className="space-y-3 flex-1 py-4">
                  <div className="h-16 w-2/3 rounded-2xl bg-slate-100" />
                  <div className="h-14 w-1/2 rounded-2xl bg-slate-100 ml-auto" />
                  <div className="h-16 w-3/5 rounded-2xl bg-slate-100" />
                </div>
                <div className="h-12 w-full rounded-xl bg-slate-100" />
              </div>
            ) : !activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#F8FAFF]/50">
                <div className="w-12 h-12 rounded-2xl bg-[#E7EFFF] text-[#4737FF] flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h2 className="font-heading text-sm font-extrabold text-[#171725]">
                  Pilih percakapan untuk mulai membalas
                </h2>
                <p className="text-xs text-[#77788A] max-w-xs mt-1 leading-relaxed">
                  Pilih salah satu pelanggan di daftar sebelah kiri untuk
                  melihat rincian produk yang ditanyakan dan mengirim balasan.
                </p>
              </div>
            ) : (
              <>
                {/* Header Kolom Kanan */}
                <div className="px-4 sm:px-5 py-3 border-b border-[#E6E8F0] bg-white flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Tombol Kembali ke Daftar pada layar < 1024px */}
                    <button
                      type="button"
                      onClick={() => selectCustomer(null)}
                      aria-label="Kembali ke daftar pelanggan"
                      className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F1F3F8] hover:bg-[#E6E8F0] text-[#171725] text-xs font-bold shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-[#4737FF]" />
                      <span>Kembali ke Daftar</span>
                    </button>

                    {/* Avatar Inisial */}
                    <div
                      aria-hidden="true"
                      className={`w-9 h-9 rounded-full font-heading text-xs font-extrabold flex items-center justify-center shrink-0 border ${
                        activeConversation.tipeAkun === 'B2B'
                          ? 'bg-[#F75C03]/15 text-[#F75C03] border-[#F75C03]/30'
                          : 'bg-[#4737FF]/10 text-[#4737FF] border-[#4737FF]/25'
                      }`}
                    >
                      {getInitials(activeConversation.namaCustomer)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="font-heading text-sm font-extrabold text-[#171725] truncate">
                          {activeConversation.namaCustomer}
                        </h2>
                        {activeConversation.tipeAkun && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 ${
                              activeConversation.tipeAkun === 'B2B'
                                ? 'bg-[#F75C03]/15 text-[#F75C03]'
                                : 'bg-[#4737FF]/10 text-[#4737FF]'
                            }`}
                          >
                            {activeConversation.tipeAkun === 'B2B'
                              ? 'B2B Mitra'
                              : 'B2C Retail'}
                          </span>
                        )}
                      </div>

                      {activeConversation.emailCustomer && (
                        <p className="text-[11px] text-[#77788A] truncate">
                          {activeConversation.emailCustomer}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tombol Pintas Operasional (Ikon saja di < 1280px, Teks penuh di >= 1280px) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/admin/deliveries"
                      aria-label="Cek Pengiriman"
                      title="Cek Pengiriman (/admin/deliveries)"
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl bg-[#F8FAFF] hover:bg-[#E7EFFF] border border-[#E6E8F0] hover:border-[#4737FF]/30 text-[#171725] hover:text-[#4737FF] text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                    >
                      <Truck className="w-3.5 h-3.5 text-[#4737FF] shrink-0" />
                      <span className="hidden xl:inline">Cek Pengiriman</span>
                    </Link>

                    <Link
                      href="/admin/products"
                      aria-label="Cek Stok & Batch"
                      title="Cek Stok & Batch (/admin/products)"
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl bg-[#F8FAFF] hover:bg-[#E7EFFF] border border-[#E6E8F0] hover:border-[#4737FF]/30 text-[#171725] hover:text-[#4737FF] text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                    >
                      <Package className="w-3.5 h-3.5 text-[#F75C03] shrink-0" />
                      <span className="hidden xl:inline">
                        Cek Stok &amp; Batch
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Area Riwayat Pesan */}
                <div className="relative flex-1 min-h-0 flex flex-col">
                  <div
                    ref={messageContainerRef}
                    onScroll={handleMessageScroll}
                    aria-live="polite"
                    className="ff-chat-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-[#F8FAFF] space-y-3"
                  >
                    {activeConversation.messages.map((msg, idx) => {
                      const isAdmin = msg.senderRole === 'ADMIN';
                      const msgDate = new Date(msg.createdAt);
                      const timeStr = Number.isNaN(msgDate.getTime())
                        ? ''
                        : msgDate.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                      const prevMsg =
                        idx > 0 ? activeConversation.messages[idx - 1] : null;
                      const showDateSeparator =
                        !prevMsg ||
                        getLocalDayKey(new Date(prevMsg.createdAt)) !==
                          getLocalDayKey(msgDate);

                      return (
                        <React.Fragment key={msg.idMessage}>
                          {showDateSeparator && (
                            <div className="flex items-center justify-center my-2">
                              <span className="px-3 py-1 rounded-full bg-white border border-[#E6E8F0] text-[10px] font-bold text-[#77788A] shadow-2xs">
                                {formatDateSeparatorLabel(msg.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`flex flex-col ${
                              isAdmin ? 'items-end' : 'items-start'
                            }`}
                          >
                            <div
                              className={`max-w-[min(80%,640px)] min-w-0 rounded-2xl px-3.5 py-2.5 text-xs space-y-2 shadow-2xs break-words ${
                                isAdmin
                                  ? 'bg-[#4737FF] text-white rounded-br-xs'
                                  : 'bg-white text-[#171725] border border-[#E6E8F0] rounded-bl-xs'
                              }`}
                            >
                              {/* E. Mini Card Konteks Produk (44x44, idProduk, nama, harga) */}
                              {msg.attachedProduct && (
                                <Link
                                  href={`/products/${msg.attachedProduct.idProduk}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${
                                    isAdmin
                                      ? 'bg-white/15 border-white/25 text-white hover:bg-white/20 focus-visible:outline-white'
                                      : 'bg-[#FFF7ED] border-[#FED7AA] text-[#171725] hover:border-[#F75C03] focus-visible:outline-[#4737FF]'
                                  }`}
                                >
                                  <div className="w-11 h-11 rounded-lg bg-white border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
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
                                        className="w-11 h-11 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <Snowflake className="w-5 h-5 text-[#4737FF]" />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`block text-[10px] font-mono font-bold truncate ${
                                        isAdmin
                                          ? 'text-amber-200'
                                          : 'text-[#77788A]'
                                      }`}
                                    >
                                      {msg.attachedProduct.idProduk}
                                    </span>
                                    <p className="font-bold truncate text-xs leading-snug">
                                      {msg.attachedProduct.namaProduk}
                                    </p>
                                    <p
                                      className={`font-extrabold text-xs mt-0.5 ${
                                        isAdmin
                                          ? 'text-amber-300'
                                          : 'text-[#F75C03]'
                                      }`}
                                    >
                                      {formatRupiah(msg.attachedProduct.harga)}
                                    </p>
                                  </div>

                                  <ExternalLink
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      isAdmin
                                        ? 'text-white/80'
                                        : 'text-[#4737FF]'
                                    }`}
                                  />
                                </Link>
                              )}

                              <p className="leading-relaxed whitespace-pre-wrap break-words">
                                {msg.pesan}
                              </p>
                            </div>

                            {/* Jam HH:mm di bawah bubble + status centang nyata untuk Admin */}
                            <div
                              className={`flex items-center gap-1 text-[10px] text-[#77788A] mt-1 px-1 ${
                                isAdmin ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <span>{timeStr}</span>
                              {isAdmin &&
                                (msg.isRead ? (
                                  <span
                                    className="inline-flex items-center text-[#4737FF]"
                                    title="Dibaca pelanggan"
                                    aria-label="Dibaca pelanggan"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center text-[#77788A]"
                                    title="Terkirim"
                                    aria-label="Terkirim"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ))}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}

                    <div ref={bottomRef} />
                  </div>

                  {/* Tombol Mengambang "Pesan baru ↓" saat Admin sedang scroll ke atas */}
                  {hasNewMessageBelow && (
                    <button
                      type="button"
                      onClick={() => scrollToBottom('smooth')}
                      aria-label="Gulir ke pesan terbaru di bawah"
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#4737FF] hover:bg-[#3529BF] text-white text-xs font-bold shadow-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                    >
                      <span>Pesan baru</span>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* F. Baris Chip Balas Cepat (Label pendek maks 18 karakter, title/aria-label berisi isi lengkap) */}
                <div className="px-4 py-2 bg-white border-t border-[#E6E8F0] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#4737FF] shrink-0 mr-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#F75C03]" />
                    <span>Balas Cepat:</span>
                  </span>

                  {adminQuickReplies.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      title={tpl.content}
                      aria-label={`${tpl.label}: ${tpl.content}`}
                      onClick={() => handleSelectQuickReplyChip(tpl.content)}
                      className="px-3 py-1.5 rounded-full bg-[#F8FAFF] hover:bg-[#E7EFFF] border border-[#E6E8F0] hover:border-[#4737FF]/30 text-xs font-semibold text-[#171725] hover:text-[#4737FF] whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4737FF]"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                {/* Pesan Error Singkat di Dekat Input Jika Gagal Kirim */}
                {sendError && (
                  <div
                    role="alert"
                    className="px-4 py-1.5 bg-red-50 border-t border-red-200 text-xs text-red-600 font-semibold flex items-center justify-between gap-2 shrink-0"
                  >
                    <span>{sendError}</span>
                    <button
                      type="button"
                      onClick={() => setSendError(null)}
                      aria-label="Tutup pesan error"
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Form Input Balasan Admin (Placeholder singkat + petunjuk Enter/Shift+Enter di bawah input pada >= 640px) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!isSending && replyText.trim()) {
                      void handleSendAdminReply();
                    }
                  }}
                  className="p-3.5 bg-white border-t border-[#E6E8F0] shrink-0"
                >
                  <div className="flex items-end gap-2.5">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={replyText}
                      onChange={handleTextareaChange}
                      onKeyDown={handleTextareaKeyDown}
                      aria-label={`Tulis balasan untuk ${activeConversation.namaCustomer}`}
                      placeholder={`Balas pesan ke ${activeConversation.namaCustomer}...`}
                      className="flex-1 max-h-24 resize-none rounded-xl border border-[#E6E8F0] bg-[#F8FAFF] focus:bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#171725] placeholder:text-[#77788A] focus:border-[#4737FF] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#4737FF] leading-snug"
                    />

                    <button
                      type="submit"
                      disabled={isSending || !replyText.trim()}
                      aria-label="Kirim balasan ke pelanggan"
                      className="h-10 px-4 rounded-xl bg-[#4737FF] hover:bg-[#3529BF] disabled:bg-[#F1F3F8] disabled:text-[#77788A] disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Mengirim...' : 'Kirim'}</span>
                    </button>
                  </div>

                  <p className="hidden sm:block text-xs text-[#77788A] mt-1.5 px-1">
                    Enter untuk kirim, Shift+Enter baris baru
                  </p>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function AdminChatsPage() {
  return (
    <Suspense
      fallback={
        <div className="lezzat-shell">
          <AdminSidebar />
          <main className="lezzat-main">
            <div className="h-[calc(100dvh-11rem)] min-h-[480px] max-h-[760px] rounded-2xl bg-white border border-[#E6E8F0] shadow-sm animate-pulse" />
          </main>
        </div>
      }
    >
      <AdminChatsWorkspace />
    </Suspense>
  );
}
