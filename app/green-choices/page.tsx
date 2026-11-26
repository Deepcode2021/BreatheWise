'use client';

import React, { useState } from 'react';
import { Leaf, Bus, Bike, Users, Recycle, Zap, Trash2, TreeDeciduous, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GreenChoice {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  instead: string;
  co2Savings: string;
  co2Note: string;
  benefits: string[];
  tips: string[];
}

const GREEN_CHOICES: GreenChoice[] = [
  {
    id: 'public-transport',
    category: 'Transport',
    title: 'Take Bus or Metro',
    description: 'Switch from a solo private car to public transport for your daily commute.',
    icon: Bus,
    color: '#14b8a6',
    instead: 'Driving alone in a petrol car (~0.18 kg CO₂e/km)',
    co2Savings: '~1.3 kg CO₂e net per 10 km trip',
    co2Note: 'Baseline: solo petrol car (1.8 kg CO₂e for 10 km). Public bus/metro blended average (~0.05 kg CO₂e/passenger-km = 0.5 kg for 10 km). Net savings ≈ 1.3 kg CO₂e per trip.',
    benefits: [
      'Reduces urban traffic congestion and tailpipe NO₂',
      'Lowers aggregate particulate contributions from passenger vehicles',
      'Saves fuel and parking costs',
      'Reduces road-level pollution hotspots along busy corridors',
    ],
    tips: [
      'Use your city metro or bus route planner',
      'Pair with a short walk or feeder shuttle for first/last mile',
      'Check AQI before walking along major roads',
    ],
  },
  {
    id: 'cycling',
    category: 'Transport',
    title: 'Cycle or Walk Short Distances',
    description: 'Replace short car errands (around 2–3 km) with cycling or walking when air quality permits.',
    icon: Bike,
    color: '#34d399',
    instead: 'Short solo petrol car trips (~0.18 kg CO₂e/km)',
    co2Savings: '~0.5 kg CO₂e per 2.5 km trip avoided',
    co2Note: 'Baseline: 2.5 km solo petrol car trip (0.18 kg CO₂e/km = 0.45 kg, rounded to ~0.5 kg) minus 0 kg tailpipe emissions for walking/cycling.',
    benefits: [
      'Zero direct tailpipe emissions',
      'Avoids high cold-start exhaust emissions from short car journeys',
      'Reduces neighbourhood traffic density',
      'No fuel or parking cost',
    ],
    tips: [
      'Check AQI before strenuous cycling — avoid heavy exertion if AQI > 100',
      'Use shaded or low-traffic residential lanes away from main roads',
      'Switch to enclosed transit when AQI is Poor or worse',
    ],
  },
  {
    id: 'carpool',
    category: 'Transport',
    title: 'Carpool or Share Rides',
    description: 'Share journeys with colleagues or neighbouring families when public transit is unavailable.',
    icon: Users,
    color: '#a78bfa',
    instead: 'Two separate single-occupancy petrol car trips',
    co2Savings: '~0.9 kg CO₂e per person on a 10 km 2-person carpool',
    co2Note: 'Assumes 2 solo petrol car commutes (1.8 kg CO₂e each) consolidated into 1 shared car (0.9 kg CO₂e/person), saving ~0.9 kg CO₂e per participant.',
    benefits: [
      'Cuts per-passenger emissions roughly in half for 2 riders',
      'Removes extra vehicles from congested corridors',
      'Splits fuel and toll expenses',
      'Reduces peak-hour exhaust emissions',
    ],
    tips: [
      'Coordinate regular schedules with trusted neighbours or coworkers',
      'Combine school pickup runs across nearby households',
      'Keep car cabin air on recirculate during heavy traffic',
    ],
  },
  {
    id: 'no-burning',
    category: 'Household',
    title: 'Avoid Burning Waste',
    description: 'Dispose of dry leaves, paper, and household waste through municipal collection or composting — never burn it.',
    icon: Trash2,
    color: '#f59e0b',
    instead: 'Open burning of dry or mixed waste',
    co2Savings: '~0.8 kg CO₂e per kg of dry waste not burned',
    co2Note: 'Estimate based on mixed dry municipal waste combustion (~0.8 kg CO₂e/kg). Open burning also emits severe smoke, PM2.5, black carbon, and toxic fumes.',
    benefits: [
      'Prevents severe localized PM2.5 and black carbon spikes',
      'Avoids toxic dioxin/furan smoke when plastics are present',
      'Lowers neighbourhood fire hazards',
      'Supports composting and dry-waste recycling',
    ],
    tips: [
      'Segregate wet organic waste for composting and dry waste for municipal pickup',
      'Use dry leaves as garden mulch or compost brown matter',
      'Encourage housing societies to ban leaf/trash burning',
    ],
  },
  {
    id: 'energy-efficient',
    category: 'Household',
    title: 'Use Energy-Efficient Appliances',
    description: 'Use BEE 5-star appliances, LED lighting, and moderate AC temperature settings (24–26°C).',
    icon: Zap,
    color: '#fbbf24',
    instead: 'Older inefficient appliances and low AC setpoints',
    co2Savings: '~0.8 kg CO₂e per 1 kWh of grid electricity saved',
    co2Note: 'Based on Indian electricity grid emission factor (~0.72–0.82 kg CO₂e/kWh, CEA). Actual daily savings depend on appliance wattage and runtime.',
    benefits: [
      'Lowers monthly electricity bills',
      'Reduces electricity demand on fossil-fuel power generation',
      'Indirectly reduces regional SO₂ and particulate emissions',
      'Reduces waste heat in dense urban neighbourhoods',
    ],
    tips: [
      'Look for BEE 5-star energy ratings when replacing appliances',
      'Keep AC filters clean and set cooling to 24–26°C',
      'Switch off standby loads overnight',
    ],
  },
  {
    id: 'reusable',
    category: 'Lifestyle',
    title: 'Carry Reusable Bags and Bottles',
    description: 'Replace single-use plastic bags, cups, and bottles with durable reusable alternatives.',
    icon: Recycle,
    color: '#6ee7b7',
    instead: 'Disposable single-use plastic bags and bottles',
    co2Savings: '~0.1 kg CO₂e per 2 single-use items avoided',
    co2Note: 'Lifecycle production/disposal estimate (~0.04–0.05 kg CO₂e per light disposable bag/bottle). Primary benefit is reducing plastic litter that can end up burned.',
    benefits: [
      'Reduces plastic waste and open-burning feedstock',
      'Prevents clogged urban stormwater drains',
      'Cuts reliance on disposable packaging',
      'Reusable items pay for themselves quickly',
    ],
    tips: [
      'Keep a foldable cloth bag in your backpack or vehicle',
      'Carry a refillable steel water bottle',
      'Decline disposable cutlery for local takeout',
    ],
  },
  {
    id: 'trees',
    category: 'Community',
    title: 'Plant and Care for Native Trees',
    description: 'Join local tree-care drives focusing on native species survival and watering.',
    icon: TreeDeciduous,
    color: '#4ade80',
    instead: 'Unplanted or unmaintained urban spaces',
    co2Savings: 'Long-term sequestration (~5–20 kg CO₂/year once established; 0 kg immediate)',
    co2Note: 'Carbon uptake occurs gradually over many years and depends on survival, watering, species, and soil. Immediate daily carbon offsets are NOT claimed.',
    benefits: [
      'Provides shade that helps cool urban heat islands',
      'Supports urban biodiversity and soil health',
      'Improves neighbourhood livability',
      'Complements (but does not replace) emission reductions',
    ],
    tips: [
      'Plant native hardy species such as Neem, Peepal, or Pongamia',
      'Commit to regular watering for the first 2–3 dry seasons',
      'Coordinate with municipal parks or RWA caretakers',
    ],
  },
];

const CATEGORIES = ['All', 'Transport', 'Household', 'Lifestyle', 'Community'];

function GreenChoiceCard({ choice }: { choice: GreenChoice }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = choice.icon;

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden transition-colors duration-200 hover:border-slate-500/40"
      style={{ borderColor: `${choice.color}20` }}
    >
      <button
        type="button"
        className="w-full text-left p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${choice.color}18`, border: `1px solid ${choice.color}30` }}
          >
            <Icon className="w-5 h-5" style={{ color: choice.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: choice.color }}
                >
                  {choice.category}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">{choice.title}</h3>
              </div>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">{choice.description}</p>
          </div>
        </div>

        {/* CO2 savings preview */}
        <div
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ backgroundColor: `${choice.color}12`, color: choice.color }}
        >
          <Leaf className="w-3.5 h-3.5 flex-shrink-0" />
          Est. impact: {choice.co2Savings}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-700/40 pt-4">
          <div className="flex items-start gap-2">
            <ArrowRightLeft className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-white">Baseline replaced: </span>
              {choice.instead}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-200 mb-2">Environmental Benefits</div>
            <ul className="space-y-1">
              {choice.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-teal-400 mt-0.5">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-200 mb-2">How to Get Started</div>
            <ul className="space-y-1">
              {choice.tips.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-amber-300 mt-0.5">→</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40">
            <div className="text-xs font-semibold text-slate-200 mb-1">Emission Factor & Baseline Assumptions</div>
            <p className="text-xs text-slate-300 leading-relaxed">{choice.co2Note}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GreenChoicesPage() {
  const [category, setCategory] = useState('All');

  const filtered = GREEN_CHOICES.filter((c) => category === 'All' || c.category === category);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Leaf className="w-6 h-6 text-teal-400" />
          Make Greener Choices
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Sustainable alternatives for transport, household, and lifestyle decisions
        </p>
      </div>

      {/* Disclaimer */}
      <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/40 text-xs text-slate-300 leading-relaxed">
        CO₂e savings shown are <strong className="text-white">estimates with transparent baseline and emission-factor assumptions</strong>. They do not calculate personal health risk reduction, which requires validated clinical and exposure measurements.
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200',
              category === cat
                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                : 'glass-card text-slate-300 hover:text-white'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((choice) => (
          <GreenChoiceCard key={choice.id} choice={choice} />
        ))}
      </div>
    </div>
  );
}
