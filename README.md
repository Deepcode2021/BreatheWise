# BreatheWise — Your Personal Clean Air Companion

> **PromptWars Virtual · Challenge 6: Urban Air Quality Assistant**

BreatheWise is an interactive, AI-powered urban air-quality decision-support web application built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **Recharts**, **Open-Meteo APIs**, and **Google Gemini (`gemini-3.5-flash-lite`)**. It helps families and communities navigate urban air pollution and winter smog with transparent environmental data, dynamic daily planning, room-by-room indoor guidance, sustainable transport alternatives, and conversational AI support.

---

## Table of Contents

- [1. Project Objectives](#-1-project-objectives)
- [2. Architecture & Data Flow](#-2-architecture--data-flow)
- [3. Features Overview](#-3-features-overview)
- [4. Indian CPCB AQI Methodology & Data Integrity](#-4-indian-cpcb-aqi-methodology--data-integrity)
- [5. Gemini AI Integration](#-5-gemini-ai-integration)
- [6. CO₂e Impact Methodology](#-6-co₂e-impact-methodology)
- [7. API Endpoints Reference](#-7-api-endpoints-reference)
- [8. Tech Stack & Dependencies](#-8-tech-stack--dependencies)
- [9. Project Structure](#-9-project-structure)
- [10. Setup, Scripts & Testing](#-10-setup-scripts--testing)
- [11. Deployment (Vercel)](#-11-deployment-vercel)
- [12. Transparency, Privacy & Disclaimers](#-12-transparency-privacy--disclaimers)

---

## 1. Project Objectives

- Monitor location-based air quality (city search + browser Geolocation) with explicit data-source attribution.
- Translate Indian CPCB AQI values and individual pollutants (`PM2.5`, `PM10`, `NO₂`, `SO₂`, `CO`, `O₃`) into plain language.
- Provide a **server-side Gemini AI assistant** grounded in live environmental readings, 24-hour hourly forecast trends, and household sensitivity profiles.
- Generate **dynamic daily clean-air routines** driven by hourly model trends rather than static time-of-day assumptions.
- Offer **indoor air-quality guidance** by room, **sustainable lifestyle/commute choices** with transparent CO₂e emission factors, and a **local impact tracker**.
- Support **Family Protection Mode** (`Adults`, `Children`, `Elderly`, `Respiratory Precautions`).

---

## 2. Architecture & Data Flow

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js App Router)                     │
│  Contexts: AirQualityContext (location, AQI, forecast)                   │
│            PreferencesContext (familyMembers, transportMode, purifier)   │
│  Storage:  localStorage (preferences, daily plan, impact tracker,        │
│            community challenge membership, saved location)               │
└──────────────┬──────────────────────────┬──────────────────┬─────────────┘
               │                          │                  │
               ▼                          ▼                  ▼
   GET /api/geocode            GET /api/air-quality   POST /api/assistant
   (Open-Meteo Geocoding)      (Open-Meteo AQ +       (Server-side Gemini +
                                Weather + CPCB AQI)    authoritative AQ fetch)
               │                          │                  │
               ▼                          ▼                  ▼
  geocoding-api.open-meteo.com  air-quality-api.open-meteo.com  Google Gemini API
                                api.open-meteo.com/v1/forecast  (@google/genai)
```

All external API calls are routed through **Next.js Route Handlers** (`app/api/*`). `GEMINI_API_KEY` is read strictly on the server and is never exposed to client JavaScript.

---

## 3. Features Overview

| Section | Route | Capabilities |
|---|---|---|
| **Air Quality Dashboard** | `/` | Estimated Indian AQI semicircle gauge, status & health-implication card, 6 pollutant cards with CPCB NAAQS benchmarks, weather card (temp, humidity, wind), 24-hour Recharts line chart, 5-day forecast cards, city search, geolocation button, data-source badge, stale-data indicator (`>2h`), and demo fallback banner |
| **AI Air Quality Assistant** | `/assistant` | Multi-turn Gemini chat (last 6 turns preserved), 8 quick-start prompt chips, question-adaptive structured cards (`Risk Assessment`, `Summary`, `Air Quality Explanation`, `Recommended Actions`, `Indoor Tips`, `Sustainable Alternatives`, `Environmental Impact`, `Data Source Note`, `Disclaimer`) |
| **Your Clean Air Plan** | `/daily-plan` | 6 time-slot routine (`Morning`, `School & Office Commute`, `Outdoor Exercise Window`, `Afternoon Errands`, `Evening Activities`, `Nighttime Indoor Routine`) computed dynamically from hourly forecast trends, with optional Gemini AI refinement and daily local completion tracking |
| **Smart Indoor Air Guide** | `/indoor-guide` | Interactive 5-room selector (`Bedroom`, `Living Room`, `Kitchen`, `Children's Room`, `Home Office`), 14 expandable recommendations with priority badges, dynamic ventilation banner driven by outdoor AQI trends, HEPA factor guidance (CADR, room size, filter condition, circulation, infiltration), and ozone-cleaner warning |
| **Make Greener Choices** | `/green-choices` | Category-filtered sustainable alternatives (`Transport`, `Household`, `Lifestyle`, `Community`) with baseline replaced, benefits, getting-started tips, and documented emission-factor notes |
| **My Environmental Impact** | `/impact` | Custom Trip CO₂e Calculator (distance, transport mode, replaced vehicle, occupancy), daily eco-action checklist, 7-day Recharts bar chart, category progress bars, and local day-streak counter |
| **Community Air Quality** | `/community` | 6 demo community challenge templates with category filter, expandable participation tips, and locally persisted join/leave status (`Demo community data` clearly labeled) |
| **Settings & Preferences** | `/settings` | Two-column desktop layout for Family Protection Mode (`Adults`, `Children`, `Elderly`, `Respiratory Precautions`), Primary Transport Mode, HEPA Air Purifier toggle, and live Data Sources / Methodology summary |

---

## 4. Indian CPCB AQI Methodology & Data Integrity

Implemented in [`lib/aqi.ts`](lib/aqi.ts) and [`lib/openMeteo.ts`](lib/openMeteo.ts):

### Averaging Windows & Data-Availability Rules
- **24-hour rolling average** (`>= 16` valid hourly points out of 24): `PM2.5`, `PM10`, `NO₂`, `SO₂`.
- **8-hour rolling average** (`>= 6` valid hourly points out of 8): `CO` (converted from `µg/m³` to `mg/m³`), `O₃`.
- **Minimum Pollutant Requirement**: Overall Estimated Indian AQI is calculated **only** when at least **3 pollutants** satisfy their averaging window **and** at least one particulate pollutant (`PM2.5` or `PM10`) is valid.
- **Incomplete Data Handling**: When criteria are unmet, `aqi` is `null` and the dashboard displays an explicit **Incomplete Averaging Data** state explaining why, while still displaying available individual hourly pollutant concentrations without comparing hourly values against 24h/8h benchmarks.

### CPCB Breakpoints Used
Sub-index interpolation formula:

$$I_p = \text{round}\left(\frac{I_{HI} - I_{LO}}{B_{HI} - B_{LO}} \cdot (C_p - B_{LO}) + I_{LO}\right)$$

| AQI Category (Range) | PM2.5 24h (`µg/m³`) | PM10 24h (`µg/m³`) | NO₂ 24h (`µg/m³`) | SO₂ 24h (`µg/m³`) | CO 8h (`mg/m³`) | O₃ 8h (`µg/m³`) |
|---|---|---|---|---|---|---|
| **Good** (`0–50`) | `0–30` | `0–50` | `0–40` | `0–40` | `0–1.0` | `0–50` |
| **Satisfactory** (`51–100`) | `>30–60` | `>50–100` | `>40–80` | `>40–80` | `>1.0–2.0` | `>50–100` |
| **Moderate** (`101–200`) | `>60–90` | `>100–250` | `>80–180` | `>80–380` | `>2.0–10` | `>100–168` |
| **Poor** (`201–300`) | `>90–120` | `>250–350` | `>180–280` | `>380–800` | `>10–17` | `>168–208` |
| **Very Poor** (`301–400`) | `>120–250` | `>350–430` | `>280–400` | `>800–1600` | `>17–34` | `>208–748` |
| **Severe** (`401–500`) | `>250` (cap 500) | `>430` (cap 500) | `>400` (cap 500) | `>1600` (cap 500) | `>34` (cap 500) | `>748` (cap 500) |

- Overall AQI equals the **maximum valid sub-index**, identifying the **dominant pollutant**.
- UI consistently labels values as **"Estimated Indian AQI — CPCB breakpoint methodology"** and explicitly states that Open-Meteo outputs are atmospheric model estimates/forecasts, **not** physical CPCB station readings.

---

## 5. Gemini AI Integration

Implemented across [`lib/assistant.ts`](lib/assistant.ts), [`app/api/assistant/route.ts`](app/api/assistant/route.ts), [`app/assistant/page.tsx`](app/assistant/page.tsx), and [`app/daily-plan/page.tsx`](app/daily-plan/page.tsx):

- **SDK & Model**: `@google/genai` (`v3.6.1`) using `GEMINI_MODEL` (defaults to `gemini-3.5-flash-lite`).
- **Authoritative Server Context**: When location coordinates are supplied (and not in demo mode), `/api/assistant` re-fetches Open-Meteo data server-side (5s timeout) and passes current AQI, 24h/8h pollutants, hourly pollutants, weather, chronological next-24h forecast points, contiguous clean-window summary (`findContiguousCleanWindows`), and household preferences.
- **Question-Adaptive JSON Output**: Uses `responseMimeType: 'application/json'` and `responseSchema` with only `summary` and `dataLimitations` always required so educational/pollutant questions aren't padded with unrelated commute or indoor boilerplate.
- **Resilience & Safety**:
  - Multi-turn history bounded to last 6 turns (max 1,000 chars each); question max 1,500 chars.
  - 25-second `AbortController` timeout (`504`).
  - 1 bounded 900ms retry on transient upstream `503 UNAVAILABLE` high-demand responses.
  - Clean HTTP error mapping (`400`, `429`, `502`, `503`, `504`) without leaking secrets.

---

## 6. CO₂e Impact Methodology

Implemented in [`lib/actions.ts`](lib/actions.ts) and [`app/impact/page.tsx`](app/impact/page.tsx):

- **Formula**:

$$\text{CO}_2\text{e Saved (kg)} = \max\left(0,\ \left(\frac{\text{EF}_{\text{baseline}}}{\text{Occ}_{\text{baseline}}} - \text{EF}_{\text{chosen}}\right) \times \text{Distance}_{\text{km}}\right)$$

- **Baseline Vehicle Emission Factors (`kg CO₂e / vehicle-km`)**: Petrol Car (`0.18`), Diesel Car (`0.17`), Two-Wheeler (`0.045`), Auto-Rickshaw (`0.075`).
- **Chosen Mode Emission Factors (`kg CO₂e / passenger-km`)**: Public Bus (`0.065`), Metro / Electric Rail (`0.035`), Cycling / Walking (`0`), Avoided Trip (`0`), Carpool (`baseline EF / chosen occupancy`).
- All estimates are rounded to **1 decimal place** to avoid false precision, scoped to single trips to prevent double-counting, and **tree planting/care receives `0 kg` immediate daily CO₂e credit** (noted as long-term sequestration only).

---

## 7. API Endpoints Reference

| Method & Route | Query / Body | Response |
|---|---|---|
| `GET /api/air-quality` | `?lat=<num>&lon=<num>&name=<str>&country=<str>&state=<str>` or `?demo=true` | `{ data: AirQualityData, forecast: AirQualityForecast }` (`Cache-Control: public, max-age=1800, stale-while-revalidate=300`; returns `503` with clearly marked demo fallback if upstream fails) |
| `GET /api/geocode` | `?q=<city_name>` | `{ results: Location[] }` (up to 5 matches via Open-Meteo Geocoding) |
| `POST /api/assistant` | `{ question, context?, history? }` | `{ response: AIResponse, model: string }` or safe structured error (`400` / `429` / `502` / `503` / `504`) |

---

## 8. Tech Stack & Dependencies

From [`package.json`](package.json):

- **Core**: `next` (`16.4.6`, App Router + Turbopack), `react` (`19.3.0`), `react-dom` (`19.3.0`), `typescript` (`^5`)
- **Styling**: `tailwindcss` (`4.3.3`), `@tailwindcss/turbopack` (`4.3.3`), `clsx`, `tailwind-merge`, `class-variance-authority`
- **AI**: `@google/genai` (`^3.6.1`)
- **Charts & UI**: `recharts` (`^3.11.1`), `lucide-react` (`^1.81.0`), `date-fns` (`^4.4.0`), `framer-motion` (`^14.14.0`), `@radix-ui/*` primitives
- **Linting**: `eslint` (`^9`), `eslint-config-next` (`16.4.6`)

---

## 9. Project Structure

```text
BreatheWise/
├── app/
│   ├── api/
│   │   ├── air-quality/route.ts    # Open-Meteo proxy + 24h/8h CPCB calculation
│   │   ├── assistant/route.ts      # Server-side Gemini endpoint
│   │   └── geocode/route.ts        # City search proxy
│   ├── assistant/page.tsx          # AI Air Quality Assistant UI
│   ├── community/page.tsx          # Demo community challenges (localStorage)
│   ├── daily-plan/page.tsx         # Dynamic Clean Air Plan UI
│   ├── green-choices/page.tsx      # Sustainable alternatives catalog
│   ├── impact/page.tsx             # Custom trip calculator & daily impact tracker
│   ├── indoor-guide/page.tsx       # Room-by-room indoor air quality guide
│   ├── settings/page.tsx           # Family Protection Mode & preferences
│   ├── globals.css                 # Dark navy/teal glassmorphic theme
│   ├── layout.tsx                  # Root layout & AppShell wrapper
│   ├── not-found.tsx               # 404 page
│   └── page.tsx                    # Live Air Quality Dashboard
├── components/
│   ├── dashboard/                  # AQIGauge, AQIStatusCard, PollutantCards, HourlyChart,
│   │                               # ForecastCards, WeatherCard, LocationSearch,
│   │                               # DataSourceBadge, DashboardSkeleton
│   └── layout/                     # AppShell, Sidebar, TopBar, MobileNav
├── contexts/
│   ├── AirQualityContext.tsx       # Global air quality, geolocation & refresh state
│   └── PreferencesContext.tsx      # Persistent household preferences (useSyncExternalStore)
├── lib/
│   ├── actions.ts                  # Emission factors, CO2e calculator & action templates
│   ├── aqi.ts                      # CPCB breakpoints, 24h/8h averaging & availability rules
│   ├── assistant.ts                # Gemini prompt, schema, sanitizer & error mapping
│   ├── dailyPlan.ts                # Contiguous clean-window & dynamic routine generator
│   ├── demoData.ts                 # Fallback demo payload (clearly labeled)
│   ├── geocoding.ts                # Open-Meteo Geocoding + popular Indian cities
│   ├── openMeteo.ts                # Open-Meteo client & pure payload transformer
│   ├── preferences.ts              # LocalStorage helpers
│   └── utils.ts                    # Timestamp, staleness (>2h) & weather helpers
├── tests/
│   ├── register-alias.mjs          # Native Node TS/path-alias loader for tests
│   ├── aqi.test.ts                 # CPCB breakpoints, averaging & Open-Meteo tests
│   ├── assistant.test.ts           # Gemini helper, validation & error mapping tests
│   └── dailyPlanAndImpact.test.ts  # Dynamic daily plan & CO2e calculation tests
├── types/index.ts                  # Shared TypeScript interfaces
├── .env.example                    # Environment variable placeholders
├── next.config.ts                  # Turbopack CSS rule & image config
├── vercel.json                     # Vercel build/framework settings
├── API_SETUP.md                    # Gemini & optional CPCB/OpenAQ setup guide
├── TESTING.md                      # Manual QA & calculation test checklist
├── GEMINI_INTEGRATION_REPORT.md    # Gemini integration & live test results
└── FINAL_QA_REPORT.md              # Final product refinement QA report
```

---

## 10. Setup, Scripts & Testing

### Prerequisites
- **Node.js 22+** (verified on Node.js `v24.20.0`)
- **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com)

### Installation & Local Run

```bash
cd "BreatheWise"

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Edit .env.local and set:
#   GEMINI_API_KEY=your_actual_key
#   GEMINI_MODEL=gemini-3.5-flash-lite

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Scripts

```bash
npm run dev         # Start Next.js development server
npm run build       # Create production build
npm run start       # Start production server
npm run lint        # Run ESLint (eslint-config-next)
npm run type-check  # Run TypeScript check (tsc --noEmit)
npm test            # Run native Node.js unit tests (tests/*.test.ts)
```

For full verification results, see [`GEMINI_INTEGRATION_REPORT.md`](./GEMINI_INTEGRATION_REPORT.md) and [`FINAL_QA_REPORT.md`](./FINAL_QA_REPORT.md).

---

## 11. Deployment (Vercel)

1. Push the repository to GitHub/GitLab/Bitbucket (`.env*` is ignored via `.gitignore`).
2. Import the project in **Vercel** (`vercel.json` is preconfigured for Next.js).
3. Add Environment Variables in Vercel Project Settings:
   - `GEMINI_API_KEY` = your Gemini API key
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
4. Deploy. All API routes (`/api/air-quality`, `/api/geocode`, `/api/assistant`) run server-side as Next.js route handlers.

---

## 12. Transparency, Privacy & Disclaimers

- **Data Sources**: Current and forecast readings use the Open-Meteo Atmospheric Air Quality Model (`forecast/estimate`), **not** physical CPCB monitoring stations. When live APIs fail, BreatheWise activates a clearly labeled **Demo Mode**.
- **Indoor & Community Scope**: Indoor Air Guide provides general building-science guidance without connected indoor sensors. Community challenges use clearly labeled **Demo community data** stored locally in your browser.
- **Privacy**: Preferences, daily plan progress, logged impact actions, and community challenge memberships are stored locally in browser `localStorage` with no user tracking database.
- **Medical Disclaimer**: BreatheWise is an informational decision-support tool. It never diagnoses medical conditions and does not replace professional medical advice.

---

## License

MIT License — Built for PromptWars Virtual Challenge 6.
