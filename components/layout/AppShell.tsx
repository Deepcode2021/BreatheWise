'use client';

import React, { useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TopBar } from './TopBar';
import { AirQualityProvider } from '@/contexts/AirQualityContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <PreferencesProvider>
      <AirQualityProvider>
        <div className="flex h-screen overflow-hidden animated-bg">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-teal-500 focus:text-slate-950 focus:text-sm focus:font-semibold focus:shadow-lg"
          >
            Skip to main content
          </a>

          {/* Desktop Sidebar */}
          <Sidebar className="hidden md:flex" />

          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={closeSidebar}
              aria-hidden="true"
            />
          )}
          <div
            className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar onNavigate={closeSidebar} />
          </div>

          {/* Main Content */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            <TopBar onMenuClick={toggleSidebar} />
            <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {children}
              </div>
            </main>
          </div>

          {/* Mobile Bottom Navigation */}
          <MobileNav />
        </div>
      </AirQualityProvider>
    </PreferencesProvider>
  );
}

