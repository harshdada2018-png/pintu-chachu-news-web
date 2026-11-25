/**
 * PublicSpark Weather Engine Service
 * Connects to Open-Meteo via backend proxy with 20-min smart caching.
 * Zero API keys, 100% free, automatic GPS detection and global city search.
 */

export const POPULAR_CITIES = [
  { nameHindi: 'जैतहरी', nameEnglish: 'Jaitahari', state: 'MP', lat: 23.03, lon: 81.78 },
  { nameHindi: 'अनूपपुर', nameEnglish: 'Anuppur', state: 'MP', lat: 23.10, lon: 81.69 },
  { nameHindi: 'भोपाल', nameEnglish: 'Bhopal', state: 'MP', lat: 23.25, lon: 77.40 },
  { nameHindi: 'नई दिल्ली', nameEnglish: 'New Delhi', state: 'Delhi', lat: 28.61, lon: 77.20 },
  { nameHindi: 'इंदौर', nameEnglish: 'Indore', state: 'MP', lat: 22.72, lon: 75.83 },
  { nameHindi: 'मुंबई', nameEnglish: 'Mumbai', state: 'MH', lat: 19.07, lon: 72.87 }
];

const WEATHER_CACHE_KEY = 'ps_weather_data_v2';
const WEATHER_LOC_KEY = 'ps_weather_loc_v2';

/**
 * WMO Weather Interpretation Codes (WMO Code 0-99)
 */
export function getWeatherConditionMeta(code = 0, isDay = 1) {
  const c = Number(code);

  if (c === 0) {
    return {
      labelHindi: 'साफ आसमान',
      labelEnglish: 'Clear Sky',
      iconName: isDay ? 'Sun' : 'Moon',
      accentColor: '#D97706',
      badgeBg: '#FEF3C7'
    };
  }
  if (c === 1) {
    return {
      labelHindi: 'मुख्यतः साफ',
      labelEnglish: 'Mainly Clear',
      iconName: isDay ? 'CloudSun' : 'CloudMoon',
      accentColor: '#B45309',
      badgeBg: '#FEF3C7'
    };
  }
  if (c === 2) {
    return {
      labelHindi: 'आंशिक बादल',
      labelEnglish: 'Partly Cloudy',
      iconName: isDay ? 'CloudSun' : 'CloudMoon',
      accentColor: '#0284C7',
      badgeBg: '#E0F2FE'
    };
  }
  if (c === 3) {
    return {
      labelHindi: 'घने बादल',
      labelEnglish: 'Overcast',
      iconName: 'Cloud',
      accentColor: '#475569',
      badgeBg: '#F1F5F9'
    };
  }
  if (c === 45 || c === 48) {
    return {
      labelHindi: 'कोहरा छाया है',
      labelEnglish: 'Foggy Atmosphere',
      iconName: 'CloudFog',
      accentColor: '#64748B',
      badgeBg: '#F1F5F9'
    };
  }
  if (c >= 51 && c <= 57) {
    return {
      labelHindi: 'हल्की बूंदाबांदी',
      labelEnglish: 'Light Drizzle',
      iconName: 'CloudDrizzle',
      accentColor: '#0284C7',
      badgeBg: '#E0F2FE'
    };
  }
  if (c >= 61 && c <= 67) {
    return {
      labelHindi: 'बारिश हो रही है',
      labelEnglish: 'Moderate Rain',
      iconName: 'CloudRain',
      accentColor: '#2563EB',
      badgeBg: '#DBEAFE'
    };
  }
  if (c >= 71 && c <= 77) {
    return {
      labelHindi: 'बर्फबारी',
      labelEnglish: 'Snowfall',
      iconName: 'Cloud',
      accentColor: '#0284C7',
      badgeBg: '#E0F2FE'
    };
  }
  if (c >= 80 && c <= 82) {
    return {
      labelHindi: 'तेज बौछारें',
      labelEnglish: 'Heavy Showers',
      iconName: 'CloudRain',
      accentColor: '#1D4ED8',
      badgeBg: '#DBEAFE'
    };
  }
  if (c >= 95 && c <= 99) {
    return {
      labelHindi: 'गरज-चमक के साथ आंधी',
      labelEnglish: 'Thunderstorm',
      iconName: 'CloudLightning',
      accentColor: '#7C3AED',
      badgeBg: '#F3E8FF'
    };
  }

  return {
    labelHindi: 'सामान्य मौसम',
    labelEnglish: 'Moderate Weather',
    iconName: isDay ? 'Sun' : 'Cloud',
    accentColor: '#475569',
    badgeBg: '#F1F5F9'
  };
}

/**
 * Fetch live weather from backend proxy
 */
export async function fetchLiveWeather(lat, lon, cityName = '') {
  try {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.set('lat', String(lat));
      params.set('lon', String(lon));
    }
    if (cityName) {
      params.set('city', cityName);
    }

    const res = await fetch(`/api/weather?${params.toString()}`);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();

    // Cache to client localStorage (15 minutes validity)
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (_cErr) {}

    return data;
  } catch (err) {
    console.warn('[Weather Service] API error:', err.message);
    // Try returning cached weather
    const cached = getCachedWeather();
    if (cached) return cached;
    throw err;
  }
}

/**
 * Search cities for weather lookup
 */
export async function searchWeatherCities(query) {
  const clean = String(query || '').trim();
  if (clean.length < 2) return [];

  try {
    const res = await fetch(`/api/weather/search?q=${encodeURIComponent(clean)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[Weather Search] Error:', err.message);
    return [];
  }
}

/**
 * Detect browser GPS geolocation with graceful fallback
 */
export function detectBrowserGeolocation() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation not supported by this browser'));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        let msg = 'Location access denied or unavailable';
        if (error.code === 1) msg = 'Location permission denied by user';
        else if (error.code === 2) msg = 'Position unavailable';
        else if (error.code === 3) msg = 'Location request timed out';
        reject(new Error(msg));
      },
      { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false }
    );
  });
}

/**
 * Get cached weather from localStorage (valid for 15 mins)
 */
export function getCachedWeather() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && (Date.now() - parsed.timestamp < 15 * 60 * 1000)) {
      return parsed.data;
    }
  } catch (_e) {}
  return null;
}

/**
 * Get stored weather location preference
 */
export function getStoredWeatherLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_LOC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_e) {}
  return null;
}

/**
 * Save user's selected weather location preference
 */
export function saveStoredWeatherLocation(loc) {
  try {
    if (loc) {
      localStorage.setItem(WEATHER_LOC_KEY, JSON.stringify(loc));
    }
  } catch (_e) {}
}

