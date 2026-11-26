'use client';

import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 h-64 bg-slate-800/60 rounded-2xl shimmer" />
        <div className="md:col-span-2 h-64 bg-slate-800/60 rounded-2xl shimmer" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-800/60 rounded-xl shimmer" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="h-[276px] bg-slate-800/60 rounded-2xl shimmer" />
        <div className="lg:col-span-3 h-[276px] bg-slate-800/60 rounded-2xl shimmer" />
      </div>
    </div>
  );
}
