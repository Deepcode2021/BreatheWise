'use client';

import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-800 rounded-lg shimmer" />
          <div className="h-4 w-72 bg-slate-800 rounded-lg shimmer" />
        </div>
        <div className="h-10 w-72 bg-slate-800 rounded-xl shimmer" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 h-64 bg-slate-800/60 rounded-2xl shimmer" />
        <div className="md:col-span-2 h-64 bg-slate-800/60 rounded-2xl shimmer" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-800/60 rounded-xl shimmer" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="h-56 bg-slate-800/60 rounded-2xl shimmer" />
        <div className="lg:col-span-3 h-56 bg-slate-800/60 rounded-2xl shimmer" />
      </div>
    </div>
  );
}

