# BreatheWise — Gemini AI Integration Report

## 1. Model & SDK Details

- **Model**: `gemini-3.5-flash-lite` (read from `GEMINI_MODEL` environment variable via `getConfiguredGeminiModel()`, defaulting to `gemini-3.5-flash-lite`)
- **Official SDK**: `@google/genai` v`3.6.1` (deprecated `@google/generative-ai` is NOT installed or used)
- **Server-Side Initialization**: Initialized exclusively in [`app/api/assistant/route.ts`](app/api/assistant/route.ts) using `process.env.GEMINI_API_KEY`
- **Security**: `GEMINI_API_KEY` is never prefixed with `NEXT_PUBLIC_` and never sent to browser JavaScript; `.env*` files are excluded in [`.gitignore`](.gitignore). Placeholder variables are documented in [`.env.example`](.env.example).

---

## 2. Endpoint Architecture (`POST /api/assistant`)

Implemented across [`app/api/assistant/route.ts`](app/api/assistant/route.ts) and [`lib/assistant.ts`](lib/assistant.ts):

1. **Input Validation**:
   - Rejects malformed JSON (`400`), empty/whitespace questions (`400`), and questions > 1,500 characters (`400`).
   - Returns `503` when `GEMINI_API_KEY` is missing or empty.
2. **Authoritative Server-Side Context Resolution**:
   - When `context.location.coordinates` are present (and `isDemo !== true`), `/api/assistant` re-fetches live Open-Meteo data on the server (`fetchOpenMeteoAirQuality`) with a 5-second timeout rather than trusting client-supplied numbers blindly.
   - Falls back cleanly to sanitized client snapshot if Open-Meteo is unreachable, explicitly noting the fallback in `dataSource`.
3. **Environmental Context Passed to Gemini**:
   - Location (`name`, `state`, `country`)
   - Current Estimated Indian AQI (`value`, `category`, `scale`, `methodology`, `dominantPollutant`) or explicit `aqiUnavailableReason`
   - 24h/8h averaged pollutants (`pm25`, `pm10`, `no2`, `so2`, `co`, `o3`) and current-hour model pollutants
   - Weather (`temperature`, `humidity`, `windSpeed`)
   - 24h hourly forecast summary (`minAqi`, `maxAqi`, `contiguousCleanWindows`, uncertainty note) + chronological 24h forecast points (`time`, `estAqi`, `pm25`)
   - Household & lifestyle preferences (`familyMembers`, `transportMode`, `hasAirPurifier`, `lifestyle`)
   - Data source attribution, timestamp, and `isDemo` flag
4. **Multi-Turn Conversation History**:
   - Sanitizes up to the last **6** messages (`user` / `assistant`), truncating each entry to 1,000 characters, mapped to Gemini `Content[]` turns (`user` / `model`).
5. **Question-Adaptive Structured Output & Validation**:
   - Uses `responseMimeType: 'application/json'` and `responseSchema` with `summary` and `dataLimitations` required, and section fields (`riskAssessment`, `riskLevel`, `airQualityExplanation`, `recommendedActions`, `indoorSuggestions`, `sustainableAlternatives`, `environmentalImpact`, `dailyRoutine`, `disclaimer`) populated only when relevant to the user's question.
   - Runtime validation (`validateAIResponse`) normalizes arrays, risk levels, `dailyRoutine` time slots, and ensures `dataLimitations` is always present.
6. **Timeout, Retry & Error Handling**:
   - Enforces a 25-second `AbortController` timeout (`504`).
   - Performs 1 bounded 900ms retry on transient upstream `503 UNAVAILABLE` high-demand errors.
   - Maps `429` (`RESOURCE_EXHAUSTED`), `503` (`UNAVAILABLE`), `404` (`NOT_FOUND`), `401/403` auth errors, and `502` network failures to safe, user-readable messages without exposing keys or stack traces.

---

## 3. Frontend Integration

- **Assistant Chat ([`app/assistant/page.tsx`](app/assistant/page.tsx))**:
  - Appends user message immediately on submit, displays loading indicator (`Analyzing environmental data...`), sends full context (including coordinates, `hourlySummary`, `hourlyForecast`, and `preferences`) plus last 6 messages to `/api/assistant`.
  - Renders structured sections conditionally (`Risk Assessment`, `Summary`, `Air Quality Explanation`, `Recommended Actions`, `Indoor Tips`, `Sustainable Alternatives`, `Environmental Impact`, `Data Source Note`, `Disclaimer`).
