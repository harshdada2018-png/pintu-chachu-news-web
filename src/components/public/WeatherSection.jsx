import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  MapPin,
  Search,
  Navigation,
  RefreshCw,
  X,
  Thermometer
} from 'lucide-react';
import {
  POPULAR_CITIES,
  getWeatherConditionMeta,
  fetchLiveWeather,
  searchWeatherCities,
  detectBrowserGeolocation,
  getStoredWeatherLocation,
  saveStoredWeatherLocation
} from '../../services/weatherService';

export default function WeatherSection() {
  const [currentCity, setCurrentCity] = useState(() => {
    const saved = getStoredWeatherLocation();
    return saved || { name: 'Jaitahari', lat: 23.03, lon: 81.78, state: 'MP' };
  });

  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const searchContainerRef = useRef(null);

  // Load weather when currentCity changes
  useEffect(() => {
    let isMounted = true;
    async function loadWeather() {
      setLoading(true);
      setErrorMessage('');
      try {
        const data = await fetchLiveWeather(currentCity.lat, currentCity.lon, currentCity.name);
        if (isMounted) {
          setWeatherData(data);
          saveStoredWeatherLocation(currentCity);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage('मौसम डेटा लोड करने में असमर्थ। कृपया पुनः प्रयास करें।');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadWeather();

    return () => { isMounted = false; };
  }, [currentCity]);

  // Handle City Search with Debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchWeatherCities(searchQuery);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (_e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to dismiss search dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle GPS location click
  const handleDetectGps = async () => {
    setGpsLoading(true);
    setErrorMessage('');
    try {
      const coords = await detectBrowserGeolocation();
      setCurrentCity({
        name: 'आपकी वर्तमान लोकेशन',
        lat: coords.lat,
        lon: coords.lon,
        isGps: true
      });
    } catch (err) {
      setErrorMessage(err.message || 'GPS लोकेशन की अनुमति नहीं मिली।');
    } finally {
      setGpsLoading(false);
    }
  };

  const selectCity = (city) => {
    setCurrentCity({
      name: city.name || city.nameEnglish || 'City',
      lat: city.lat !== undefined ? city.lat : city.latitude,
      lon: city.lon !== undefined ? city.lon : city.longitude,
      state: city.state || city.admin1 || ''
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const renderWeatherIcon = (iconName, className = 'w-6 h-6') => {
    switch (iconName) {
      case 'Sun': return <Sun className={className} />;
      case 'Moon': return <Moon className={className} />;
      case 'CloudSun': return <CloudSun className={className} />;
      case 'CloudMoon': return <CloudMoon className={className} />;
      case 'CloudRain': return <CloudRain className={className} />;
      case 'CloudDrizzle': return <CloudDrizzle className={className} />;
      case 'CloudLightning': return <CloudLightning className={className} />;
      case 'CloudFog': return <CloudFog className={className} />;
      default: return <Cloud className={className} />;
    }
  };

  const current = weatherData?.current || {};
  const meta = getWeatherConditionMeta(current.weatherCode || 0, current.isDay ?? 1);

  return (
    <section id="weather-section" className="mb-10 w-full" aria-label="Real-time Weather Forecast">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 sm:p-6 shadow-sm transition-colors duration-200">
        
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center p-1.5 bg-[var(--text-main)] text-[var(--bg-main,#fff)] rounded-sm">
              <Thermometer className="w-4 h-4 text-amber-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[var(--text-main)] font-serif">
                  लाइव मौसम बुलेटिन
                </h2>
                <span className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  REAL-TIME
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-sans">
                ओपन-मेटियो उपग्रह आधारित लाइव मौसम एवं 3-दिवसीय पूर्वानुमान
              </p>
            </div>
          </div>

          {/* GPS Quick Action */}
          <button
            onClick={handleDetectGps}
            disabled={gpsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-main)] hover:bg-[var(--border-color)] transition-all cursor-pointer min-h-[38px] disabled:opacity-50"
            title="वर्तमान GPS स्थान से मौसम देखें"
          >
            {gpsLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--text-accent,#16A34A)]" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span>{gpsLoading ? 'स्थान खोज रहे हैं...' : 'वर्तमान स्थान (GPS)'}</span>
          </button>
        </div>

        {/* City Search Bar & Popular Quick Pills */}
        <div className="mb-6">
          <div className="relative" ref={searchContainerRef}>
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                placeholder="भारत या दुनिया का कोई भी शहर खोजें (उदा. Anuppur, Bhopal, Delhi)..."
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-sm border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--text-main)] font-sans min-h-[44px]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  aria-label="खोज साफ़ करें"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((city) => (
                  <button
                    key={`${city.id}-${city.latitude}`}
                    onClick={() => selectCity(city)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--border-color)] transition-colors flex items-center justify-between border-b last:border-b-0 border-[var(--border-color)] font-sans cursor-pointer text-[var(--text-main)]"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold">{city.name}</span>
                      {city.state && <span className="text-xs text-[var(--text-muted)]">({city.state})</span>}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{city.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick City Pills */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[var(--text-muted)] shrink-0 font-medium text-[11px] uppercase tracking-wider mr-1">
              प्रमुख शहर:
            </span>
            {POPULAR_CITIES.map((city) => {
              const isActive = currentCity.name === city.nameHindi || currentCity.name === city.nameEnglish;
              return (
                <button
                  key={city.nameEnglish}
                  onClick={() => selectCity(city)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-sm border text-xs font-medium transition-all cursor-pointer min-h-[32px] ${
                    isActive
                      ? 'bg-[var(--text-main)] text-[var(--bg-main,#fff)] border-[var(--text-main)] font-bold'
                      : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-main)] hover:bg-[var(--border-color)]'
                  }`}
                >
                  {city.nameHindi}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-sm bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs border border-rose-200 dark:border-rose-900 font-sans">
            {errorMessage}
          </div>
        )}

        {/* Main Weather Content */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-main)]" />
            <p className="text-xs font-semibold tracking-wider uppercase font-sans">लाइव मौसम डेटा लोड हो रहा है...</p>
          </div>
        ) : weatherData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* Primary Current Weather Box */}
            <div className="lg:col-span-7 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-sm p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{currentCity.name} {currentCity.state ? `(${currentCity.state})` : ''}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-[var(--text-main)] font-serif tracking-tight">
                      {current.temperature ?? '--'}°C
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-medium font-sans">
                      महसूस: {current.apparentTemperature ?? current.temperature ?? '--'}°C
                    </span>
                  </div>
                </div>

                {/* Condition Badge with Icon */}
                <div className="text-right">
                  <div className="inline-flex p-3 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] shadow-sm mb-1.5">
                    {renderWeatherIcon(meta.iconName, 'w-8 h-8')}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-main)] font-sans">
                    {meta.labelHindi}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-sans">
                    {meta.labelEnglish}
                  </div>
                </div>
              </div>

              {/* 3 Metric Tiles (Humidity, Wind, Rain) */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border-color)]">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 rounded-sm text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--text-muted)] text-[11px] font-semibold mb-0.5">
                    <Droplets className="w-3 h-3 text-blue-500" />
                    <span>नमी</span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-[var(--text-main)] font-mono">
                    {current.humidity ?? 0}%
                  </div>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 rounded-sm text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--text-muted)] text-[11px] font-semibold mb-0.5">
                    <Wind className="w-3 h-3 text-emerald-500" />
                    <span>हवा</span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-[var(--text-main)] font-mono">
                    {current.windSpeed ?? 0} <span className="text-[10px] font-normal">km/h</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 rounded-sm text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--text-muted)] text-[11px] font-semibold mb-0.5">
                    <CloudRain className="w-3 h-3 text-indigo-500" />
                    <span>बारिश</span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-[var(--text-main)] font-mono">
                    {current.precipitation ?? 0} <span className="text-[10px] font-normal">mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Day Forecast Cards */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-sans mb-0.5">
                आगामी 3-दिवसीय पूर्वानुमान (Forecast)
              </div>
              <div className="grid grid-cols-3 gap-2.5 h-full">
                {Array.isArray(weatherData.daily) && weatherData.daily.slice(0, 3).map((day, idx) => {
                  const dayMeta = getWeatherConditionMeta(day.weatherCode, 1);
                  const dayLabels = ['आज (Today)', 'कल (Tomorrow)', 'परसों (Next Day)'];
                  return (
                    <div
                      key={day.date}
                      className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 rounded-sm flex flex-col items-center justify-between text-center"
                    >
                      <div className="text-[11px] font-bold text-[var(--text-main)] font-sans">
                        {dayLabels[idx] || day.date}
                      </div>
                      <div className="my-2 p-2 rounded-full bg-[var(--bg-surface)] text-[var(--text-main)]">
                        {renderWeatherIcon(dayMeta.iconName, 'w-5 h-5')}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mb-1 leading-tight font-sans line-clamp-1">
                        {dayMeta.labelHindi}
                      </div>
                      <div className="text-xs font-extrabold font-mono text-[var(--text-main)]">
                        {Math.round(day.maxTemp ?? 0)}° / <span className="text-[var(--text-muted)] font-normal">{Math.round(day.minTemp ?? 0)}°</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : null}

        {/* Footer Credit & Satellite Timestamp */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>अद्यतन: {weatherData?.updatedAt ? new Date(weatherData.updatedAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }) : 'लाइव'}</span>
            {weatherData?.isCached && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded-sm font-mono">CACHED (20m)</span>}
          </div>
          <div>स्रोत: Open-Meteo Satellite API (Zero API Cost)</div>
        </div>

      </div>
    </section>
  );
}

