'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, AlertCircle, Sparkles, MessageCircle } from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { summarizeHourlyTrend } from '@/lib/dailyPlan';
import type { ChatMessage, AIResponse } from '@/types';
import { generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';

const QUICK_QUESTIONS = [
  'Can I go running outside today?',
  'Should my children play outdoors this evening?',
  'What should I do to improve my bedroom\'s air quality?',
  'Is it better to travel by car or public transport today?',
  'Why is PM2.5 dangerous?',
  'At what time would outdoor exercise be more suitable?',
  'Suggest a clean-air routine for my family.',
  'How can I protect elderly family members from pollution?',
];

function AIResponseCard({ response }: { response: AIResponse }) {
  return (
    <div className="space-y-3">
      {response.riskLevel && (
        <div className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
          response.riskLevel === 'low' && 'bg-green-500/15 text-green-400 border border-green-500/20',
          response.riskLevel === 'moderate' && 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
          response.riskLevel === 'high' && 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
          response.riskLevel === 'very high' && 'bg-red-500/15 text-red-400 border border-red-500/20',
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          Risk: {response.riskLevel}
        </div>
      )}

      <p className="text-sm text-slate-200 leading-relaxed">{response.summary}</p>

      {response.airQualityExplanation && (
        <p className="text-sm text-slate-300 leading-relaxed">{response.airQualityExplanation}</p>
      )}

      {response.recommendedActions && response.recommendedActions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-teal-400 mb-1.5">✓ Recommended Actions</div>
          <ul className="space-y-1">
            {response.recommendedActions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">→</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {response.indoorSuggestions && response.indoorSuggestions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-blue-400 mb-1.5">🏠 Indoor Tips</div>
          <ul className="space-y-1">
            {response.indoorSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {response.sustainableAlternatives && response.sustainableAlternatives.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-emerald-400 mb-1.5">🌱 Sustainable Alternatives</div>
          <ul className="space-y-1">
            {response.sustainableAlternatives.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">◆</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {response.environmentalImpact && response.environmentalImpact.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-teal-300 mb-1.5">🌍 Environmental Impact</div>
          <ul className="space-y-1">
            {response.environmentalImpact.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-teal-300 mt-0.5 flex-shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {response.dataLimitations && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{response.dataLimitations}</span>
        </div>
      )}

      {response.disclaimer && (
        <p className="text-xs text-slate-500 italic">{response.disclaimer}</p>
      )}
    </div>
  );
}

export default function AssistantPage() {
  const { data, forecast } = useAirQuality();
  const { preferences } = usePreferences();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setApiError(null);

      try {
        const hourlySummary = forecast?.hourly ? summarizeHourlyTrend(forecast.hourly) : undefined;
        const context = {
          location: data?.location
            ? {
                name: data.location.name,
                country: data.location.country,
                state: data.location.state,
                coordinates: data.location.coordinates,
              }
            : undefined,
          aqi: data?.aqi
            ? {
                value: data.aqi.value,
                category: data.aqi.category,
                scale: data.aqi.scale,
                methodology: data.aqi.methodology,
                dominantPollutant: data.aqi.dominantPollutant,
              }
            : undefined,
          aqiUnavailableReason: data?.aqiAvailability?.reason,
          pollutants: data?.pollutants,
          instantPollutants: data?.instantPollutants,
          hourlySummary,
          weather: data?.weather,
          preferences: {
            familyMembers: preferences.familyMembers,
            transportMode: preferences.transportMode,
            hasAirPurifier: preferences.hasAirPurifier,
          },
          timestamp: data?.timestamp,
          dataSource: data?.sourceLabel,
          isDemo: data?.isDemo ?? false,
        };

        const history = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, context, history }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error ?? 'AI request failed');
        }

        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: json.response?.summary ?? 'I could not generate a response.',
          timestamp: new Date().toISOString(),
          structured: json.response,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        setApiError(errMsg);

        const errorMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: errMsg,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [data, forecast, preferences, messages, loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] pb-16 md:pb-0">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-teal-400" />
          AI Air Quality Assistant
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Powered by Google Gemini · Uses real environmental data from your location
        </p>
      </div>

      {apiError && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-300" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4 border border-teal-500/20">
              <Sparkles className="w-8 h-8 text-teal-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Ask me anything about air quality</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              I&apos;ll use real data from your location to give you personalized, actionable advice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs text-slate-300 p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 hover:border-teal-500/30 hover:bg-slate-800 transition-all duration-200"
                >
                  <MessageCircle className="w-3 h-3 text-teal-400 inline mr-1.5 mb-0.5" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-teal-500/20">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'chat-bubble-user text-white text-sm'
                  : 'chat-bubble-ai'
              )}
            >
              {msg.role === 'assistant' && msg.structured ? (
                <AIResponseCard response={msg.structured} />
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="chat-bubble-ai px-4 py-3 rounded-2xl">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Analyzing environmental data...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about air quality, health risks, clean-air routines..."
            rows={1}
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/40 rounded-2xl text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all min-h-[48px] max-h-32 overflow-y-auto"
            aria-label="Message input"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center hover:from-teal-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20 flex-shrink-0"
          aria-label="Send message"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Send className="w-5 h-5 text-white" />
          )}
        </button>
      </form>
    </div>
  );
}

