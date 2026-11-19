import { useEffect } from 'react';
import { create } from 'zustand';
import { ProductCatalogResponse } from '@/types/api';
import { api } from '@/lib/axios';

export type ChatViewMode = 'minimized' | 'floating' | 'expanded';

// Konstanta bersama jam operasional & batas pengiriman Sameday (dipakai sisi Pelanggan & Admin)
export const STORE_OPERATING_HOURS = {
  openHour: 9, // 09.00 WIB
  closeHour: 21, // 21.00 WIB
  samedayCutoffHour: 15, // 15.00 WIB
  samedayCutoffLabel: '15.00 WIB',
  timezone: 'Asia/Jakarta',
  label: '09.00 - 21.00 WIB',
} as const;

export interface AttachedProductInfo {
  idProduk: string;
  namaProduk: string;
  kategori?: string;
  harga: number;
  gambar?: string | null;
  isClearance?: boolean;
  diskonPersen?: number;
}

export interface ChatMessageItem {
  idMessage: string;
  idCustomer: string;
  namaCustomer: string;
  emailCustomer?: string;
  tipeAkun?: string;
  senderRole: 'CUSTOMER' | 'ADMIN';
  pesan: string;
  attachedProduct?: AttachedProductInfo | null;
  isRead: boolean;
  createdAt: string;
}

interface ChatUiState {
  mode: ChatViewMode;
  isOpen: boolean;
  pendingProduct: AttachedProductInfo | null;
  setMode: (mode: ChatViewMode) => void;
  openChat: () => void;
  openExpandedChat: () => void;
  closeChat: () => void;
  openChatWithProduct: (
    product: ProductCatalogResponse,
    effectivePrice?: number,
    discountPercent?: number
  ) => void;
  clearPendingProduct: () => void;
}

export const useChatStore = create<ChatUiState>((set) => ({
  mode: 'minimized',
  isOpen: false,
  pendingProduct: null,
  setMode: (mode) =>
    set({
      mode,
      isOpen: mode !== 'minimized',
    }),
  openChat: () =>
    set((state) => {
      const nextMode: ChatViewMode =
        state.mode === 'expanded' ? 'expanded' : 'floating';
      return {
        mode: nextMode,
        isOpen: true,
      };
    }),
  openExpandedChat: () =>
    set({
      mode: 'expanded',
      isOpen: true,
    }),
  closeChat: () =>
    set({
      mode: 'minimized',
      isOpen: false,
    }),
  openChatWithProduct: (product, effectivePrice, discountPercent) =>
    set((state) => {
      const nextMode: ChatViewMode =
        state.mode === 'expanded' ? 'expanded' : 'floating';
      return {
        mode: nextMode,
        isOpen: true,
        pendingProduct: {
          idProduk: product.idProduk,
          namaProduk: product.namaProduk,
          kategori: product.kategori,
          harga: effectivePrice ?? product.hargaEceran,
          gambar: product.gambar,
          isClearance: Boolean(product.isClearance),
          diskonPersen: discountPercent ?? product.diskonPersen ?? 0,
        },
      };
    }),
  clearPendingProduct: () => set({ pendingProduct: null }),
}));

const STORAGE_KEY = 'ff_live_chat_messages_v1';

export function readLocalMessages(): ChatMessageItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalMessages(messages: ChatMessageItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new Event('ff-chat-updated'));
  } catch {
    // Abaikan jika storage penuh
  }
}

export async function fetchCustomerMessages(
  customerId: string
): Promise<ChatMessageItem[]> {
  try {
    const res = await api.get<ChatMessageItem[]>('/api/chats/me');
    if (Array.isArray(res.data)) return res.data;
  } catch {
    // Fallback ke local sync jika endpoint backend belum diaktifkan
  }
  return readLocalMessages().filter((m) => m.idCustomer === customerId);
}

export async function fetchAllAdminMessages(): Promise<ChatMessageItem[]> {
  try {
    const res = await api.get<ChatMessageItem[]>('/api/chats/admin/all');
    if (Array.isArray(res.data)) return res.data;
  } catch {
    // Fallback ke local sync
  }
  return readLocalMessages();
}

export async function sendChatMessage(
  newMsg: Omit<ChatMessageItem, 'idMessage' | 'createdAt' | 'isRead'>
): Promise<ChatMessageItem> {
  const created: ChatMessageItem = {
    ...newMsg,
    idMessage: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await api.post<ChatMessageItem>('/api/chats/send', created);
    if (res.data && res.data.idMessage) {
      return res.data;
    }
  } catch {
    // Simpan ke local sync
  }

  const current = readLocalMessages();
  writeLocalMessages([...current, created]);
  return created;
}

export async function markCustomerMessagesRead(
  customerId: string,
  readerRole: 'CUSTOMER' | 'ADMIN'
): Promise<void> {
  try {
    await api.patch(`/api/chats/read/${customerId}`, null, {
      params: { readerRole },
    });
  } catch {
    // Fallback ke local sync
  }

  const current = readLocalMessages();
  let changed = false;
  const updated = current.map((m) => {
    if (
      m.idCustomer === customerId &&
      m.senderRole !== readerRole &&
      !m.isRead
    ) {
      changed = true;
      return { ...m, isRead: true };
    }
    return m;
  });

  if (changed) {
    writeLocalMessages(updated);
  }
}

