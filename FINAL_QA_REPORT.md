# BreatheWise — Final QA Report

## 1. Summary of Refinements & Changes

1. **Task 1 — Indian CPCB AQI Accuracy Audit ([`lib/aqi.ts`](lib/aqi.ts), [`lib/openMeteo.ts`](lib/openMeteo.ts), [`types/index.ts`](types/index.ts), Dashboard components)**:
   - Verified official CPCB National AQI breakpoints for PM2.5, PM10, NO₂, SO₂, CO (converted from µg/m³ to mg/m³), and O₃ with continuous half-open intervals `(lo, hi]` and upper Severe capping at `500`.
   - Enforced CPCB averaging & data-availability rules: 24-hour rolling average (`>= 16/24` valid hours) for PM2.5, PM10, NO₂, SO₂ and 8-hour rolling average (`>= 6/8` valid hours) for CO, O₃; minimum 3 valid averaged pollutants including at least one of PM2.5 or PM10.
   - Updated Open-Meteo integration to request `past_days=1` and all hourly pollutants (`pm2_5`, `pm10`, `nitrogen_dioxide`, `sulphur_dioxide`, `carbon_monoxide`, `ozone`) to compute rolling 24h/8h CPCB sub-indices.
   - Fixed 5-day forecast bug where CPCB AQI values were previously passed to `openMeteoIndexToInfo` (European AQI), causing moderate/poor days to be misclassified as `Severe`; now uses `getCPCBCategory`.
   - Updated UI labels to `"Estimated Indian AQI — CPCB breakpoint methodology"`, replaced `"Safe limit"` with period-matched `"CPCB NAAQS benchmark"` labels (`24h avg` vs `8h avg`), and handled incomplete averaging windows by showing an explicit incomplete AQI state alongside available individual pollutant concentrations.

2. **Task 2 — Dynamic Daily Plan ([`lib/dailyPlan.ts`](lib/dailyPlan.ts), [`app/daily-plan/page.tsx`](app/daily-plan/page.tsx))**:
   - Replaced fixed assumptions (such as assuming morning air is always cleaner) with hourly-trend analysis (`summarizeHourlyTrend`, `findContiguousCleanWindows`).
   - Added strictly contiguous chronological clean-window detection (`<= 100 AQI`) so separate clean hours are never merged across polluted intervals.
   - Applied official Indian CPCB category guidance and explicitly recommends indoor activities when no suitable outdoor window exists.
   - Added `"Recommendation based on available hourly model estimates."` banner and forecast uncertainty notes.

3. **Task 3 — Smart Indoor Air Guide ([`app/indoor-guide/page.tsx`](app/indoor-guide/page.tsx))**:
   - Removed unverified numerical effectiveness percentages (e.g. `50–90%`, `>99.97%` room-level claims).
   - Documented HEPA purifier factors: CADR, room size/ceiling height, filter condition, indoor air circulation, and outdoor air infiltration.
   - Connected live outdoor AQI and 24h hourly trend data to provide dynamic ventilation guidance while retaining the ozone-generator warning and clarifying that BreatheWise provides guidance rather than direct indoor sensor measurements.

4. **Task 4 — Transparent Environmental Impact Calculations ([`lib/actions.ts`](lib/actions.ts), [`app/impact/page.tsx`](app/impact/page.tsx), [`app/green-choices/page.tsx`](app/green-choices/page.tsx))**:
   - Documented baselines, emission factors, and single-trip/quantity assumptions rounded to 1 decimal place (`calculateTransportCO2Savings`).
   - Added an interactive **Custom Trip CO₂e Calculator** (travel distance, transport mode, baseline vehicle type, occupancy) and avoided double-counting by scoping templates to distinct single trips.
   - Removed immediate daily carbon credits for tree planting/care (`co2Saved: 0`, `isImmediateCO2: false`).

5. **Task 5 — Community Data Transparency ([`app/community/page.tsx`](app/community/page.tsx))**:
   - Removed fabricated live participant totals and city counts; labeled the page `"Demo community data"`.
   - Persisted challenge join/leave membership locally via `localStorage` (`breathewise_community_joined`).

6. **Task 6 — UI Refinements**:
   - Improved secondary text contrast (`text-slate-300`/`text-slate-400` on dark navy), added explicit stale-data indicators (`isTimestampStale`, > 2 hours) in `TopBar`, `DataSourceBadge`, and `AQIStatusCard`.
   - Expanded Settings (`app/settings/page.tsx`) to a centered two-column desktop layout (`max-w-5xl`, `lg:grid-cols-2`), single-column on mobile.
   - Refined Daily Plan cards into distinct Time Window, Recommendation, Why & Impact, and Alternative sections.
   - Fixed the Impact page Recharts bar chart cursor (`rgba(20, 184, 166, 0.12)`), integer Y-axis (`allowDecimals={false}`), `minPointSize={2}`, and empty-state guidance.

