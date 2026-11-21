'use client';

import React, {
  useState,
  useEffect,
  Suspense,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Snowflake,
  Home,
  ShoppingBag,
  Package,
  User,
  LogIn,
  LogOut,
  ShieldCheck,
  PanelLeftClose,
  Menu,
  X,
  MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useCartStore } from '@/store/cart-store';
import {
  useChatStore,
  fetchCustomerMessages,
} from '@/store/chat-store';
import CustomerAvatar from '@/components/shop/customer-avatar';
import ChatWidget from '@/components/shop/chat-widget';

const emptySubscribe = () => () => {};

function ShopSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const items = useCartStore((state) => state.items);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const { mode: chatMode, setMode: setChatMode } = useChatStore();

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [isDesktopHidden, setIsDesktopHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('ff-sidebar-hidden') === '1';
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const activeUser = mounted ? user : null;
  const customerId =
    activeUser?.idUser || activeUser?.email || 'guest-customer';

  // Sinkronkan jumlah pesan belum dibaca untuk badge menu "Chat Admin" di sidebar
  useEffect(() => {
    if (!mounted || !activeUser || activeUser.tipeAkun === 'ADMIN') return;

    const syncUnread = async () => {
      const list = await fetchCustomerMessages(customerId);
      const unread = list.filter(
        (m) => m.senderRole === 'ADMIN' && !m.isRead
      ).length;
      setUnreadChatCount(unread);
    };

    syncUnread();
    const timer = setInterval(syncUnread, 2500);
    const handleUpdate = () => syncUnread();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('ff-chat-updated', handleUpdate);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('ff-chat-updated', handleUpdate);
    };
  }, [mounted, activeUser, customerId, chatMode, pathname]);

  const toggleDesktopSidebar = () => {
    setIsDesktopHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ff-sidebar-hidden', next ? '1' : '0');
      } catch {
        // Abaikan
      }
      return next;
    });
  };

  const totalCartItems = mounted ? getTotalItems() : 0;
  void items;

  const handleLogout = () => {
    setChatMode('minimized');
    logout();
    setIsMobileOpen(false);
    router.push('/login');
  };

  const isOnChatRoute =
    pathname === '/chat' || pathname.startsWith('/chat/');

  const navItems = [
    {
      label: 'Beranda & Katalog',
      href: '/',
      icon: Home,
      active: pathname === '/' || pathname.startsWith('/products'),
    },
    {
      label: 'Keranjang & Checkout',
      href: '/checkout',
      icon: ShoppingBag,
      active: pathname.startsWith('/checkout'),
      badge: totalCartItems > 0 ? String(totalCartItems) : undefined,
    },
    {
      label: 'Pesanan Saya',
      href: '/orders',
      icon: Package,
      active: pathname.startsWith('/orders'),
    },
    {
      label: 'Profil Saya',
      href: '/profile',
      icon: User,
      active: pathname.startsWith('/profile'),
    },
  ];

  return (
    <>
      {/* Tombol Pembuka Mengambang saat Sidebar Disembunyikan (Desktop & Mobile) */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsMobileOpen(true);
          } else {
            toggleDesktopSidebar();
          }
        }}
        title="Tampilkan Menu Navigasi"
        className={`fixed top-3.5 left-3.5 z-50 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E6E8F0] text-[#171725] hover:text-[#4737FF] hover:border-[#4737FF]/40 shadow-sm text-xs font-semibold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
          isDesktopHidden ? 'lg:inline-flex' : 'lg:hidden'
        }`}
      >
        <Menu className="w-4 h-4 text-[#4737FF]" />
        <span className="hidden sm:inline">Menu</span>
      </button>

      {/* Backdrop Drawer Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Panel Sidebar Pelanggan */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white border-r border-[#E6E8F0] flex flex-col justify-between transition-all duration-300 shrink-0 ${
          isMobileOpen
            ? 'translate-x-0 w-64 p-4 shadow-lg'
            : '-translate-x-full lg:translate-x-0'
        } ${
          isDesktopHidden
            ? 'lg:w-0 lg:p-0 lg:border-r-0 lg:overflow-hidden'
            : 'lg:w-64 lg:p-4'
        }`}
      >
        <div className="space-y-5 min-w-[220px]">
          {/* Header Brand + Tombol Sembunyikan */}
          <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#E6E8F0]">
            <Link
              href="/"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 min-w-0 focus-visible:outline-2 focus-visible:outline-[#4737FF] rounded-lg"
            >
              <div className="w-9 h-9 rounded-xl bg-[#4737FF] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Snowflake className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="font-heading text-base font-bold text-[#171725] block leading-tight truncate">
                  Froznfood
                </span>
                <span className="ff-eyebrow text-xs font-semibold text-[#5F6479] block mt-0.5">
                  Lezzat 2.0
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setIsMobileOpen(false);
                } else {
                  toggleDesktopSidebar();
                }
              }}
              title="Sembunyikan Sidebar"
              aria-label="Sembunyikan Sidebar"
              className="p-2 rounded-lg text-[#5F6479] hover:text-[#171725] hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#4737FF]"
            >
              <PanelLeftClose className="w-4 h-4 hidden lg:block" />
              <X className="w-4 h-4 lg:hidden" />
            </button>
          </div>

          {/* D. Menu Navigasi Pelanggan */}
          <nav aria-label="Menu pelanggan" className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.06em] text-[#5F6479] mb-2">
              MENU PELANGGAN
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  aria-current={item.active ? 'page' : undefined}
                  className={`min-h-[42px] flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
                    item.active
                      ? 'bg-[#4737FF] text-white font-semibold shadow-xs'
                      : 'text-[#4B5068] font-medium hover:bg-slate-100 hover:text-[#171725]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                        item.active
                          ? 'bg-white text-[#4737FF]'
                          : 'bg-[#F75C03] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Tautan Menu "Chat Admin" -> Route /chat (Mode Expanded) */}
            {activeUser?.tipeAkun !== 'ADMIN' && (
              <Link
                href="/chat"
                onClick={() => {
                  setIsMobileOpen(false);
                  setChatMode('expanded');
                }}
                aria-current={isOnChatRoute ? 'page' : undefined}
                className={`min-h-[42px] flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF] ${
                  isOnChatRoute
                    ? 'bg-[#4737FF] text-white font-semibold shadow-xs'
                    : 'text-[#4B5068] font-medium hover:bg-slate-100 hover:text-[#171725]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MessageCircle className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">Chat Admin</span>
                </div>
                {unreadChatCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                      isOnChatRoute
                        ? 'bg-white text-[#4737FF]'
                        : 'bg-[#F75C03] text-white'
                    }`}
                  >
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </span>
                )}
              </Link>
            )}

            {activeUser?.tipeAkun === 'ADMIN' && (
              <div className="pt-2 mt-2 border-t border-[#E6E8F0]">
                <Link
                  href="/admin/dashboard"
                  onClick={() => setIsMobileOpen(false)}
                  className="min-h-[42px] flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#4737FF]/10 text-[#4737FF] hover:bg-[#4737FF] hover:text-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
                >
                  <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
                  <span>Buka SaaS Admin</span>
                </Link>
              </div>
            )}
          </nav>

          {/* Kartu "Suhu Gudang": judul 13px berat 600, isi 12-13px warna sekunder */}
          <div className="rounded-xl bg-slate-50 border border-[#E6E8F0] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-[#171725]">Suhu Gudang</span>
              <span className="font-bold text-[#159A68] text-xs">
                -18°C Fresh
              </span>
            </div>
            <p className="text-xs text-[#4B5068] leading-relaxed">
              Gratis ongkir ≤ 5 km • Sameday order sebelum 15.00 WIB.
            </p>
          </div>
        </div>

        {/* Bagian Bawah: Status Akun + Foto Profil */}
        <div className="pt-3.5 border-t border-[#E6E8F0] min-w-[220px]">
          {activeUser ? (
            <div className="space-y-2.5">
              <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-[#E6E8F0] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CustomerAvatar
                    user={activeUser as unknown as Record<string, unknown>}
                    size="sm"
                    enablePreview
                  />
                  <Link
                    href="/profile"
                    onClick={() => setIsMobileOpen(false)}
                    className="min-w-0 hover:text-[#4737FF] transition-colors"
                  >
                    <p className="text-sm font-semibold text-[#171725] truncate">
                      {activeUser.nama}
                    </p>
                    <p className="text-xs text-[#5F6479] truncate">
                      {activeUser.email}
                    </p>
                  </Link>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#4737FF]/10 text-[#4737FF] text-xs font-bold shrink-0">
                  {activeUser.tipeAkun}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#4B5068] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setIsMobileOpen(false)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#4737FF] hover:bg-[#3529BF] text-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk</span>
              </Link>
              <Link
                href="/register"
                onClick={() => setIsMobileOpen(false)}
                className="min-h-[40px] inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#171725] text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4737FF]"
              >
                <span>Daftar</span>
              </Link>
            </div>
          )}
        </div>
      </aside>
      <ChatWidget isDesktopSidebarHidden={isDesktopHidden} />
    </>
  );
}

export default function ShopSidebar() {
  return (
    <Suspense
      fallback={
        <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-[#E6E8F0] p-4 h-screen" />
      }
    >
      <ShopSidebarContent />
    </Suspense>
  );
}