// ============================================================================
// SUMBER TUNGGAL ADMIN CHAT & UNREAD COUNT (MENCEGAH POLLING GANDA)
// ============================================================================

const ADMIN_POLL_INTERVAL_MS = 12_000; // 12 detik (rentang 10-15 detik)

interface AdminChatFeedState {
  messages: ChatMessageItem[];
  unreadCount: number;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<ChatMessageItem[]>;
}

function countAdminUnread(messages: ChatMessageItem[]): number {
  return messages.filter(
    (m) => m.senderRole === 'CUSTOMER' && !m.isRead
  ).length;
}

let inFlightAdminFetch: Promise<ChatMessageItem[]> | null = null;

export const useAdminChatFeedStore = create<AdminChatFeedState>((set, get) => ({
  messages: [],
  unreadCount: 0,
  isLoading: true,
  hasLoadedOnce: false,
  error: null,
  refresh: async (options) => {
    if (inFlightAdminFetch) {
      return inFlightAdminFetch;
    }

    const silent = Boolean(options?.silent);
    if (!silent && !get().hasLoadedOnce) {
      set({ isLoading: true, error: null });
    } else if (!silent) {
      set({ error: null });
    }

    inFlightAdminFetch = (async () => {
      try {
        const list = await fetchAllAdminMessages();
        const safeList = Array.isArray(list) ? list : [];
        set({
          messages: safeList,
          unreadCount: countAdminUnread(safeList),
          isLoading: false,
          hasLoadedOnce: true,
          error: null,
        });
        return safeList;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Gagal memuat pesan pelanggan.';
        set({
          isLoading: false,
          error: msg,
        });
        return get().messages;
      } finally {
        inFlightAdminFetch = null;
      }
    })();

    return inFlightAdminFetch;
  },
}));

let adminPollSubscribers = 0;
let adminPollTimer: ReturnType<typeof setInterval> | null = null;

function startAdminPollInterval() {
  if (adminPollTimer !== null || typeof window === 'undefined') return;
  adminPollTimer = setInterval(() => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }
    void useAdminChatFeedStore.getState().refresh({ silent: true });
  }, ADMIN_POLL_INTERVAL_MS);
}

function stopAdminPollInterval() {
  if (adminPollTimer !== null) {
    clearInterval(adminPollTimer);
    adminPollTimer = null;
  }
}

function handleAdminVisibilityChange() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    stopAdminPollInterval();
  } else {
    void useAdminChatFeedStore.getState().refresh({ silent: true });
    startAdminPollInterval();
  }
}

function handleAdminStorageOrCustomEvent() {
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    return;
  }
  void useAdminChatFeedStore.getState().refresh({ silent: true });
}

function subscribeAdminChatPolling(): () => void {
  if (typeof window === 'undefined') return () => {};

  adminPollSubscribers += 1;
  if (adminPollSubscribers === 1) {
    void useAdminChatFeedStore.getState().refresh({ silent: false });
    if (
      typeof document === 'undefined' ||
      document.visibilityState !== 'hidden'
    ) {
      startAdminPollInterval();
    }
    document.addEventListener('visibilitychange', handleAdminVisibilityChange);
    window.addEventListener('storage', handleAdminStorageOrCustomEvent);
    window.addEventListener('ff-chat-updated', handleAdminStorageOrCustomEvent);
  }

  return () => {
    adminPollSubscribers = Math.max(0, adminPollSubscribers - 1);
    if (adminPollSubscribers === 0) {
      stopAdminPollInterval();
      document.removeEventListener(
        'visibilitychange',
        handleAdminVisibilityChange
      );
      window.removeEventListener('storage', handleAdminStorageOrCustomEvent);
      window.removeEventListener(
        'ff-chat-updated',
        handleAdminStorageOrCustomEvent
      );
    }
  };
}

/**
 * Hook bersama untuk mengambil daftar pesan & status loading/error di sisi Admin
 * dengan satu poller terpusat (berhenti saat tab tersembunyi, lanjut saat aktif).
 */
export function useAdminChatMessages() {
  const messages = useAdminChatFeedStore((state) => state.messages);
  const unreadCount = useAdminChatFeedStore((state) => state.unreadCount);
  const isLoading = useAdminChatFeedStore((state) => state.isLoading);
  const error = useAdminChatFeedStore((state) => state.error);
  const refresh = useAdminChatFeedStore((state) => state.refresh);

  useEffect(() => {
    const unsubscribe = subscribeAdminChatPolling();
    return unsubscribe;
  }, []);

  return {
    messages,
    unreadCount,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook ringan untuk membaca jumlah pesan pelanggan yang belum dibaca oleh Admin.
 * Berbagi poller tunggal yang sama dengan `useAdminChatMessages` sehingga tidak memicu request ganda.
 */
export function useAdminUnreadChatCount(): number {
  const unreadCount = useAdminChatFeedStore((state) => state.unreadCount);

  useEffect(() => {
    const unsubscribe = subscribeAdminChatPolling();
    return unsubscribe;
  }, []);

  return unreadCount;
}