- **Dynamic Daily Plan ([`app/daily-plan/page.tsx`](app/daily-plan/page.tsx))**:
  - Uses `generateDynamicDailyPlan` driven by actual hourly forecast points (`lib/dailyPlan.ts`) and optionally refines via `/api/assistant` (`dailyRoutine`), retaining the dynamic local plan fallback if AI generation fails.

---

## 4. Live & Automated Test Results

### Unit Tests (`npm test` — `tests/assistant.test.ts` + full suite)
- **26 / 26** tests passed (`0` failures), including 6 tests specifically covering `getConfiguredGeminiModel`, `sanitizeHistory`, `sanitizeContext`, `buildContextString`, `validateAIResponse`, and `classifyGeminiError`.

### Live End-to-End API Tests (against `next start` with `gemini-3.5-flash-lite` — `task-629.log`)

| Test Case | HTTP Status | Observed Result |
|---|---|---|
| Empty question (`{ question: "   " }`) | `400` | Rejected with validation error |
| Missing `GEMINI_API_KEY` | `503` | Safe config error returned |
| Q1: Children outdoor play (`"Can my children play outside today?"`) | `200` | `model: gemini-3.5-flash-lite`, `riskLevel: very high`, cited Delhi est. AQI 303 (Very Poor) & all next-24h hours > 285 |
| Q2: Exercise window (`"When is a relatively cleaner outdoor activity window available for running?"`) | `200` | `riskLevel: very high`, cited all next-24h forecast hours > 289 (Very Poor), reported no clean outdoor window exists |
| Q3: Indoor air quality (`"How can I improve my bedroom air quality tonight?"`) | `200` | `riskLevel: very high`, advised closed windows, continuous HEPA purifier, no incense/coils (`actions=3, indoor=5, sustain=1`) |
| Q4: Pollutant explanation (`"What is the difference between PM2.5 and PM10?"`) | `200` | Explained particle diameters (<=2.5 µm vs <=10 µm) with Delhi's `122.6` vs `124.8 µg/m³`; `actions=0, indoor=0, sustain=0` |
| Q5: General family AQI overview (`"Explain today's air quality to my family in simple terms."`) | `503` | Upstream `503 UNAVAILABLE` high-demand error cleanly classified (`"Gemini AI model is temporarily experiencing high demand. Please try again in a moment."`) |
| Distinctness check across HTTP 200 responses | `4/4` | All 4 succeeded question responses had distinct, question-specific summaries |
| Multi-turn follow-up (`"Should we keep the AC on fan mode or closed overnight?"`) | `200` | Preserved bedroom context; advised closed-loop AC mode rather than pulling outdoor air (est. AQI 303) |
| Missing air quality data scenario | `200` | Refused outdoor jogging confirmation because current AQI and 24h forecast were unavailable |
| Severe pollution scenario (synthetic AQI 435, `isDemo: true`) | `200` | `riskLevel: very high`; advised children not to walk to school or play outdoor sports |
| Daily Plan AI generation (`dailyRoutine`) | `200` | Returned 6 structured `dailyRoutine` items |

*(Note: During initial testing prior to adding the 1-retry handler, `.env.local` temporarily pointed to `gemini-3.8-flash` and experienced upstream `503 UNAVAILABLE` spikes; `.env.local` and default code were updated to `gemini-3.5-flash-lite`, and all 13 checks passed on the final build.)*

---

## 5. Remaining Limitations

1. **Upstream Availability & Quotas**: Live AI responses depend on external Google Gemini API availability and key quota; transient `503` or `429` responses fall back to clear error states (and `daily-plan` retains its deterministic hourly-trend generator).
2. **Model-Based Environmental Context**: Open-Meteo provides atmospheric model estimates rather than physical CPCB monitoring station readings; AI explanations explicitly preserve this distinction.
3. **Quota Exceeded / Network Failure**: HTTP `429` and `502` error classification is verified in unit tests (`tests/assistant.test.ts`); live quota exhaustion was not intentionally triggered against the production key.
