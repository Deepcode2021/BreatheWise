// Core data types for BreatheWise

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  name: string;
  country: string;
  state?: string;
  coordinates: Coordinates;
}

export type AQIScale = 'India_CPCB' | 'US_AQI' | 'European' | 'OpenMeteo_Index';

export type AQICategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Hazardous'
  | 'Unknown';

export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3';

export interface AQIInfo {
  value: number;
  category: AQICategory;
  scale: AQIScale;
  methodology?: string;
  dominantPollutant?: PollutantKey;
  subIndices?: Partial<Record<PollutantKey, number>>;
  validPollutantCount?: number;
  color: string;
  bgColor: string;
  description: string;
  healthImplication: string;
}

export interface Pollutant {
  key: string;
  name: string;
  value: number | null;
  unit: string;
  safe_limit: number;
  description: string;
}

export interface Pollutants {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
}

export interface PollutantAveragingInfo {
  average: number | null;
  instant: number | null;
  validHours: number;
  requiredHours: number;
  windowHours: 24 | 8;
  isSufficient: boolean;
  unit: string;
  subIndex: number | null;
}

export interface AQIAvailability {
  isValid: boolean;
  reason?: string;
  validPollutants: PollutantKey[];
  hasPM: boolean;
  perPollutant: Record<PollutantKey, PollutantAveragingInfo>;
}

export interface WeatherData {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  weatherCode: number | null;
}

export type DataSource = 'OpenMeteo_Model' | 'OpenAQ_Station' | 'CPCB_Official' | 'Demo';

export interface AirQualityData {
  location: Location;
  aqi: AQIInfo | null;
  pollutants: Pollutants;
  instantPollutants?: Pollutants;
  aqiAvailability?: AQIAvailability;
  weather: WeatherData;
  source: DataSource;
  sourceLabel: string;
  timestamp: string;
  isDemo: boolean;
  isModelEstimate?: boolean;
  error?: string;
}

export interface HourlyDataPoint {
  time: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}

export interface ForecastDay {
  date: string;
  avgAqi?: number | null;
  maxAqi: number | null;
  minAqi: number | null;
  avgPm25: number | null;
  category: AQICategory;
}

export interface AirQualityForecast {
  hourly: HourlyDataPoint[];
  daily: ForecastDay[];
}

// User preferences
export type FamilyMember = 'adults' | 'children' | 'elderly' | 'respiratory';

export interface UserPreferences {
  familyMembers: FamilyMember[];
  lifestyle: string[];
  transportMode: string;
  hasAirPurifier: boolean;
  location?: Location;
}

// AI Chat
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  structured?: AIResponse;
}

export interface AIResponse {
  summary: string;
  riskAssessment?: string;
  airQualityExplanation?: string;
  riskLevel?: string;
  recommendedActions?: string[];
  dailyRoutine?: DailyRoutineItem[];
  indoorSuggestions?: string[];
  sustainableAlternatives?: string[];
  environmentalImpact?: string[];
  dataLimitations?: string;
  disclaimer?: string;
}

// Daily Plan
export type TimeOfDay = 'morning' | 'commute' | 'outdoor-exercise' | 'afternoon' | 'evening' | 'night';

export interface DailyRoutineItem {
  timeOfDay: TimeOfDay;
  timeLabel: string;
  icon: string;
  action: string;
  when: string;
  why: string;
  howItHelps: string;
  alternative: string;
  completed?: boolean;
}

// Indoor Guide
export type Room = 'bedroom' | 'living-room' | 'kitchen' | 'children-room' | 'home-office';

export interface IndoorTip {
  id: string;
  title: string;
  description: string;
  why: string;
  rooms: Room[];
  priority: 'high' | 'medium' | 'low';
}

// Impact Tracker
export interface DailyAction {
  id: string;
  category: 'transport' | 'indoor' | 'lifestyle' | 'community';
  action: string;
  co2Saved: number; // kg CO2e, estimated
  assumption: string;
  baseline?: string;
  emissionFactor?: string;
  isImmediateCO2?: boolean;
  completed: boolean;
  date: string;
}

export interface WeeklyProgress {
  totalActions: number;
  completedActions: number;
  co2Saved: number;
  streak: number;
  byCategory: Record<string, number>;
}

// Community
export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  category: string;
  participants: number;
  duration: string;
  tips: string[];
}
