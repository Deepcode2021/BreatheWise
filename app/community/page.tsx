'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { Users, TreeDeciduous, Bus, Recycle, Star, ChevronDown, ChevronUp, MapPin, Info } from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import type { CommunityChallenge } from '@/types';
import { cn } from '@/lib/utils';

const COMMUNITY_STORAGE_KEY = 'breathewise_community_joined';
const EMPTY_JOINED: string[] = [];
const communityListeners = new Set<() => void>();
let cachedRawJoined: string | null = null;
let cachedJoinedIds: string[] = EMPTY_JOINED;

function subscribeCommunity(callback: () => void) {
  communityListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COMMUNITY_STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    communityListeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function getJoinedSnapshot(): string[] {
  if (typeof window === 'undefined') return EMPTY_JOINED;
  try {
    const raw = localStorage.getItem(COMMUNITY_STORAGE_KEY);
    if (raw !== cachedRawJoined) {
      cachedRawJoined = raw;
      const parsed = raw ? JSON.parse(raw) : EMPTY_JOINED;
      cachedJoinedIds = Array.isArray(parsed) ? parsed : EMPTY_JOINED;
    }
    return cachedJoinedIds;
  } catch {
    return EMPTY_JOINED;
  }
}

function getJoinedServerSnapshot(): string[] {
  return EMPTY_JOINED;
}

const CHALLENGES: CommunityChallenge[] = [
  {
    id: '1',
    title: 'Car-Free Commute Week',
    description: 'Commit to one week of commuting by public transport, cycling, or walking instead of a solo car.',
    category: 'Transport',
    participants: 0,
    duration: '7 days',
    tips: [
      'Plan your route in advance using city metro/bus apps',
      'Combine metro or bus with walking for first/last mile',
      'Log your shifted trips in the Impact Tracker',
    ],
  },
  {
    id: '2',
    title: 'No Waste Burning Pledge',
    description: 'Commit to never burning dry leaves, garden trimmings, or household waste — use municipal pickup or composting.',
    category: 'Awareness',
    participants: 0,
    duration: '30 days',
    tips: [
      'Check your local municipal solid-waste collection schedule',
      'Set up a compost bin for garden and kitchen organics',
      'Share municipal waste-burning helplines with neighbours',
    ],
  },
  {
    id: '3',
    title: 'Native Tree Care Weekend',
    description: 'Participate in a local plantation or adopt and water an existing neighbourhood sapling.',
    category: 'Green Spaces',
    participants: 0,
    duration: 'Weekend',
    tips: [
      'Prioritize native species such as Neem, Peepal, or Arjuna',
      'Commit to watering saplings consistently during dry months',
      'Coordinate with local parks or RWA gardening groups',
    ],
  },
  {
    id: '4',
    title: 'Neighbourhood Carpool Group',
    description: 'Coordinate shared school or office commutes with 2–3 nearby households when transit is unavailable.',
    category: 'Transport',
    participants: 0,
    duration: 'Ongoing',
    tips: [
      'Organize pickup timing with trusted neighbours',
      'Rotate driving duties to share fuel costs fairly',
      'Keep cabin ventilation on recirculate in heavy traffic',
    ],
  },
  {
    id: '5',
    title: 'Neighbourhood Clean-Up Drive',
    description: 'Organize a morning clean-up to divert burnable litter and recyclables from roadside piles.',
    category: 'Community',
    participants: 0,
    duration: '2–3 hours',
    tips: [
      'Coordinate with your housing society or RWA',
      'Bring gloves and separate bags for dry recyclables vs organics',
      'Hand over clean recyclables to local recycling collectors',
    ],
  },
  {
    id: '6',
    title: 'Clean Air Awareness Sharing',
    description: 'Share estimated AQI explanations and indoor source-control tips with 5 families in your community.',
    category: 'Awareness',
    participants: 0,
    duration: 'Ongoing',
    tips: [
      'Explain what PM2.5 and the Indian CPCB AQI categories mean',
      'Remind neighbours not to burn waste or incense indoors during smog',
      'Help elderly neighbours check outdoor trends before walks',
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Transport: '#14b8a6',
  Awareness: '#f59e0b',
  'Green Spaces': '#34d399',
  Community: '#a78bfa',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Transport: Bus,
  Awareness: Star,
  'Green Spaces': TreeDeciduous,
  Community: Users,
};

function ChallengeCard({
  challenge,
  joined,
  onToggleJoin,
}: {
  challenge: CommunityChallenge;
  joined: boolean;
  onToggleJoin: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[challenge.category] ?? '#14b8a6';
  const Icon = CATEGORY_ICONS[challenge.category] ?? Users;

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden transition-colors duration-200"
      style={{ borderColor: joined ? `${color}45` : `${color}20` }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
                {challenge.category}
              </span>
              <span className="text-xs text-slate-300">{challenge.duration}</span>
            </div>
            <h3 className="text-sm font-bold text-white">{challenge.title}</h3>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">{challenge.description}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            {joined ? 'Joined locally (saved in browser)' : 'Demo challenge template'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1 transition-colors px-2 py-1"
              aria-expanded={expanded}
            >
              Tips
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => onToggleJoin(challenge.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200',
                joined
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-teal-500 text-white hover:bg-teal-400 shadow-sm shadow-teal-500/20'
              )}
              aria-pressed={joined}
            >
              {joined ? '✓ Joined' : 'Join Challenge'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-700/40 pt-4 space-y-2">
          <div className="text-xs font-semibold text-slate-200 mb-2">How to Participate</div>
          {challenge.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <span className="text-teal-400 mt-0.5">→</span>
              {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const { data } = useAirQuality();
  const [category, setCategory] = useState('All');
  const joinedIds = useSyncExternalStore(
    subscribeCommunity,
    getJoinedSnapshot,
    getJoinedServerSnapshot
  );

  const toggleJoin = (id: string) => {
    const current = getJoinedSnapshot();
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, serialized);
    } catch {}
    cachedRawJoined = serialized;
    cachedJoinedIds = next;
    communityListeners.forEach((l) => l());
  };

  const categories = ['All', ...Array.from(new Set(CHALLENGES.map((c) => c.category)))];
  const filtered = CHALLENGES.filter((c) => category === 'All' || c.category === category);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-400" />
            Community Air Quality
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Discover clean-air challenges and track your personal participation locally
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs font-semibold w-fit">
          Demo community data
        </span>
      </div>

      {/* Transparency Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-200 text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-300" />
        <div>
          <span className="font-semibold">Demo Community Data (Local Storage Only): </span>
          These challenges are sample templates and are not connected to a live multi-user backend. Your joined challenges are stored locally in your browser.
        </div>
      </div>

      {/* Location context */}
      {data?.location && (
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <MapPin className="w-4 h-4 text-teal-400" />
          <span>
            Initiatives tailored for <strong className="text-white">{data.location.name}</strong> and urban neighbourhoods
          </span>
        </div>
      )}

      {/* Local Stats banner — no fabricated live numbers */}
      <div className="glass-card rounded-2xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold gradient-text">{joinedIds.length}</div>
            <div className="text-xs text-slate-300 mt-1">Your joined challenges</div>
          </div>
          <div>
            <div className="text-2xl font-bold gradient-text">{CHALLENGES.length}</div>
            <div className="text-xs text-slate-300 mt-1">Sample challenges</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-teal-300 mt-2">Local Browser</div>
            <div className="text-xs text-slate-400 mt-1">Storage mode</div>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
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

      {/* Challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            joined={joinedIds.includes(challenge.id)}
            onToggleJoin={toggleJoin}
          />
        ))}
      </div>

      {/* Sample Weekly Neighborhood Ideas */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Recycle className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold text-white">Suggested Neighbourhood Goals</h3>
          </div>
          <span className="text-[11px] text-amber-300 font-medium">Demo community data</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Use your local participation above to start weekly habits with your housing society or school group — such as zero leaf/trash burning days and shared school commutes.
        </p>
      </div>
    </div>
  );
}
