'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wind, MessageCircle, Calendar, Home, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Wind },
  { href: '/assistant', label: 'AI Chat', icon: MessageCircle },
  { href: '/daily-plan', label: 'Plan', icon: Calendar },
  { href: '/indoor-guide', label: 'Indoor', icon: Home },
  { href: '/impact', label: 'Impact', icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/30 safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium min-w-0',
                active ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

