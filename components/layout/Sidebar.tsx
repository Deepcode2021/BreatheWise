'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wind,
  MessageCircle,
  Calendar,
  Home,
  Leaf,
  BarChart3,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Wind },
  { href: '/assistant', label: 'AI Assistant', icon: MessageCircle },
  { href: '/daily-plan', label: 'Daily Plan', icon: Calendar },
  { href: '/indoor-guide', label: 'Indoor Guide', icon: Home },
  { href: '/green-choices', label: 'Green Choices', icon: Leaf },
  { href: '/impact', label: 'My Impact', icon: BarChart3 },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'w-64 flex-shrink-0 flex flex-col h-full bg-slate-900/80 border-r border-slate-700/30',
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/30">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Wind className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-white text-sm leading-none">BreatheWise</div>
          <div className="text-xs text-slate-400 mt-0.5">Clean Air Companion</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                active
                  ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-400 border border-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-teal-400' : 'text-slate-500')} />
              {label}
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700/30">
        <div className="text-xs text-slate-400 leading-relaxed">
          <p className="font-medium text-slate-300 mb-1">PromptWars Virtual</p>
          <p>Challenge 6: Urban Air Quality Assistant</p>
        </div>
      </div>
    </aside>
  );
}

