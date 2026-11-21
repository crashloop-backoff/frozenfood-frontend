'use client';

import React, { Suspense } from 'react';
import ShopSidebar from '@/components/shop/sidebar';
import ChatWidget from '@/components/shop/chat-widget';

export default function ChatPage() {
  return (
    <div className="lezzat-shell h-dvh max-h-dvh overflow-hidden">
      <ShopSidebar />

      <main className="flex-1 min-w-0 h-dvh max-h-dvh overflow-hidden p-0 sm:p-4 lg:p-5 flex flex-col bg-[#f8fafc]">
        <Suspense
          fallback={
            <div className="w-full max-w-[1080px] mx-auto flex-1 h-full rounded-2xl bg-white border border-slate-200 shadow-sm animate-pulse" />
          }
        >
          <ChatWidget embeddedExpanded />
        </Suspense>
      </main>
    </div>
  );
}
