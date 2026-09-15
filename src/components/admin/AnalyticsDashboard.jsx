import React, { useState, useEffect } from 'react';
import { Eye, Users, Clock, Globe, TrendingUp, RefreshCw, BarChart2, PieChart, ShieldCheck, Activity } from 'lucide-react';
import { fetchAnalyticsOverview, fetchTrendingArticles } from '../../services/analyticsService';
import { MOCK_ARTICLES } from '../../services/mockData';

const COUNTRY_NAMES = {
  IN: { name: 'India', code: 'IN', color: '#3B82F6' },
  US: { name: 'United States', code: 'US', color: '#10B981' },
  GB: { name: 'United Kingdom', code: 'GB', color: '#8B5CF6' },
  CA: { name: 'Canada', code: 'CA', color: '#F59E0B' },
  BD: { name: 'Bangladesh', code: 'BD', color: '#EF4444' },
  AE: { name: 'United Arab Emirates', code: 'AE', color: '#06B6D4' },
  DE: { name: 'Germany', code: 'DE', color: '#EC4899' }
};

const HOURLY_PEAK_DATA = [
  { hour: '06:00', pct: 15, label: 'Early Morning' },
  { hour: '09:00', pct: 85, label: 'Morning Peak' },
  { hour: '12:00', pct: 60, label: 'Midday' },
  { hour: '15:00', pct: 45, label: 'Afternoon' },
  { hour: '18:00', pct: 70, label: 'Evening' },
  { hour: '21:00', pct: 95, label: 'Night Prime' },
  { hour: '23:00', pct: 40, label: 'Late Night' }
];

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState('week');
  const [chartType, setChartType] = useState('line'); // 'line', 'bar', 'donut', 'hourly'
  const [overview, setOverview] = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [ov, tr] = await Promise.all([
      fetchAnalyticsOverview(),
      fetchTrendingArticles(period)
    ]);
    setOverview(ov);
    setTrending(tr.trending || []);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const countryList = React.useMemo(() => {
    if (!overview || !overview.countryBreakdown) return [];
    const entries = Object.entries(overview.countryBreakdown);
    const total = entries.reduce((acc, [, val]) => acc + val, 0) || 1;
    return entries
      .map(([code, count]) => ({
        code,
        count,
        percentage: parseFloat(((count / total) * 100).toFixed(1)),
        meta: COUNTRY_NAMES[code] || { name: code, code, color: '#6B7280' }
      }))
      .sort((a, b) => b.count - a.count);
  }, [overview]);

  const topCountry = countryList[0] || { meta: { name: 'India', code: 'IN' }, percentage: 65.2 };

  const trendPoints = overview?.recentTrend || [];
  const maxViews = Math.max(...trendPoints.map(p => p.views), 100);
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = 35;

  const pointsString = trendPoints.map((pt, i) => {
    const x = padding + (i / Math.max(trendPoints.length - 1, 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (pt.views / maxViews) * (chartHeight - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaString = trendPoints.length > 0 ? 
    `${padding},${chartHeight - padding} ${pointsString} ${chartWidth - padding},${chartHeight - padding}` : '';

  let cumulativeAngle = 0;
  const donutRadius = 65;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * donutRadius;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Bar & Period Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-main)' }}>
            <BarChart2 color="var(--accent-blue)" size={20} /> Audience Performance Analytics
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0.2rem 0 0 0' }}>
            Real-time reader telemetry, aggregated statistics, and regional demographics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            {[
              { id: 'day', label: 'Today' },
              { id: 'week', label: '7 Days' },
              { id: 'month', label: '30 Days' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  cursor: 'pointer',
                  background: period === tab.id ? 'var(--accent-blue)' : 'transparent',
                  color: period === tab.id ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button 
            onClick={loadData} 
            className="btn btn-outline" 
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Data
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Total Views */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Page Views</span>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '0.4rem', borderRadius: '50%' }}>
              <Eye size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {overview?.totalViews ? overview.totalViews.toLocaleString() : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '0.3rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <TrendingUp size={12} /> +18.4% volume increase
          </div>
        </div>

        {/* Unique Readers */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unique Readers</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.4rem', borderRadius: '50%' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {overview?.uniqueReaders ? overview.uniqueReaders.toLocaleString() : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.3rem' }}>
            Authenticated & unique session tokens
          </div>
        </div>

        {/* Avg Reading Duration */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Read Time</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', padding: '0.4rem', borderRadius: '50%' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {overview?.avgReadTimeSeconds ? `${overview.avgReadTimeSeconds}s` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.3rem' }}>
            Measured via active window heartbeat
          </div>
        </div>

        {/* Top Region */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Primary Territory</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.4rem', borderRadius: '50%' }}>
              <Globe size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-xs)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', fontWeight: '800' }}>
              {topCountry.meta.code}
            </span>
            <span>{topCountry.meta.name}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.3rem' }}>
            {topCountry.percentage}% of total platform traffic
          </div>
        </div>
      </div>

      {/* Main Interactive Graph Unit */}
      <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
        {/* Graph Type Switcher Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-main)' }}>
              <Activity size={18} color="var(--accent-blue)" /> Traffic Analytics Visualizer
            </h4>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-subtle)', margin: '0.2rem 0 0 0' }}>
              Select visualization model to inspect temporal trend, volume comparison, or demographics.
            </p>
          </div>

          {/* Graph Type Toggle Pills with Lucide Icons */}
          <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            {[
              { id: 'line', label: 'Trend Curve', Icon: TrendingUp },
              { id: 'bar', label: 'Volume Bars', Icon: BarChart2 },
              { id: 'donut', label: 'Share Ring', Icon: PieChart },
              { id: 'hourly', label: 'Hourly Density', Icon: Clock }
            ].map(type => {
              const IconComp = type.Icon;
              const isActive = chartType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setChartType(type.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.775rem',
                    fontWeight: '700',
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--accent-blue)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComp size={14} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. Line & Smooth Area Chart */}
        {chartType === 'line' && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', background: 'transparent' }}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = chartHeight - padding - pct * (chartHeight - padding * 2);
                return (
                  <line key={idx} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="var(--border-light)" strokeDasharray="4 4" />
                );
              })}

              {areaString && <polygon points={areaString} fill="url(#viewsGradient)" />}

              {pointsString && (
                <polyline
                  fill="none"
                  stroke="var(--accent-blue)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsString}
                />
              )}

              {trendPoints.map((pt, i) => {
                const x = padding + (i / Math.max(trendPoints.length - 1, 1)) * (chartWidth - padding * 2);
                const y = chartHeight - padding - (pt.views / maxViews) * (chartHeight - padding * 2);
                const dateLabel = pt.date.slice(5);
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="4.5" fill="#ffffff" stroke="var(--accent-blue)" strokeWidth="2.5" />
                    <text x={x} y={chartHeight - 8} fontSize="11" fill="var(--text-subtle)" textAnchor="middle" fontWeight="600">
                      {dateLabel}
                    </text>
                    <text x={x} y={y - 10} fontSize="10" fill="var(--text-main)" textAnchor="middle" fontWeight="700">
                      {pt.views}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* 2. Bar Chart */}
        {chartType === 'bar' && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', background: 'transparent' }}>
              {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = chartHeight - padding - pct * (chartHeight - padding * 2);
                return (
                  <line key={idx} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="var(--border-light)" strokeDasharray="4 4" />
                );
              })}

              {trendPoints.map((pt, i) => {
                const barWidth = 32;
                const slotWidth = (chartWidth - padding * 2) / trendPoints.length;
                const x = padding + i * slotWidth + (slotWidth - barWidth) / 2;
                const barHeight = (pt.views / maxViews) * (chartHeight - padding * 2);
                const y = chartHeight - padding - barHeight;
                const dateLabel = pt.date.slice(5);

                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill="var(--accent-blue)"
                      opacity="0.9"
                    />
                    <text x={x + barWidth / 2} y={chartHeight - 8} fontSize="11" fill="var(--text-subtle)" textAnchor="middle" fontWeight="600">
                      {dateLabel}
                    </text>
                    <text x={x + barWidth / 2} y={y - 8} fontSize="10" fill="var(--text-main)" textAnchor="middle" fontWeight="700">
                      {pt.views}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* 3. Donut Ring Chart */}
        {chartType === 'donut' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', padding: '1rem 0' }}>
            <svg width="200" height="200" viewBox="0 0 200 200">
              <g transform="rotate(-90 100 100)">
                {countryList.map((item) => {
                  const dashArray = (item.percentage / 100) * circumference;
                  const dashOffset = (cumulativeAngle / 100) * circumference;
                  cumulativeAngle += item.percentage;

                  return (
                    <circle
                      key={item.code}
                      cx="100"
                      cy="100"
                      r={donutRadius}
                      fill="none"
                      stroke={item.meta.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${dashArray} ${circumference}`}
                      strokeDashoffset={-dashOffset}
                      style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
                    />
                  );
                })}
              </g>

              <text x="100" y="96" fontSize="18" fontWeight="800" fill="var(--text-main)" textAnchor="middle">
                {topCountry.percentage}%
              </text>
              <text x="100" y="116" fontSize="11" fontWeight="700" fill="var(--text-subtle)" textAnchor="middle">
                {topCountry.meta.name} ({topCountry.meta.code})
              </text>
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {countryList.map(item => (
                <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.meta.color }} />
                  <span style={{ fontWeight: '700' }}>{item.meta.name} ({item.meta.code})</span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>— {item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Hourly Peak Traffic Bar */}
        {chartType === 'hourly' && (
          <div style={{ width: '100%', overflowX: 'auto', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '160px', padding: '0 1rem' }}>
              {HOURLY_PEAK_DATA.map((h, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{h.pct}%</span>
                  <div 
                    style={{ 
                      width: '24px', 
                      height: `${(h.pct / 100) * 110}px`, 
                      background: h.pct > 75 ? 'var(--accent-crimson)' : 'var(--accent-blue)', 
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.4s ease'
                    }} 
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>{h.hour}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trending Articles Leaderboard Table */}
      <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-main)' }}>
            <TrendingUp size={18} color="var(--accent-crimson)" /> Content Performance Index ({period === 'day' ? 'Today' : period === 'month' ? '30 Days' : '7 Days'})
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
            Last synchronized at {lastUpdated}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem', width: '60px' }}>Rank</th>
                <th style={{ padding: '0.75rem 1rem' }}>Article Headline</th>
                <th style={{ padding: '0.75rem 1rem', width: '120px' }}>Total Views</th>
                <th style={{ padding: '0.75rem 1rem', width: '130px' }}>Unique Readers</th>
                <th style={{ padding: '0.75rem 1rem', width: '130px' }}>Avg Read Time</th>
                <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {trending.map((item, idx) => {
                const article = MOCK_ARTICLES.find(a => String(a.id) === String(item.articleId)) || {
                  title: `Editorial Article #${item.articleId}`,
                  category: 'General'
                };
                return (
                  <tr key={item.articleId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '800', color: idx === 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{article.title}</div>
                      <span className="story-category-tag" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', marginTop: '0.2rem', display: 'inline-block' }}>
                        {article.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: 'var(--accent-blue)' }}>
                      {item.totalViews.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                      {item.uniqueViews.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      {item.avgReadDuration}s
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge badge-verified" style={{ fontSize: '0.75rem' }}>
                        <ShieldCheck size={12} /> Verified
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
