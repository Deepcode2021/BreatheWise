import React from 'react';
import { LocationSearch } from '@/components/dashboard/LocationSearch';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export default function DashboardPage() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Air Quality Dashboard</h1>
          <p className="text-sm text-slate-300 mt-1">
            Model-estimated Indian AQI and pollutant breakdown for your selected location
          </p>
        </div>
        <LocationSearch />
      </div>

      <DashboardClient />
    </div>
  );
}