7. **Task 7 — Gemini AI Integration & Dynamic Response Upgrade ([`lib/assistant.ts`](lib/assistant.ts), [`app/api/assistant/route.ts`](app/api/assistant/route.ts), [`app/assistant/page.tsx`](app/assistant/page.tsx))**:
   - Migrated default model to `gemini-3.5-flash-lite` via `GEMINI_MODEL` using `@google/genai` v3.6.1.
   - Added server-side authoritative Open-Meteo context resolution when coordinates are provided, chronological next-24h forecast points, 25s timeout, 1-retry on transient 503, and question-adaptive structured JSON output.

---

## 2. Verification & Test Matrix

### Automated Checks (Post-Final Edit)
| Check | Command | Result |
|---|---|---|
| ESLint | `npm run lint` | **Pass** (0 errors, 0 warnings) |
| TypeScript | `npm run type-check` | **Pass** (0 errors) |
| Unit Tests | `npm test` | **Pass** (`26/26` tests across 6 suites) |
| Production Build | `npm run build` | **Pass** (13 routes compiled cleanly) |

### Scenario Verification
| # | Scenario | Verification Method | Result |
|---|---|---|---|
| 1 | Good AQI (`0–50`) | Unit tests (`tests/aqi.test.ts`, `tests/dailyPlanAndImpact.test.ts`) | **Pass** — category `Good`, normal activity guidance, clean window detection |
| 2 | Moderate AQI (`101–200`) | Unit tests + `/api/air-quality?demo=true` (`142 Moderate`) | **Pass** — category `Moderate`, exertion reduction for vulnerable groups |
| 3 | Severe AQI (`401–500`) | Unit tests (`PM2.5=315 -> 451 Severe`, `600 -> capped 500`) + E2E `/api/assistant` (`AQI 435`) | **Pass** — `riskLevel: very high`, indoor workout & school precautions |
| 4 | Missing pollutant values | Unit test (`computeSubIndex(-1)`, `null` handling) + E2E `/api/assistant` | **Pass** — invalid/missing pollutants excluded without crashing or inventing numbers |
| 5 | Incomplete averaging data | Unit tests (`<16/24h`, `<6/8h`, `<3` pollutants, gaseous-only without PM) | **Pass** — returns `aqi: null`, `isValid: false`, preserves `instantPollutants` |
| 6 | API unavailable / Demo mode | `/api/air-quality?demo=true` + code inspection (`AirQualityContext.tsx` catch fallback) | **Pass** — displays demo banner and clearly labeled demo data |
| 7 | Gemini API key missing | Live E2E against `next start` with `GEMINI_API_KEY=""` | **Pass** — HTTP `503` with safe config message |
| 8 | Geolocation permission denied | Code inspection (`AirQualityContext.tsx` error callback) | **Verified by inspection** — surfaces `"Location access denied..."` without breaking state; browser prompt not triggered headlessly |
| 9 | City change & dashboard refresh | Live `/api/geocode?q=Mumbai` + `/api/air-quality` (`Delhi` -> `300 Poor`) | **Pass** — API endpoints & state persistence verified |
| 10 | Family preference change | Unit tests (`generateDynamicDailyPlan` with `children`) + live E2E (`familyMembers: ['adults', 'children']`) | **Pass** — adapts recommendations for children |
| 11 | Daily action completion & persistence | Unit tests (`calculateTransportCO2Savings`, tree `0 kg`) + `useSyncExternalStore`/`localStorage` code check | **Pass** (math verified by tests; browser click persistence verified by code inspection) |
| 12 | Community challenge joining & persistence | Code inspection (`useSyncExternalStore` + `localStorage` `breathewise_community_joined`) + HTTP 200 route check | **Verified by inspection & route load** (headless browser DOM interaction skipped because Chrome remote debugging was unavailable) |

---

## 3. Data Source Limitations & Production Readiness

- **Air Quality Data**: Uses Open-Meteo atmospheric model estimates (not official CPCB monitoring station readings). Optional OpenAQ / CPCB `data.gov.in` station integrations remain future provider extensions (documented in `API_SETUP.md`).
- **Browser Automation**: Headless Chrome DevTools was unavailable in the local environment (`DevToolsActivePort` not present), so interactive DOM clicks in a live browser window were verified via HTTP 200 SSR checks, production build, unit tests, and live API E2E testing rather than screenshots.
- **Production Readiness**: **Ready for deployment/demo** — `lint`, `type-check`, `test` (26/26), `next build`, and live Gemini API + Open-Meteo E2E tests all pass after the final edit.
