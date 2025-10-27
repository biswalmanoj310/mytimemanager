import { useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
  Bar,
  BarChart,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import apiClient from '../services/api';
import './Analytics.css';

interface PillarData {
  pillar_id: number;
  pillar_name: string;
  color_code: string;
  allocated_hours: number;
  spent_hours: number;
  utilization_percentage: number;
}

interface CategoryData {
  category_id: number;
  category_name: string;
  pillar_name: string;
  allocated_hours: number;
  spent_hours: number;
  utilization_percentage: number;
}

interface TimeDataPoint {
  date: string;
  hours: number;
  minutes: number;
}

interface TimeTrendResponse {
  period: string;
  start_date: string;
  end_date: string;
  data_points: TimeDataPoint[];
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_tracked_date: string | null;
  streak_status: 'active' | 'at_risk' | 'broken' | 'inactive';
  total_tracked_days: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
}

interface BadgeData {
  badges: Badge[];
  total_earned: number;
}

export default function Analytics() {
  const [pillarData, setPillarData] = useState<PillarData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<TimeDataPoint[]>([]);
  const [averageHours, setAverageHours] = useState<number>(0);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | '4weeks' | 'custom'>('today');
  const [selectedPillar, setSelectedPillar] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'overview' | 'categories' | 'tasks' | 'wheel'>('overview');
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  
  // Comparative pillar data for Today/Week/Month
  const [dailyPillarData, setDailyPillarData] = useState<PillarData[]>([]);
  const [weeklyPillarData, setWeeklyPillarData] = useState<PillarData[]>([]);
  const [monthlyPillarData, setMonthlyPillarData] = useState<PillarData[]>([]);
  
  // Comparative category data for Allocated/Today/Week/Month
  const [todayCategoryData, setTodayCategoryData] = useState<CategoryData[]>([]);
  const [weekCategoryData, setWeekCategoryData] = useState<CategoryData[]>([]);
  const [monthCategoryData, setMonthCategoryData] = useState<CategoryData[]>([]);
  const [allCategoriesData, setAllCategoriesData] = useState<CategoryData[]>([]); // Base categories with allocations
  const [showMonthColumn, setShowMonthColumn] = useState(false); // Toggle for month average column

  useEffect(() => {
    loadAnalyticsData();
    loadStreakData();
    loadComparativePillarData();
    loadComparativeCategoryData();
  }, [dateRange, selectedPillar, customStartDate, customEndDate]);

  const loadComparativePillarData = async () => {
    try {
      // Load Today's data
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const dailyResponse = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${todayStr}&end_date=${todayStr}`);
      setDailyPillarData(dailyResponse.data.pillars || []);
      
      // Load This Week's data
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
      const weeklyResponse = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${weekStart.toISOString().split('T')[0]}&end_date=${weekEnd.toISOString().split('T')[0]}`);
      setWeeklyPillarData(weeklyResponse.data.pillars || []);
      
      // Load This Month's data
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const monthlyResponse = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${monthStart.toISOString().split('T')[0]}&end_date=${monthEnd.toISOString().split('T')[0]}`);
      setMonthlyPillarData(monthlyResponse.data.pillars || []);
    } catch (error) {
      console.error('Error loading comparative pillar data:', error);
    }
  };

  const loadStreakData = async () => {
    try {
      const streakResponse = await apiClient.get('/api/streaks/current');
      setStreakData(streakResponse.data);
      
      const badgeResponse = await apiClient.get('/api/streaks/badges');
      setBadgeData(badgeResponse.data);
    } catch (error) {
      console.error('Error loading streak data:', error);
    }
  };

  const loadComparativeCategoryData = async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Load ALL categories with allocated hours (no date filter)
      const allCategoriesResponse = await apiClient.get('/api/analytics/category-breakdown');
      setAllCategoriesData(allCategoriesResponse.data.categories || []);
      console.log('All categories (base):', allCategoriesResponse.data.categories);
      
      // Load Today's category data
      console.log('Loading today category data for:', todayStr);
      const todayResponse = await apiClient.get(`/api/analytics/category-breakdown?start_date=${todayStr}&end_date=${todayStr}`);
      console.log('Today category response:', todayResponse.data);
      setTodayCategoryData(todayResponse.data.categories || []);
      
      // Load This Week's category data
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
      console.log('Loading week category data from:', weekStart.toISOString().split('T')[0], 'to', weekEnd.toISOString().split('T')[0]);
      const weekResponse = await apiClient.get(`/api/analytics/category-breakdown?start_date=${weekStart.toISOString().split('T')[0]}&end_date=${weekEnd.toISOString().split('T')[0]}`);
      console.log('Week category response:', weekResponse.data);
      setWeekCategoryData(weekResponse.data.categories || []);
      
      // Load This Month's category data
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      console.log('Loading month category data from:', monthStart.toISOString().split('T')[0], 'to', monthEnd.toISOString().split('T')[0]);
      const monthResponse = await apiClient.get(`/api/analytics/category-breakdown?start_date=${monthStart.toISOString().split('T')[0]}&end_date=${monthEnd.toISOString().split('T')[0]}`);
      console.log('Month category response:', monthResponse.data);
      setMonthCategoryData(monthResponse.data.categories || []);
    } catch (error) {
      console.error('Error loading comparative category data:', error);
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Load pillar distribution
      const pillarParams = new URLSearchParams();
      if (start) pillarParams.append('start_date', start);
      if (end) pillarParams.append('end_date', end);
      
      const pillarResponse = await apiClient.get(`/api/analytics/pillar-distribution?${pillarParams}`);
      setPillarData(pillarResponse.data.pillars || []);

      // Load category breakdown
      const categoryParams = new URLSearchParams();
      if (start) categoryParams.append('start_date', start);
      if (end) categoryParams.append('end_date', end);
      if (selectedPillar) categoryParams.append('pillar_id', selectedPillar.toString());
      
      const categoryResponse = await apiClient.get(`/api/analytics/category-breakdown?${categoryParams}`);
      setCategoryData(categoryResponse.data.categories || []);

      // Load weekly trend
      const weeks = dateRange === '4weeks' ? 4 : dateRange === 'month' ? 4 : 1;
      const trendParams = new URLSearchParams({
        period: 'week',
        last_n: weeks.toString()
      });
      if (selectedPillar) trendParams.append('pillar_id', selectedPillar.toString());
      
      const trendResponse = await apiClient.get<TimeTrendResponse>(`/api/analytics/time-trend?${trendParams}`);
      const dataPoints = trendResponse.data.data_points || [];
      setWeeklyTrend(dataPoints);
      
      // Calculate average
      if (dataPoints.length > 0) {
        const total = dataPoints.reduce((sum, point) => sum + point.hours, 0);
        setAverageHours(Number((total / dataPoints.length).toFixed(2)));
      } else {
        setAverageHours(0);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    let start = '';
    let end = '';

    if (dateRange === 'custom') {
      start = customStartDate;
      end = customEndDate;
    } else if (dateRange === 'today') {
      start = today.toISOString().split('T')[0];
      end = today.toISOString().split('T')[0];
    } else if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      start = weekAgo.toISOString().split('T')[0];
      end = today.toISOString().split('T')[0];
    } else if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      start = monthAgo.toISOString().split('T')[0];
      end = today.toISOString().split('T')[0];
    } else if (dateRange === '4weeks') {
      const fourWeeksAgo = new Date(today);
      fourWeeksAgo.setDate(today.getDate() - 28);
      start = fourWeeksAgo.toISOString().split('T')[0];
      end = today.toISOString().split('T')[0];
    }

    return { start, end };
  };

  if (loading) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1>Analytics Dashboard</h1>
        
        {/* Streak Counter - Always visible at top */}
        {streakData && (
          <div className={`streak-banner streak-${streakData.streak_status}`}>
            <div className="streak-main">
              <div className="streak-icon">
                {streakData.streak_status === 'active' ? '🔥' : 
                 streakData.streak_status === 'at_risk' ? '⚡' : '💤'}
              </div>
              <div className="streak-info">
                <div className="streak-current">
                  <span className="streak-number">{streakData.current_streak}</span>
                  <span className="streak-label">Day Streak</span>
                </div>
                <div className="streak-status-text">
                  {streakData.streak_status === 'active' && '🎉 Keep it going!'}
                  {streakData.streak_status === 'at_risk' && '⚠️ Track today to keep your streak!'}
                  {streakData.streak_status === 'broken' && '💪 Start a new streak today!'}
                  {streakData.streak_status === 'inactive' && '🚀 Begin your tracking journey!'}
                </div>
              </div>
            </div>
            <div className="streak-stats">
              <div className="stat-item">
                <span className="stat-label">Longest</span>
                <span className="stat-value">{streakData.longest_streak} days</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Days</span>
                <span className="stat-value">{streakData.total_tracked_days}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Badges Display */}
        {badgeData && badgeData.badges.length > 0 && (
          <div className="badges-container">
            <h3>🏆 Your Achievements ({badgeData.total_earned})</h3>
            <div className="badges-grid">
              {badgeData.badges.map((badge) => (
                <div key={badge.id} className="badge-card">
                  <div className="badge-icon">{badge.name.split(' ')[0]}</div>
                  <div className="badge-info">
                    <div className="badge-name">{badge.name}</div>
                    <div className="badge-description">{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* View Mode Tabs */}
        <div className="view-mode-tabs">
          <button 
            className={`tab-button ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`tab-button ${viewMode === 'categories' ? 'active' : ''}`}
            onClick={() => setViewMode('categories')}
          >
            📁 Categories
          </button>
          <button 
            className={`tab-button ${viewMode === 'tasks' ? 'active' : ''}`}
            onClick={() => setViewMode('tasks')}
          >
            ✓ Tasks
          </button>
          <button 
            className={`tab-button ${viewMode === 'wheel' ? 'active' : ''}`}
            onClick={() => setViewMode('wheel')}
          >
            ⭕ Wheel of Life
          </button>
        </div>
        
        <div className="analytics-controls">
          <div className="date-range-selector">
            <label>Date Range:</label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value as any)}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="4weeks">Last 4 Weeks</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="custom-date-inputs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                placeholder="Start Date"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                placeholder="End Date"
              />
            </div>
          )}
        </div>
      </div>

      {/* OVERVIEW MODE: Three-Pillar Cards */}
      {viewMode === 'overview' && (
        <>
          {/* Three-Pillar Side-by-Side Cards */}
          <div className="pillar-cards-container">
            {pillarData.map((pillar) => {
              // Calculate actual allocated hours based on date range
              const getDaysInRange = () => {
                const { start, end } = getDateRange();
                if (!start || !end) return 1;
                
                const startDate = new Date(start);
                const endDate = new Date(end);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
                return diffDays;
              };
              
              const daysInRange = getDaysInRange();
              const adjustedAllocatedHours = pillar.allocated_hours * daysInRange;
              
              const utilizationPercent = adjustedAllocatedHours > 0 
                ? (pillar.spent_hours / adjustedAllocatedHours) * 100 
                : 0;
              const status = utilizationPercent >= 80 ? 'excellent' 
                          : utilizationPercent >= 50 ? 'good' 
                          : 'needs-attention';
              
              return (
                <div key={pillar.pillar_id} className={`pillar-card pillar-card-${status}`}>
                  <div className="pillar-card-header">
                    <h3>{pillar.pillar_name}</h3>
                    <div className="pillar-icon" style={{ backgroundColor: pillar.color_code }}>
                      {pillar.pillar_name.charAt(0)}
                    </div>
                  </div>
                  
                  <div className="pillar-metrics">
                    <div className="metric-row">
                      <span className="metric-label">Allocated:</span>
                      <span className="metric-value">
                        {adjustedAllocatedHours}h
                        {daysInRange > 1 && (
                          <small style={{ color: '#718096', fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                            ({pillar.allocated_hours}h × {daysInRange} days)
                          </small>
                        )}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Spent:</span>
                      <span className="metric-value">{pillar.spent_hours}h</span>
                    </div>
                  </div>
                  
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${Math.min(utilizationPercent, 100)}%`,
                        backgroundColor: pillar.color_code 
                      }}
                    />
                  </div>
                  
                  <div className="pillar-status">
                    <span className={`status-badge status-${status}`}>
                      {utilizationPercent.toFixed(0)}%
                    </span>
                    <span className="status-text">
                      {status === 'excellent' ? '✨ On Track' 
                        : status === 'good' ? '👍 Good' 
                        : '⚠️ Behind'}
                    </span>
                  </div>
                  
                  {adjustedAllocatedHours - pillar.spent_hours > 0 && (
                    <div className="remaining-time">
                      <small>
                        {(adjustedAllocatedHours - pillar.spent_hours).toFixed(1)}h remaining
                        {dateRange === 'today' ? ' today' : ` in this ${dateRange === 'week' ? 'week' : dateRange === 'month' ? 'month' : 'period'}`}
                      </small>
                    </div>
                  )}
                  {pillar.spent_hours > adjustedAllocatedHours && (
                    <div className="remaining-time" style={{ color: '#48bb78' }}>
                      <small>
                        ✓ {(pillar.spent_hours - adjustedAllocatedHours).toFixed(1)}h over target!
                      </small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* COMPARATIVE PILLAR CHARTS: Today vs Week vs Month */}
          <div className="comparative-charts-section">
            <h2>📊 Pillar Time Comparison - Today vs Week vs Month</h2>
            <p className="chart-description">See how your time is distributed across pillars in different time periods</p>
            
            <div className="comparative-charts-grid">
              {/* Chart 1: Today's Pillar Distribution */}
              <div className="comparative-chart-card">
                <h3>📅 Today</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyPillarData} barSize={50}>
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="pillar_name" 
                      angle={-15}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar 
                      dataKey="spent_hours" 
                      name="Hours Spent"
                      radius={[8, 8, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, formatter: (value: number) => `${value.toFixed(1)}h` }}
                    >
                      {dailyPillarData.map((entry, index) => (
                        <Cell key={`daily-${index}`} fill={entry.color_code || '#805ad5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 2: This Week's Pillar Distribution */}
              <div className="comparative-chart-card">
                <h3>📆 This Week</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyPillarData} barSize={50}>
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="pillar_name" 
                      angle={-15}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar 
                      dataKey="spent_hours" 
                      name="Hours Spent"
                      radius={[8, 8, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, formatter: (value: number) => `${value.toFixed(1)}h` }}
                    >
                      {weeklyPillarData.map((entry, index) => (
                        <Cell key={`weekly-${index}`} fill={entry.color_code || '#805ad5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 3: This Month's Pillar Distribution */}
              <div className="comparative-chart-card">
                <h3>📊 This Month</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyPillarData} barSize={50}>
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="pillar_name" 
                      angle={-15}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar 
                      dataKey="spent_hours" 
                      name="Hours Spent"
                      radius={[8, 8, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, formatter: (value: number) => `${value.toFixed(1)}h` }}
                    >
                      {monthlyPillarData.map((entry, index) => (
                        <Cell key={`monthly-${index}`} fill={entry.color_code || '#805ad5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* CATEGORY TIME COMPARISON: Allocated vs Today vs Week/Month */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📂 Category Time Comparison</h2>
                <p className="chart-description">Daily allocated vs actual time spent (with weekly/monthly averages)</p>
              </div>
              <button 
                className={`toggle-month-btn ${showMonthColumn ? 'active' : ''}`}
                onClick={() => setShowMonthColumn(!showMonthColumn)}
              >
                {showMonthColumn ? '📊 Hide Month Average' : '📊 Show Month Average'}
              </button>
            </div>
            
            <div className="category-comparison-chart">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={(() => {
                    console.log('=== Category Chart Data Mapping ===');
                    console.log('allCategoriesData:', allCategoriesData);
                    console.log('todayCategoryData:', todayCategoryData);
                    console.log('weekCategoryData:', weekCategoryData);
                    console.log('monthCategoryData:', monthCategoryData);
                    
                    // Calculate days in week and month
                    const today = new Date();
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate(); // Current day of month
                    
                    console.log('Days in week so far:', daysInWeek);
                    console.log('Days in month so far:', daysInMonth);
                    
                    // Fixed category order
                    const categoryOrder = [
                      'Office-Tasks',
                      'Learning',
                      'Confidence',
                      'Sleep',
                      'Yoga',
                      'My Tasks',
                      'Home Tasks',
                      'Time Waste'
                    ];
                    
                    const mappedData = allCategoriesData
                      .map((category) => {
                        // Find matching today, week, and month data
                        const todayData = todayCategoryData.find(t => t.category_id === category.category_id);
                        const weekData = weekCategoryData.find(w => w.category_id === category.category_id);
                        const monthData = monthCategoryData.find(m => m.category_id === category.category_id);
                        
                        const result = {
                          category_name: category.category_name,
                          pillar_name: category.pillar_name,
                          allocated: category.allocated_hours / 7, // Convert weekly allocation to daily
                          today: todayData?.spent_hours || 0,
                          weekAvg: weekData ? (weekData.spent_hours / daysInWeek) : 0,
                          monthAvg: monthData ? (monthData.spent_hours / daysInMonth) : 0,
                          sortOrder: categoryOrder.indexOf(category.category_name)
                        };
                        
                        console.log(`Category: ${category.category_name} (ID: ${category.category_id})`, result);
                        return result;
                      })
                      .sort((a, b) => {
                        // Sort by fixed order, unknowns at end
                        const orderA = a.sortOrder >= 0 ? a.sortOrder : 999;
                        const orderB = b.sortOrder >= 0 ? b.sortOrder : 999;
                        return orderA - orderB;
                      });
                    
                    console.log('Final mapped data:', mappedData);
                    return mappedData;
                  })()}
                  barSize={25}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="category_name" 
                    angle={-20}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={12}
                  />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="allocated" 
                    name="Allocated (Daily)" 
                    fill="#cbd5e0" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#666', fontSize: 10, fontWeight: 500, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  <Bar 
                    dataKey="today" 
                    name="Today" 
                    fill="#4299e1" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  <Bar 
                    dataKey="weekAvg" 
                    name="Week Avg/Day" 
                    fill="#48bb78" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  {showMonthColumn && (
                    <Bar 
                      dataKey="monthAvg" 
                      name="Month Avg/Day" 
                      fill="#ed8936" 
                      radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Progress Chart - Only show for non-Today views */}
          {dateRange !== 'today' && (
            <div className="chart-section">
              <h2>Week-over-Week Progress</h2>
              <p className="chart-description">Time spent per week with trend line and average</p>
              
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hours" fill="#4299e1" name="Hours Spent" radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="hours" stroke="#f56565" strokeWidth={2} name="Trend" dot={false} />
                  <ReferenceLine 
                    y={averageHours} 
                    stroke="#48bb78" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{ value: `Avg: ${averageHours}h`, position: 'right' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* CATEGORIES MODE: 3-Column Comparison */}
      {viewMode === 'categories' && (
        <div className="categories-comparison-section">
          <h2>Category Performance Comparison</h2>
          <p className="chart-description">Allocated vs Today vs Monthly Average</p>
          
          <div className="categories-table">
            <div className="categories-table-header">
              <div className="col-category">Category</div>
              <div className="col-metric">Allocated</div>
              <div className="col-metric">Today</div>
              <div className="col-metric">Monthly Avg</div>
              <div className="col-gap">Gap</div>
            </div>
            
            {categoryData.map((category) => {
              const gap = category.spent_hours - category.allocated_hours;
              const gapStatus = gap >= 0 ? 'positive' : 'negative';
              
              return (
                <div key={category.category_id} className="categories-table-row">
                  <div className="col-category">
                    <strong>{category.category_name}</strong>
                    <small>{category.pillar_name}</small>
                  </div>
                  <div className="col-metric">
                    <div className="metric-bar" style={{ width: `${(category.allocated_hours / 8) * 100}%`, backgroundColor: '#cbd5e0' }}></div>
                    <span>{category.allocated_hours}h</span>
                  </div>
                  <div className="col-metric">
                    <div className="metric-bar" style={{ width: `${(category.spent_hours / 8) * 100}%`, backgroundColor: '#4299e1' }}></div>
                    <span>{category.spent_hours}h</span>
                  </div>
                  <div className="col-metric">
                    <div className="metric-bar" style={{ width: `${(category.spent_hours / 8) * 100}%`, backgroundColor: '#48bb78' }}></div>
                    <span>{category.spent_hours}h</span>
                  </div>
                  <div className={`col-gap gap-${gapStatus}`}>
                    {gap >= 0 ? '↗️' : '↘️'} {Math.abs(gap).toFixed(1)}h
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TASKS MODE: Timeline & Completion View */}
      {viewMode === 'tasks' && (
        <div className="tasks-view-section">
          <h2>📅 Time Spent by Pillar - Daily Breakdown</h2>
          <p className="chart-description">See how you spend time each day across your life pillars</p>
          
          <div className="timeline-chart">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="hours" 
                  fill="#4299e1" 
                  name="Total Hours"
                  radius={[8, 8, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#f56565" 
                  strokeWidth={2}
                  name="Trend"
                  dot={{ fill: '#f56565', r: 4 }}
                />
                <ReferenceLine 
                  y={averageHours} 
                  stroke="#48bb78" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: `Avg: ${averageHours}h`, position: 'right' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Daily Summary Cards */}
          <div className="daily-summary-section">
            <h3>Recent Activity</h3>
            <div className="daily-cards-grid">
              {weeklyTrend.slice(-7).reverse().map((day) => {
                const dayDate = new Date(day.date);
                const isToday = dayDate.toDateString() === new Date().toDateString();
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                
                return (
                  <div key={day.date} className={`daily-card ${isToday ? 'today' : ''}`}>
                    <div className="daily-card-header">
                      <span className="day-name">{dayName}</span>
                      <span className="day-date">{day.date}</span>
                    </div>
                    <div className="daily-card-hours">
                      <span className="hours-number">{day.hours}</span>
                      <span className="hours-label">hours</span>
                    </div>
                    <div className="daily-card-status">
                      {day.hours >= averageHours ? (
                        <span className="status-good">✓ Above average</span>
                      ) : day.hours > 0 ? (
                        <span className="status-ok">− Below average</span>
                      ) : (
                        <span className="status-poor">✗ No tracking</span>
                      )}
                    </div>
                    {isToday && <div className="today-badge">Today</div>}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="quick-stats-section">
            <h3>Quick Insights</h3>
            <div className="quick-stats-grid">
              <div className="quick-stat-card">
                <div className="stat-icon">�</div>
                <div className="stat-content">
                  <div className="stat-value">{weeklyTrend.length}</div>
                  <div className="stat-label">Days Tracked</div>
                </div>
              </div>
              <div className="quick-stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <div className="stat-value">{weeklyTrend.reduce((sum, d) => sum + d.hours, 0).toFixed(1)}h</div>
                  <div className="stat-label">Total Hours</div>
                </div>
              </div>
              <div className="quick-stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <div className="stat-value">{averageHours}h</div>
                  <div className="stat-label">Daily Average</div>
                </div>
              </div>
              <div className="quick-stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {weeklyTrend.filter(d => d.hours >= averageHours).length}
                  </div>
                  <div className="stat-label">Days Above Avg</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHEEL MODE: Wheel of Life Visualization */}
      {viewMode === 'wheel' && (
        <div className="wheel-view-section">
          <h2>⭕ Wheel of Life - Balance Visualization</h2>
          <p className="chart-description">See how balanced your time allocation is across life pillars</p>
          
          <div className="wheel-container">
            {/* Pillar Balance Wheel */}
            <div className="wheel-chart-container">
              <h3>Pillar Balance</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={pillarData.map(p => ({
                  pillar: p.pillar_name,
                  allocated: p.allocated_hours,
                  spent: p.spent_hours,
                  utilization: p.utilization_percentage
                }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="pillar" />
                  <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
                  <Radar 
                    name="Allocated Hours" 
                    dataKey="allocated" 
                    stroke="#cbd5e0" 
                    fill="#cbd5e0" 
                    fillOpacity={0.3} 
                  />
                  <Radar 
                    name="Spent Hours" 
                    dataKey="spent" 
                    stroke="#4299e1" 
                    fill="#4299e1" 
                    fillOpacity={0.6} 
                  />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
              
              {/* Balance Score */}
              <div className="balance-score-card">
                <h4>Balance Score</h4>
                <div className="balance-score">
                  {(() => {
                    const utilizationValues = pillarData.map(p => p.utilization_percentage);
                    const avgUtilization = utilizationValues.length > 0
                      ? utilizationValues.reduce((a, b) => a + b) / utilizationValues.length
                      : 0;
                    const variance = utilizationValues.length > 0
                      ? Math.sqrt(utilizationValues.reduce((sum, val) => 
                          sum + Math.pow(val - avgUtilization, 2), 0) / utilizationValues.length)
                      : 100;
                    const balanceScore = Math.max(0, 100 - variance);
                    
                    return (
                      <>
                        <div className="score-circle" style={{
                          background: `conic-gradient(
                            ${balanceScore >= 80 ? '#48bb78' : balanceScore >= 50 ? '#ecc94b' : '#f56565'} 0% ${balanceScore}%, 
                            #e2e8f0 ${balanceScore}% 100%
                          )`
                        }}>
                          <div className="score-inner">
                            <span className="score-number">{balanceScore.toFixed(0)}</span>
                            <span className="score-label">/100</span>
                          </div>
                        </div>
                        <p className="score-description">
                          {balanceScore >= 80 && '✨ Excellent balance across pillars!'}
                          {balanceScore >= 50 && balanceScore < 80 && '👍 Good balance, room for improvement'}
                          {balanceScore < 50 && '⚠️ Uneven distribution - focus on neglected areas'}
                        </p>
                        <div className="balance-insight">
                          {(() => {
                            const sorted = [...pillarData].sort((a, b) => 
                              a.utilization_percentage - b.utilization_percentage
                            );
                            if (sorted.length >= 2) {
                              const weakest = sorted[0];
                              const strongest = sorted[sorted.length - 1];
                              return (
                                <small>
                                  💡 Most neglected: <strong>{weakest.pillar_name}</strong> ({weakest.utilization_percentage.toFixed(0)}%)
                                  <br />
                                  🏆 Strongest: <strong>{strongest.pillar_name}</strong> ({strongest.utilization_percentage.toFixed(0)}%)
                                </small>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            {/* Category Distribution Wheel */}
            <div className="wheel-chart-container">
              <h3>Category Distribution</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={categoryData.slice(0, 8).map(c => ({
                  category: c.category_name.length > 15 
                    ? c.category_name.substring(0, 12) + '...' 
                    : c.category_name,
                  hours: c.spent_hours,
                  utilization: c.utilization_percentage
                }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
                  <Radar 
                    name="Hours Spent" 
                    dataKey="hours" 
                    stroke="#ed8936" 
                    fill="#ed8936" 
                    fillOpacity={0.6} 
                  />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
              
              {/* Top Categories List */}
              <div className="top-categories-list">
                <h4>Top 5 Categories</h4>
                {categoryData.slice(0, 5).map((category, index) => (
                  <div key={category.category_id} className="category-item">
                    <span className="category-rank">#{index + 1}</span>
                    <span className="category-name">{category.category_name}</span>
                    <span className="category-hours">{category.spent_hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats - Show on all views */}
      <div className="analytics-summary">
        <div className="summary-card">
          <h3>Total Pillars</h3>
          <p className="summary-value">{pillarData.length}</p>
        </div>
        <div className="summary-card">
          <h3>Total Categories</h3>
          <p className="summary-value">{categoryData.length}</p>
        </div>
        <div className="summary-card">
          <h3>Total Hours ({dateRange})</h3>
          <p className="summary-value">
            {pillarData.reduce((sum, p) => sum + p.spent_hours, 0).toFixed(1)}h
          </p>
        </div>
        <div className="summary-card">
          <h3>Overall Progress</h3>
          <p className="summary-value">
            {pillarData.length > 0 
              ? ((pillarData.reduce((sum, p) => sum + p.utilization_percentage, 0) / pillarData.length).toFixed(0)) 
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
