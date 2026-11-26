'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WeeklyImpactPoint } from '@/lib/actions';

interface WeeklyImpactChartProps {
  weeklyData: WeeklyImpactPoint[];
  weeklyTotalActions: number;
}

export function WeeklyImpactChart({ weeklyData, weeklyTotalActions }: WeeklyImpactChartProps) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <h2 className="text-sm font-semibold text-slate-200">7-Day Completed Actions</h2>
        <span className="text-xs text-slate-400">Stored locally in your browser</span>
      </div>

      {weeklyTotalActions === 0 && (
        <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-xs text-slate-300">
          No actions completed in the last 7 days yet. Check off an action below or log a trip above to see your daily bars grow.
        </div>
      )}

      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
          <YAxis
            allowDecimals={false}
            domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(20, 184, 166, 0.12)' }}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid rgba(100,116,139,0.45)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#f1f5f9',
            }}
            labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
          />
          <Bar
            dataKey="actions"
            fill="#14b8a6"
            radius={[4, 4, 0, 0]}
            minPointSize={2}
            name="Completed Actions"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
