'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Snowflake,
  BarChart3,
  Truck,
  Route,
  Package,
  Users,
  MessageSquare,
  Store,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useAdminUnreadChatCount } from '@/store/chat-store';

function AdminSidebarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const unreadChatCount = useAdminUnreadChatCount();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    router.push('/login');
  };

  const adminNavItems = [
    {
      href: '/admin/dashboard',
      label: 'Laporan & Omzet',
      icon: BarChart3,
      active: pathname.startsWith('/admin/dashboard'),
    },
    {
      href: '/admin/deliveries',
      label: 'Manajemen Pengiriman',
      icon: Truck,
      active:
        pathname.startsWith('/admin/deliveries') &&
        !pathname.startsWith('/admin/deliveries/rute'),
    },
    {
      href: '/admin/deliveries/rute',
      label: 'Rute Kurir',
      icon: Route,
      active: pathname.startsWith('/admin/deliveries/rute'),
    },
    {
      href: '/admin/products',
      label: 'Produk & Batch FEFO',
      icon: Package,
      active: pathname.startsWith('/admin/products'),
    },
    {
      href: '/admin/customers',
      label: 'Data Pelanggan',
      icon: Users,
      active: pathname.startsWith('/admin/customers'),
    },
    {
      href: '/admin/chats',
      label: 'Chat Pelanggan',
      icon: MessageSquare,
      active: pathname.startsWith('/admin/chats'),
      unreadBadge: unreadChatCount > 0 ? unreadChatCount : undefined,
    },
  ];

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 bg-[#101018] text-white px-4 py-3.5 flex items-center justify-between">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-xl"
        >
          <div className="w-8 h-8 rounded-xl bg-[#4737FF] flex items-center justify-center text-white">
            <Snowflake className="w-4 h-4" />
          </div>
          <div>
            <span className="font-heading text-sm font-extrabold tracking-tight block leading-none">
              Froznfood
            </span>
            <span className="text-[10px] text-[#ACA5FF] font-semibold uppercase tracking-widest block mt-0.5">
              SaaS Admin 2.0
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {unreadChatCount > 0 && (
            <Link
              href="/admin/chats"
              aria-label={`Chat Pelanggan (${unreadChatCount} pesan belum dibaca)`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F75C03] text-white text-[11px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={
              mobileOpen ? 'Tutup menu navigasi admin' : 'Buka menu navigasi admin'
            }
            className="p-2 rounded-xl bg-white/10 text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-[#101018]/60 backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-[260px] shrink-0 bg-[#101018] text-white flex flex-col justify-between p-5 transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-xl"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#4737FF] flex items-center justify-center text-white shadow-lg shadow-[#4737FF]/30">
                <Snowflake className="w-5 h-5" />
              </div>
              <div>
                <span className="font-heading text-lg font-extrabold text-white tracking-tight block leading-none">
                  Froznfood
                </span>
                <span className="text-[10px] font-bold tracking-[0.18em] text-[#ACA5FF] uppercase block mt-1">
                  ADMIN WORKSPACE
                </span>
              </div>
            </Link>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#4737FF] text-white font-bold text-xs flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {user?.nama || 'Administrator'}
                </p>
                <p className="text-[11px] text-[#ACA5FF] truncate">
                  {user?.email || 'admin@froznfood.id'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#77788A] mb-2">
              MANAJEMEN OPERASIONAL
            </p>
            <nav aria-label="Menu operasional admin" className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const badgeVal = item.unreadBadge;
                const badgeText =
                  badgeVal && badgeVal > 99 ? '99+' : badgeVal;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={item.active ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      item.active
                        ? 'bg-[#4737FF] text-white shadow-md shadow-[#4737FF]/30'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>

                    {badgeVal && badgeVal > 0 && (
                      <span
                        aria-label={`${badgeVal} pesan belum dibaca`}
                        className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#F75C03] text-white text-[10px] font-extrabold inline-flex items-center justify-center leading-none shrink-0"
                      >
                        {badgeText}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-white/10">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Store className="w-4 h-4 text-[#ACA5FF]" />
            <span>Lihat Toko Pelanggan</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-500/30 hover:bg-red-500/15 text-red-400 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sesi Admin</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default function AdminSidebar() {
  return (
    <Suspense
      fallback={
        <aside className="hidden lg:block w-[260px] shrink-0 bg-[#101018] h-screen" />
      }
    >
      <AdminSidebarInner />
    </Suspense>
  );
}
