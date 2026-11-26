# BreatheWise — API Setup Guide

## Required API Keys

### 1. Google Gemini API Key (Required for AI Assistant)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **"Get API key"** → **"Create API key"**
4. Copy the key

Add to `.env.local`:
```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

The app defaults to `gemini-3.5-flash-lite` (configurable via `GEMINI_MODEL`). The API key is **never** sent to the browser — it's used only in Next.js server-side route handlers.

---

## Free APIs (No Key Required)

### Open-Meteo Air Quality API
- **URL**: `https://air-quality-api.open-meteo.com/v1/air-quality`
- **Free**: Yes, unlimited for non-commercial use
- **Provides**: Model-based PM2.5, PM10, NO₂, SO₂, CO, O₃, European AQI
- **Important**: These are **forecast/model estimates**, NOT live monitoring station readings
- **Attribution**: Required — "Weather data by Open-Meteo.com"

### Open-Meteo Geocoding API
- **URL**: `https://geocoding-api.open-meteo.com/v1/search`
- **Free**: Yes, no key needed
- **Provides**: City name to coordinates lookup

---

## Optional API Keys

### OpenAQ API (Station-Level Observations)
- **URL**: `https://api.openaq.org/`
- **Registration**: Free at [openaq.org](https://openaq.org/)
- **Provides**: Real monitoring station PM2.5, PM10 readings
- **Indian stations**: Available for many major cities

Add to `.env.local`:
```
OPENAQ_API_KEY=your_key_here
```

### CPCB / data.gov.in (Official Indian AQI)
- **URL**: `https://api.data.gov.in/resource/`
- **Registration**: Required at [data.gov.in](https://data.gov.in/)
- **Resource ID**: `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69` (CPCB AQI feed)
- **Note**: API stability and coverage varies. Always display data source clearly.

Add to `.env.local`:
```
CPCB_API_KEY=your_key_here
```

---

## AQI Scale Clarification

BreatheWise clearly distinguishes between:

| Source | Scale | Type |
|--------|-------|------|
| CPCB (data.gov.in) | Indian National AQI (0–500) | Official monitoring |
| OpenAQ | Varies by station | Station observation |
| Open-Meteo computed | Indian CPCB sub-indices | Model estimate |
| Open-Meteo native | European AQI (0–100+) | Model estimate |

**Never display model estimates as official government readings.**

---

## Running the Application

```bash
# Copy env file
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000)

