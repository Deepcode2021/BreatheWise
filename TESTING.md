# BreatheWise — Testing Guide

## Running Tests

```bash
# Type checking
npm run type-check

# Lint
npm run lint

# Build (also type-checks)
npm run build
```

## Manual Testing Checklist

### Dashboard
- [ ] Location search returns results and updates data
- [ ] "Use my current location" requests geolocation permission
- [ ] AQI gauge animates smoothly
- [ ] All 6 pollutant cards display values or "--" (no fake data)
- [ ] Hourly chart renders with 24 data points
- [ ] 5-day forecast cards display correct dates
- [ ] Weather card shows temperature, humidity, wind
- [ ] Data source badge correctly labels Open-Meteo model data
- [ ] Demo mode banner shows when API is unreachable
- [ ] Refresh button re-fetches data

### AI Assistant
- [ ] Quick question buttons work
- [ ] Chat input accepts Enter key (not Shift+Enter)
- [ ] AI response renders structured content (actions, tips)
- [ ] Risk level badge appears with correct color
- [ ] Error state shown when GEMINI_API_KEY is missing
- [ ] Data limitations section appears in AI responses
- [ ] Disclaimer shown for health-adjacent questions

### Daily Plan
- [ ] Plan generates on page load
- [ ] "Regenerate with AI" button fetches new plan
- [ ] Progress bar updates when items are checked
- [ ] Each card shows: what, when, why, impact, alternative
- [ ] Routine adapts based on current AQI

### Indoor Guide
- [ ] All 5 room buttons are clickable
- [ ] Tip count updates when room changes
- [ ] Tips expand/collapse on click
- [ ] Ozone generator warning is prominently displayed
- [ ] Priority badges show correctly

### Green Choices
- [ ] Category filter buttons work
- [ ] Cards expand on click to show full details
- [ ] CO₂ methodology section visible
- [ ] Disclaimer about estimates visible

### Impact Tracker
- [ ] Actions persist across page refreshes (localStorage)
- [ ] Checking an action updates CO₂ total
- [ ] Weekly chart shows bars for completed days
- [ ] Streak counter increments correctly
- [ ] Category breakdown bars animate on completion

### Community
- [ ] Challenge cards expand tips on click
- [ ] "Join Challenge" button toggles state
- [ ] Category filter works
- [ ] Stats banner shows correct participant counts

### Settings
- [ ] Family member selection toggles correctly (at least 1 required)
- [ ] Transport mode selection updates
- [ ] Air purifier toggle saves preference
- [ ] Preferences persist across page refreshes (localStorage)

### Responsive Design
- [ ] Mobile bottom navigation appears on small screens
- [ ] Desktop sidebar hidden on mobile
- [ ] Dashboard cards stack vertically on mobile
- [ ] Chat bubbles fit on small screens
- [ ] All text is readable at all sizes

### Accessibility
- [ ] All interactive elements have focus rings
- [ ] Buttons have aria-label attributes
- [ ] Navigation has aria-current="page" on active item
- [ ] Color is not the only indicator of AQI status
- [ ] AQI gauge has role="img" with aria-label

## AQI Calculation Testing

The `lib/aqi.ts` file contains the CPCB breakpoint logic.

Test cases for `calculateCPCBAQI`:

| PM2.5 (µg/m³) | Expected AQI sub-index |
|----------------|------------------------|
| 15 | 25 (Good) |
| 45 | 75 (Satisfactory) |
| 75 | 158 (Moderate) |
| 105 | 250 (Poor) |
| 200 | 353 (Very Poor) |

Test cases for `getCPCBCategory`:

| AQI | Category |
|-----|----------|
| 25 | Good |
| 75 | Satisfactory |
| 150 | Moderate |
| 250 | Poor |
| 350 | Very Poor |
| 450 | Severe |

## Known Limitations

1. **Open-Meteo data**: Model-based estimates, not official monitoring station readings
2. **CPCB integration**: Requires API key; station coverage varies
3. **Demo mode**: Activated when Open-Meteo API is unreachable; clearly labeled
4. **CO₂ estimates**: Simplified assumptions — not certified carbon accounting
5. **AI responses**: Dependent on Gemini API; fallback shown when unavailable

