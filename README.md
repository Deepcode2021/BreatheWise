# BreatheWise 🌬️

**Your Personal Clean Air Companion** — AI-powered urban air quality decision-support application

> PromptWars Virtual · Challenge 6: Urban Air Quality Assistant

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌍 **Air Quality Dashboard** | Model-estimated Indian AQI (CPCB breakpoint methodology), 24h/8h averaged pollutants, 24-hour trend chart, 5-day forecast, weather conditions, and stale-data indicator |
| 🤖 **AI Air Quality Assistant** | Server-side Google Gemini (`gemini-3.5-flash-lite`) chat with multi-turn memory, structured JSON responses, and authoritative server-resolved environmental context |
| 📅 **My Clean Air Plan** | Dynamic daily routines driven by 24-hour hourly model trends, Indian CPCB category guidance, and family protection settings (with optional Gemini AI refinement) |
| 🏠 **Indoor Air Guide** | Room-by-room practical guidance (Bedroom, Living Room, Kitchen, Children's Room, Home Office), dynamic outdoor-trend ventilation advice, and ozone-cleaner safety warning |
| 🌱 **Green Choices** | Sustainable transport, household, and lifestyle alternatives with transparent emission factors and baseline assumptions |
| 📊 **My Environmental Impact** | Interactive custom trip CO₂e calculator, daily action checklist, 7-day bar chart, and local streak tracking |
| 👥 **Community Challenges** | Demo community challenge templates with locally persisted membership (`localStorage`) |
| ⚙️ **Family Protection Mode** | Household profile (Adults, Children, Elderly, Respiratory Precautions), primary transport mode, and HEPA purifier settings |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ (tested with Node.js v24.20.0)
- Google Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Setup

```bash
cd BreatheWise

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local and set GEMINI_API_KEY and GEMINI_MODEL

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

- `GEMINI_API_KEY` is read **only on the server** inside `app/api/assistant/route.ts` and is never exposed to browser JavaScript.
- `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` if omitted.
- `.env*` files are ignored by `.gitignore`.

See [API_SETUP.md](./API_SETUP.md) for full API configuration details.

---

## 🧪 Scripts & Verification

```bash
npm run dev         # Start development server
npm run build       # Production build
npm run start       # Start production server
npm run lint        # Run ESLint
npm run type-check  # Run TypeScript compiler checks (tsc --noEmit)
npm test            # Run native Node.js unit test suite (tests/*.test.ts)
```

---

## 🏗️ Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- **UI & Charts**: Lucide React icons, Recharts, responsive dark navy & teal glassmorphic UI
- **AI**: Google Gemini (`gemini-3.5-flash-lite` via `@google/genai` v3.6.1)
- **Environmental Data**: Open-Meteo Air Quality API & Open-Meteo Geocoding API
- **Persistence**: React Context + `useSyncExternalStore` backed by `localStorage`
- **Deployment**: Vercel-ready (`vercel.json`)

---

## 📁 Project Structure

```
app/
├── page.tsx                    # Dashboard
├── assistant/page.tsx          # AI Chat
├── daily-plan/page.tsx         # Dynamic Daily Plan
├── indoor-guide/page.tsx       # Smart Indoor Air Guide
├── green-choices/page.tsx      # Sustainable Alternatives
├── impact/page.tsx             # Environmental Impact Tracker & Trip Calculator
├── community/page.tsx          # Demo Community Challenges
├── settings/page.tsx           # Household & Family Protection Settings
└── api/
    ├── air-quality/route.ts    # Open-Meteo proxy + CPCB averaging calculation
    ├── geocode/route.ts        # Open-Meteo Geocoding proxy
    └── assistant/route.ts      # Server-side Gemini AI endpoint

components/
├── layout/                     # AppShell, Sidebar, TopBar, MobileNav
└── dashboard/                  # AQIGauge, AQIStatusCard, PollutantCards, HourlyChart, ForecastCards, WeatherCard, LocationSearch, DataSourceBadge

lib/
├── aqi.ts                      # CPCB breakpoints, 24h/8h averaging & availability rules
├── openMeteo.ts                # Open-Meteo integration & pure response transformer
├── dailyPlan.ts                # Hourly-trend-driven daily plan generator
├── assistant.ts                # Gemini schema, validation, sanitization & error mapping
├── geocoding.ts                # City search & popular Indian cities
├── demoData.ts                 # Clearly labeled fallback demo data
├── preferences.ts              # LocalStorage preferences helpers
├── actions.ts                  # Emission-factor CO2e calculator & action templates
└── utils.ts                    # Timestamp, staleness, and weather formatting helpers

contexts/
├── AirQualityContext.tsx       # Global air quality & geolocation state
└── PreferencesContext.tsx      # Household preferences state

tests/                          # Native Node.js unit tests (CPCB AQI, Daily Plan, Impact, Gemini helpers)
types/index.ts                  # TypeScript definitions
```

---

## ⚠️ Data Accuracy & Transparency Notice

- **Estimated Indian AQI — CPCB breakpoint methodology**: Computed from Open-Meteo hourly atmospheric model data using 24-hour rolling averages for PM2.5, PM10, NO₂, and SO₂ (minimum 16/24 valid hours) and 8-hour rolling averages for CO and O₃ (minimum 6/8 valid hours), requiring at least 3 valid pollutants including PM2.5 or PM10.
- **Model Estimates vs. Station Readings**: Open-Meteo outputs are atmospheric model estimates/forecasts, **not** physical CPCB monitoring station observations. When averaging criteria are unmet, BreatheWise displays an incomplete AQI state alongside available individual pollutant concentrations.
- **Indoor Guide & Community**: Indoor Air Guide provides building-science guidance (no indoor sensors connected). Community challenges use clearly labeled demo community data with local browser membership storage.
- **Medical Disclaimer**: BreatheWise provides informational guidance only and never diagnoses conditions or replaces professional medical advice.

---

## 📄 License

MIT License — Built for PromptWars Virtual Challenge 6
