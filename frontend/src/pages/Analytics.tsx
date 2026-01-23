import { useState, useEffect } from 'react';
import { getWeekStart, formatDateForInput } from '../utils/dateHelpers';
import WheelsOfLife from '../components/WheelsOfLife';
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import apiClient from '../services/api';
import './Analytics.css';

// Shared ordering configuration (matches Daily tab hierarchy)
const PILLAR_ORDER = ['Hard Work', 'Calmness', 'Family'];

const CATEGORY_ORDER = [
  'Office-Tasks',  // Hard Work
  'Learning',      // Hard Work
  'Confidence',    // Hard Work
  'Yoga',          // Calmness
  'Sleep',         // Calmness
  'My Tasks',      // Family
  'Home Tasks',    // Family
  'Time Waste'     // Family
];

const TASK_NAME_ORDER: { [key: string]: number } = {
  'cd-Mails-Tickets': 1,
  'Code Coverage': 2,
  'Code - Scripts': 3,
  'Cloud': 4,
  'LLM GenAI': 5,
  'Git Jenkin Tools': 6,
  'Interview Q/A': 7,
  'Interview Talk': 8,
  'Life Coach & NLP': 9,
  'Toastmaster Task': 10,
  'Yoga - Dhyan': 11,
  'Sleep': 12,
  'Planning': 13,
  'Stocks': 14,
  'Task (Bank/ mail)': 15,
  'Commute': 16,
  'Nature Needs': 17,
  'Eating': 18,
  'My Games': 19,
  'Parent Talk': 20,
  'Home Task': 21,
  'Task Trishna': 22,
  'Task Divyanshi': 23,
  'Daughter Sports': 24,
  'Shopping': 25,
  'Family Friends': 26,
  'Youtube': 27,
  'TV': 28,
  'Facebook': 29,
  'Nextdoor': 30,
  'News': 31,
  'Dark Future': 32,
};

// Custom multi-line label component for long task names
const CustomMultilineLabel = ({ x, y, payload, index }: any) => {
  const text = payload.value || '';
  const maxCharsPerLine = 20;
  const lines: string[] = [];
  
  // Split text into multiple lines
  if (text.length <= maxCharsPerLine) {
    lines.push(text);
  } else {
    const words = text.split(' ');
    let currentLine = '';
    
    words.forEach((word) => {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
  }
  
  // Alternate colors for visual distinction
  const colors = ['#e6f2ff', '#fff0e6', '#e6ffe6', '#ffe6f0', '#f0e6ff', '#fffae6'];
  const bgColor = colors[index % colors.length];
  const borderColor = colors[index % colors.length].replace(/f/g, 'c'); // Slightly darker border
  
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <g key={i}>
          <rect
            x={-maxCharsPerLine * 3.2}
            y={i * 16 + 5}
            width={maxCharsPerLine * 6.4}
            height={14}
            fill={bgColor}
            stroke={borderColor}
            strokeWidth={0.5}
            rx={3}
          />
          <text
            x={0}
            y={i * 16 + 16}
            textAnchor="middle"
            fill="#333"
            fontSize={11}
            fontWeight={500}
          >
            {line}
          </text>
        </g>
      ))}
    </g>
  );
};

interface PillarData {
  pillar_id: number;
  pillar_name: string;
  icon?: string;
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

interface TaskData {
  task_id: number;
  task_name: string;
  pillar_name: string;
  category_name: string;
  allocated_minutes: number;
  spent_minutes: number;
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
  const [selectedPillar] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Get initial viewMode from URL params or default to 'overview'
  const getInitialViewMode = (): 'overview' | 'categories' | 'tasks' | 'wheel' | 'detailed' => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'wheel' || view === 'categories' || view === 'tasks' || view === 'detailed') {
      return view;
    }
    return 'overview';
  };
  
  const [viewMode, setViewMode] = useState<'overview' | 'categories' | 'tasks' | 'wheel' | 'detailed'>(getInitialViewMode());
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  
  // Detailed view state
  const [detailedPeriodType, setDetailedPeriodType] = useState<'day' | 'week' | 'month'>('week');
  const [detailedDate, setDetailedDate] = useState<string>(formatDateForInput(new Date()));
  
  // Comparative pillar data for Today/Week/Month
  const [dailyPillarData, setDailyPillarData] = useState<PillarData[]>([]);
  const [weeklyPillarData, setWeeklyPillarData] = useState<PillarData[]>([]);
  const [monthlyPillarData, setMonthlyPillarData] = useState<PillarData[]>([]);
  
  // Comparative category data for Allocated/Today/Week/Month
  const [todayCategoryData, setTodayCategoryData] = useState<CategoryData[]>([]);
  const [weekCategoryData, setWeekCategoryData] = useState<CategoryData[]>([]);
  const [monthCategoryData, setMonthCategoryData] = useState<CategoryData[]>([]);
  const [allCategoriesData, setAllCategoriesData] = useState<CategoryData[]>([]); // Base categories with allocations
  
  // Comparative task data for Allocated/Today/Week/Month
  const [todayTaskData, setTodayTaskData] = useState<TaskData[]>([]);
  const [weekTaskData, setWeekTaskData] = useState<TaskData[]>([]);
  const [monthTaskData, setMonthTaskData] = useState<TaskData[]>([]);
  const [allTasksData, setAllTasksData] = useState<TaskData[]>([]); // Base tasks with allocations - TIME-BASED only
  
  // One-time tasks data
  const [todayOneTimeTaskData, setTodayOneTimeTaskData] = useState<TaskData[]>([]);
  const [weekOneTimeTaskData, setWeekOneTimeTaskData] = useState<TaskData[]>([]);
  const [monthOneTimeTaskData, setMonthOneTimeTaskData] = useState<TaskData[]>([]);
  const [allOneTimeTasksData, setAllOneTimeTasksData] = useState<TaskData[]>([]); // Base one-time tasks
  
  const [showMonthColumn, setShowMonthColumn] = useState(false); // Toggle for month average column (Pillars)
  const [showWeekColumn, setShowWeekColumn] = useState(false); // Toggle for week average column (Pillars)
  const [showCategoryMonth, setShowCategoryMonth] = useState(false); // Toggle for Categories
  const [showCategoryWeek, setShowCategoryWeek] = useState(false); // Toggle for Categories weekly
  const [showTaskMonth, setShowTaskMonth] = useState(false); // Toggle for Tasks
  const [showTaskWeek, setShowTaskWeek] = useState(false); // Toggle for Tasks weekly
  const [showOneTimeTaskMonth, setShowOneTimeTaskMonth] = useState(false); // Toggle for One-Time Tasks
  const [showOneTimeTaskWeek, setShowOneTimeTaskWeek] = useState(false); // Toggle for One-Time Tasks weekly
  const [showPillarWeek, setShowPillarWeek] = useState(false); // Toggle for Pillar weekly data
  const [showCategoryBreakdownWeek, setShowCategoryBreakdownWeek] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showCategoryBreakdownMonth, setShowCategoryBreakdownMonth] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showTaskBreakdownWeek, setShowTaskBreakdownWeek] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showTaskBreakdownMonth, setShowTaskBreakdownMonth] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showUtilizationTaskWeek, setShowUtilizationTaskWeek] = useState(false); // Toggle for Task Utilization weekly
  const [showUtilizationTaskMonth, setShowUtilizationTaskMonth] = useState(false); // Toggle for Task Utilization monthly
  const [showUtilizationCategoryWeek, setShowUtilizationCategoryWeek] = useState(false); // Toggle for Category Utilization weekly
  const [showUtilizationCategoryMonth, setShowUtilizationCategoryMonth] = useState(false); // Toggle for Category Utilization monthly
  const [showUtilizationOneTimeWeek, setShowUtilizationOneTimeWeek] = useState(false); // Toggle for One-Time Task Utilization weekly
  const [showUtilizationOneTimeMonth, setShowUtilizationOneTimeMonth] = useState(false); // Toggle for One-Time Task Utilization monthly
  
  // Modal state for detail view
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalChartType, setModalChartType] = useState<'pillar' | 'category' | 'task' | 'utilization' | string>('pillar');
  
  // Modal date filtering state
  const [modalViewType, setModalViewType] = useState<'date' | 'week' | 'month'>('date');
  const [modalStartDate, setModalStartDate] = useState(formatDateForInput(new Date()));
  const [modalEndDate, setModalEndDate] = useState(formatDateForInput(new Date()));
  const [modalWeekDate, setModalWeekDate] = useState(formatDateForInput(new Date()));
  const [modalMonth, setModalMonth] = useState(formatDateForInput(new Date()).substring(0, 7)); // YYYY-MM format

  useEffect(() => {
    loadAnalyticsData();
    loadStreakData();
    loadComparativePillarData();
    loadComparativeCategoryData();
    loadComparativeTaskData();
  }, [dateRange, selectedPillar, customStartDate, customEndDate]);

  // Update customStartDate and customEndDate when detailed view date changes
  useEffect(() => {
    if (viewMode === 'detailed' && detailedDate) {
      const selectedDate = new Date(detailedDate);
      
      if (detailedPeriodType === 'day') {
        // Single day
        setCustomStartDate(detailedDate);
        setCustomEndDate(detailedDate);
      } else if (detailedPeriodType === 'week') {
        // Week starting Monday
        const weekStart = getWeekStart(selectedDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Sunday
        setCustomStartDate(formatDateForInput(weekStart));
        setCustomEndDate(formatDateForInput(weekEnd));
      } else if (detailedPeriodType === 'month') {
        // Entire month
        const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        setCustomStartDate(formatDateForInput(monthStart));
        setCustomEndDate(formatDateForInput(monthEnd));
      }
      
      // Ensure we're using custom range
      setDateRange('custom');
    }
  }, [viewMode, detailedDate, detailedPeriodType]);

  const loadComparativePillarData = async () => {
    try {
      // Load Today's data
      const today = new Date();
      const todayStr = formatDateForInput(today);
      const dailyResponse = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${todayStr}&end_date=${todayStr}`);
      setDailyPillarData(dailyResponse.data.pillars || []);
      
      // Load This Week's data (Monday to today)
      const weekStart = getWeekStart(today);
      const weekStartStr = formatDateForInput(weekStart);
      const todayEndStr = formatDateForInput(today); // Week data up to today, not full week
      const weeklyResponse = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${weekStartStr}&end_date=${todayEndStr}`);
      setWeeklyPillarData(weeklyResponse.data.pillars || []);
      
      // Load This Month's data (1st to today, not full month)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyResponse = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${formatDateForInput(monthStart)}&end_date=${formatDateForInput(today)}`);
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
      const todayStr = formatDateForInput(today);
      
      // Load ALL categories with allocated hours (no date filter)
      const allCategoriesResponse = await apiClient.get('/api/analytics/category-breakdown');
      setAllCategoriesData(allCategoriesResponse.data.categories || []);
      console.log('All categories (base):', allCategoriesResponse.data.categories);
      
      // Load Today's category data
      console.log('Loading today category data for:', todayStr);
      const todayResponse = await apiClient.get(`/api/analytics/category-breakdown?start_date=${todayStr}&end_date=${todayStr}`);
      console.log('Today category response:', todayResponse.data);
      setTodayCategoryData(todayResponse.data.categories || []);
      
      // Load This Week's category data (Monday to today)
      const weekStart = getWeekStart(today);
      const weekStartStr = formatDateForInput(weekStart);
      const todayEndStr = formatDateForInput(today);
      console.log('Loading week category data from:', weekStartStr, 'to', todayEndStr);
      const weekResponse = await apiClient.get(`/api/analytics/category-breakdown?start_date=${weekStartStr}&end_date=${todayEndStr}`);
      console.log('Week category response:', weekResponse.data);
      setWeekCategoryData(weekResponse.data.categories || []);
      
      // Load This Month's category data
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      console.log('Loading month category data from:', formatDateForInput(monthStart), 'to', formatDateForInput(monthEnd));
      const monthResponse = await apiClient.get(`/api/analytics/category-breakdown?start_date=${formatDateForInput(monthStart)}&end_date=${formatDateForInput(monthEnd)}`);
      console.log('Month category response:', monthResponse.data);
      setMonthCategoryData(monthResponse.data.categories || []);
    } catch (error) {
      console.error('Error loading comparative category data:', error);
    }
  };

  const loadComparativeTaskData = async () => {
    console.log('🔵 loadComparativeTaskData() CALLED');
    try {
      const today = new Date();
      const todayStr = formatDateForInput(today);
      console.log('📅 Today date:', todayStr);
      
      // Load daily task completion dates to exclude previously completed tasks
      let dailyTaskCompletionDates = new Map<number, string>();
      try {
        const completionResponse = await apiClient.get('/api/daily-tasks-history/completion-dates');
        const completionData = completionResponse.data || {};
        dailyTaskCompletionDates = new Map(
          Object.entries(completionData).map(([id, date]) => [parseInt(id), date as string])
        );
        console.log('📋 Daily task completion dates loaded:', dailyTaskCompletionDates.size);
      } catch (error) {
        console.warn('Could not load daily task completion dates:', error);
      }
      
      // Load ALL tasks with allocated time
      const allTasksResponse = await apiClient.get('/api/tasks?limit=1000');
      console.log('📥 Tasks API response:', allTasksResponse.data?.length, 'tasks received');
      const tasks = allTasksResponse.data || [];
      
      // Create base tasks array - FILTER TO MATCH DAILY TAB EXACTLY
      // Time-Based Tasks: daily frequency + task_type=TIME + NOT is_daily_one_time + is_active
      // Include tasks that are:
      // 1. Not completed/NA (currently active)
      // 2. Completed today (still visible with green background)
      // 3. NA marked today (still visible with gray background)
      const baseTasks: TaskData[] = tasks
        .filter((task: any) => {
          if (task.follow_up_frequency !== 'daily') return false;
          if (task.task_type?.toUpperCase() !== 'TIME') return false;
          if (task.is_daily_one_time) return false;
          if (!task.is_active) return false;
          
          // Only include tasks that are NOT completed and NOT marked as NA
          if (task.is_completed) return false;
          if (task.na_marked_at) return false;
          
          return true;
        })
        .map((task: any) => ({
          task_id: task.id,
          task_name: task.name,
          pillar_name: task.pillar_name || 'Unknown',
          category_name: task.category_name || 'Uncategorized',
          allocated_minutes: task.allocated_minutes || 0,
          spent_minutes: 0
        }));
      setAllTasksData(baseTasks);
      console.log('✅ Base time-based tasks (active only):', baseTasks.length, 'tasks');
      
      // One-Time Tasks: daily frequency + task_type=TIME + is_daily_one_time + is_active
      // For analytics chart: only show active tasks (not completed, not NA)
      // Check daily_task_status table for completion (same as Daily tab does)
      
      const baseOneTimeTasks: TaskData[] = tasks
        .filter((task: any) => {
          if (task.follow_up_frequency !== 'daily') return false;
          if (task.task_type?.toUpperCase() !== 'TIME') return false;
          if (task.is_daily_one_time !== true) return false;
          if (!task.is_active) return false;
          
          // Exclude tasks that were completed on previous days (same logic as Daily tab)
          const completionDateStr = dailyTaskCompletionDates.get(task.id);
          if (completionDateStr) {
            const [year, month, day] = completionDateStr.split('-').map(Number);
            const completionDate = new Date(year, month - 1, day);
            completionDate.setHours(0, 0, 0, 0);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // If task was completed BEFORE today, exclude it
            if (completionDate < today) {
              return false;
            }
          }
          
          // Only exclude tasks with na_marked_at
          if (task.na_marked_at) return false;
          
          return true;
        })
        .map((task: any) => ({
          task_id: task.id,
          task_name: task.name,
          category_name: task.category_name || 'Uncategorized',
          allocated_minutes: task.allocated_minutes || 0,
          spent_minutes: 0
        }));
      setAllOneTimeTasksData(baseOneTimeTasks);
      console.log('✅ Base one-time tasks (active only):', baseOneTimeTasks.length, 'tasks');
      console.log('Task names:', baseOneTimeTasks.map(t => t.task_name));
      
      // Load Today's task time entries - Use the entries endpoint which has hourly breakdown
      const todayEntriesResponse = await apiClient.get(`/api/daily-time/entries/${todayStr}`);
      console.log('Today entries API response:', todayEntriesResponse.data);
      
      // Aggregate time spent per task from hourly entries
      const todaySpentMap = new Map<number, number>();
      (todayEntriesResponse.data || []).forEach((entry: any) => {
        const currentSpent = todaySpentMap.get(entry.task_id) || 0;
        todaySpentMap.set(entry.task_id, currentSpent + (entry.minutes || 0));
      });
      console.log('Today spent time aggregated:', Array.from(todaySpentMap.entries()).slice(0, 5));
      
      const todayTasks = baseTasks.map(task => {
        const spent = todaySpentMap.get(task.task_id) || 0;
        return {
          ...task,
          spent_minutes: spent
        };
      });
      setTodayTaskData(todayTasks);
      
      // Load Today's one-time task entries
      const todayOneTimeTasks = baseOneTimeTasks.map(task => {
        const spent = todaySpentMap.get(task.task_id) || 0;
        return {
          ...task,
          spent_minutes: spent
        };
      });
      setTodayOneTimeTaskData(todayOneTimeTasks);
      console.log('Today tasks with spent time:', todayTasks.filter(t => t.spent_minutes > 0).slice(0, 3));
      
      // Load This Week's task time entries (Monday to today)
      const weekStart = getWeekStart(today);
      const weekStartStr = formatDateForInput(weekStart);
      const weekEntries = await apiClient.get(`/api/daily-time?start_date=${weekStartStr}&end_date=${todayStr}`);
      console.log('Week entries API response (first 5):', (weekEntries.data || []).slice(0, 5));
      const weekTaskMap = new Map<number, number>();
      (weekEntries.data || []).forEach((entry: any) => {
        weekTaskMap.set(entry.task_id, (weekTaskMap.get(entry.task_id) || 0) + entry.minutes);
      });
      console.log('Week task map size:', weekTaskMap.size, 'entries');
      const weekTasks = baseTasks.map(task => ({
        ...task,
        spent_minutes: weekTaskMap.get(task.task_id) || 0
      }));
      setWeekTaskData(weekTasks);
      
      // Week one-time tasks
      const weekOneTimeTasks = baseOneTimeTasks.map(task => ({
        ...task,
        spent_minutes: weekTaskMap.get(task.task_id) || 0
      }));
      setWeekOneTimeTaskData(weekOneTimeTasks);
      console.log('Week tasks with spent time:', weekTasks.filter(t => t.spent_minutes > 0).slice(0, 3));
      
      // Load This Month's task time entries
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = formatDateForInput(monthStart);
      const monthEndStr = formatDateForInput(today);
      const monthEntries = await apiClient.get(`/api/daily-time?start_date=${monthStartStr}&end_date=${monthEndStr}`);
      console.log('Month entries API response (first 5):', (monthEntries.data || []).slice(0, 5));
      const monthTaskMap = new Map<number, number>();
      (monthEntries.data || []).forEach((entry: any) => {
        monthTaskMap.set(entry.task_id, (monthTaskMap.get(entry.task_id) || 0) + entry.minutes);
      });
      console.log('Month task map size:', monthTaskMap.size, 'entries');
      const monthTasks = baseTasks.map(task => ({
        ...task,
        spent_minutes: monthTaskMap.get(task.task_id) || 0
      }));
      setMonthTaskData(monthTasks);
      
      // Month one-time tasks
      const monthOneTimeTasks = baseOneTimeTasks.map(task => ({
        ...task,
        spent_minutes: monthTaskMap.get(task.task_id) || 0
      }));
      setMonthOneTimeTaskData(monthOneTimeTasks);
      console.log('Month tasks with spent time:', monthTasks.filter(t => t.spent_minutes > 0).slice(0, 3));
      
      console.log('Tasks data loaded:', { today: todayTasks.length, week: weekTasks.length, month: monthTasks.length });
    } catch (error) {
      console.error('❌❌❌ Error loading comparative task data:', error);
      console.error('Error details:', error);
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
        
        {/* Combined Streak & Achievements Panel */}
        {(streakData || (badgeData && badgeData.badges.length > 0)) && (
          <div style={{ 
            padding: '12px 20px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white',
            borderRadius: '12px', 
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              {/* Streak Section */}
              {streakData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '28px' }}>
                    {streakData.streak_status === 'active' ? '🔥' : 
                     streakData.streak_status === 'at_risk' ? '⚡' : '💤'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{streakData.current_streak}</span>
                    <span style={{ fontSize: '14px', opacity: 0.9 }}>day streak</span>
                    <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.8 }}>
                      {streakData.streak_status === 'active' && '🎉 Keep going!'}
                      {streakData.streak_status === 'at_risk' && '⚠️ Track today!'}
                      {streakData.streak_status === 'broken' && '💪 Restart!'}
                      {streakData.streak_status === 'inactive' && '🚀 Start!'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', marginLeft: '16px', opacity: 0.85 }}>
                    <span>Longest: {streakData.longest_streak}</span>
                    <span>Total: {streakData.total_tracked_days}</span>
                  </div>
                </div>
              )}
              
              {/* Achievements Section */}
              {badgeData && badgeData.badges.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.95 }}>🏆 Achievements ({badgeData.total_earned})</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {badgeData.badges.slice(0, 5).map((badge) => (
                      <span 
                        key={badge.id} 
                        style={{ 
                          fontSize: '11px', 
                          padding: '4px 10px', 
                          background: 'rgba(255,255,255,0.2)', 
                          borderRadius: '14px',
                          border: '1px solid rgba(255,255,255,0.3)',
                          backdropFilter: 'blur(10px)'
                        }}
                        title={badge.description}
                      >
                        {badge.name.split(' ')[0]} {badge.name.replace(badge.name.split(' ')[0], '').trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
            className={`tab-button ${viewMode === 'wheel' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('wheel');
              const params = new URLSearchParams(window.location.search);
              params.set('view', 'wheel');
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }}
          >
            ⭕ Wheel of Life
          </button>
          <button 
            className={`tab-button ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setViewMode('detailed')}
          >
            📅 Detailed View
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
        </div>
        
        {/* Date Range Selector - Only show for Categories/Tasks modes (NOT Wheel) */}
        {viewMode !== 'overview' && viewMode !== 'detailed' && viewMode !== 'wheel' && (
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
        )}
      </div>

      {/* OVERVIEW MODE: Unified Comparison Charts */}
      {viewMode === 'overview' && (
        <>
          {/* UNIFIED PILLAR COMPARISON CHART */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>🎯 Pillar Time Comparison</h2>
                <p className="chart-description">Ideal allocation vs actual time spent across your life pillars</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showPillarWeek ? 'active' : ''}`}
                  onClick={() => setShowPillarWeek(!showPillarWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showPillarWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showMonthColumn ? 'active' : ''}`}
                  onClick={() => setShowMonthColumn(!showMonthColumn)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showMonthColumn ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
              </div>
            </div>
            
            <div 
              className="unified-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('pillar');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={(() => {
                    // Map all pillars with data
                    const pillarDataWithValues = dailyPillarData.map((pillar) => {
                      const weekData = weeklyPillarData.find(w => w.pillar_id === pillar.pillar_id);
                      const monthData = monthlyPillarData.find(m => m.pillar_id === pillar.pillar_id);
                      
                      // Calculate days for proper averaging
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Normalize to midnight
                      const weekStart = getWeekStart(today);
                      const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const daysInMonth = today.getDate();
                      
                      return {
                        name: pillar.pillar_name,
                        allocated: pillar.allocated_hours, // Daily allocation
                        today: pillar.spent_hours,
                        weekly: weekData ? Math.round((weekData.spent_hours / daysInWeek) * 10) / 10 : 0,
                        monthly: monthData ? Math.round((monthData.spent_hours / daysInMonth) * 10) / 10 : 0,
                        color: pillar.color_code
                      };
                    });
                    
                    // Sort by Daily tab order
                    return pillarDataWithValues.sort((a, b) => {
                      const orderA = PILLAR_ORDER.indexOf(a.name);
                      const orderB = PILLAR_ORDER.indexOf(b.name);
                      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
                    });
                  })()}
                  barSize={35}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    interval={0}
                    style={{ fontSize: '14px', fontWeight: 600 }}
                  />
                  <YAxis 
                    label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="rect"
                  />
                  <Bar 
                    dataKey="allocated" 
                    name="Ideal (Allocated)" 
                    fill="#cbd5e0" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#666', fontSize: 11, fontWeight: 500, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  <Bar 
                    dataKey="today" 
                    name="Today (Actual)" 
                    fill="#4299e1" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  {showPillarWeek && (
                    <Bar 
                      dataKey="weekly" 
                      name="Weekly Avg (Actual)" 
                      fill="#48bb78" 
                      radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                  {showMonthColumn && (
                    <Bar 
                      dataKey="monthly" 
                      name="Monthly Avg (Actual)" 
                      fill="#ed8936" 
                      radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* UTILIZATION PERCENTAGE CHART - TASKS */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📊 Time Utilization Percentage: Daily Tasks</h2>
                <p className="chart-description">Percentage of allocated time actually used (100% = perfect match, &gt;100% = overtime)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showUtilizationTaskWeek ? 'active' : ''}`}
                  onClick={() => setShowUtilizationTaskWeek(!showUtilizationTaskWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showUtilizationTaskWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationTaskMonth ? 'active' : ''}`}
                  onClick={() => setShowUtilizationTaskMonth(!showUtilizationTaskMonth)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showUtilizationTaskMonth ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
                <button 
                  onClick={() => {
                    setModalChartType('utilization' as any);
                    setShowDetailModal(true);
                  }}
                  className="expand-button"
                >
                  🔍 View All
                </button>
              </div>
            </div>
            
            <div className="unified-comparison-chart">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    return allTasksData
                      .map((task) => {
                        const todayTask = todayTaskData.find(t => t.task_id === task.task_id);
                        const weekTask = weekTaskData.find(t => t.task_id === task.task_id);
                        const monthTask = monthTaskData.find(t => t.task_id === task.task_id);
                        
                        const allocated = task.allocated_minutes / 60;
                        const todaySpent = (todayTask?.spent_minutes || 0) / 60;
                        const weeklyAvg = (weekTask?.spent_minutes || 0) / 60 / daysInWeek;
                        const monthlyAvg = (monthTask?.spent_minutes || 0) / 60 / daysInMonth;
                        
                        // Calculate utilization percentages
                        const todayUtil = allocated > 0 ? (todaySpent / allocated) * 100 : 0;
                        const weekUtil = allocated > 0 ? (weeklyAvg / allocated) * 100 : 0;
                        const monthUtil = allocated > 0 ? (monthlyAvg / allocated) * 100 : 0;
                        
                        return {
                          name: task.task_name,
                          category: task.category_name,
                          today: Math.min(todayUtil, 100),
                          todayOvertime: Math.max(todayUtil - 100, 0),
                          weekly: Math.min(weekUtil, 100),
                          weeklyOvertime: Math.max(weekUtil - 100, 0),
                          monthly: Math.min(monthUtil, 100),
                          monthlyOvertime: Math.max(monthUtil - 100, 0),
                          hasData: allocated > 0 || todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                        };
                      })
                      .filter(task => task.hasData)
                      .sort((a, b) => {
                        // Sort by Daily tab order: category first
                        const categoryOrderA = CATEGORY_ORDER.indexOf(a.category);
                        const categoryOrderB = CATEGORY_ORDER.indexOf(b.category);
                        
                        if (categoryOrderA !== categoryOrderB) {
                          return (categoryOrderA === -1 ? 999 : categoryOrderA) - (categoryOrderB === -1 ? 999 : categoryOrderB);
                        }
                        
                        // Within same category, sort by task name order
                        const taskOrderA = TASK_NAME_ORDER[a.name] || 999;
                        const taskOrderB = TASK_NAME_ORDER[b.name] || 999;
                        
                        if (taskOrderA !== taskOrderB) {
                          return taskOrderA - taskOrderB;
                        }
                        
                        return a.name.localeCompare(b.name);
                      })
                      .slice(0, 20); // Show top 20 tasks
                  })()}
                  barSize={15}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    height={60}
                    interval={0}
                    tick={<CustomMultilineLabel />}
                  />
                  <YAxis 
                    label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  {/* Reference line at 100% - Target utilization */}
                  <ReferenceLine y={100} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" label={{ value: '100%', position: 'right', fill: '#10b981', fontSize: 12, fontWeight: 600 }} />
                  <Bar 
                    dataKey="today" 
                    name="Today %" 
                    stackId="today"
                    fill="#4299e1" 
                    radius={[0, 0, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                      if (!props || !props.payload) return '';
                      const payload = props.payload;
                      // Only show label if there's no overtime (red bar will handle it otherwise)
                      if (payload.todayOvertime > 0) return '';
                      const total = payload.today || 0;
                      return total > 0 ? `${total.toFixed(0)}%` : '';
                    }}}
                  />
                  <Bar 
                    dataKey="todayOvertime" 
                    name="Overtime" 
                    stackId="today"
                    fill="#dc2626" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                      if (!props || !props.payload) return '';
                      const payload = props.payload;
                      const total = (payload.today || 0) + (payload.todayOvertime || 0);
                      return total > 0 ? `${total.toFixed(0)}%` : '';
                    }}}
                  />
                  {showUtilizationTaskWeek && (
                    <>
                      <Bar 
                        dataKey="weekly" 
                        name="Weekly Avg %" 
                        stackId="weekly"
                        fill="#48bb78" 
                        radius={[0, 0, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          // Only show label if there's no overtime
                          if (payload.weeklyOvertime > 0) return '';
                          const total = payload.weekly || 0;
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                      <Bar 
                        dataKey="weeklyOvertime" 
                        name="Weekly Overtime" 
                        stackId="weekly"
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          const total = (payload.weekly || 0) + (payload.weeklyOvertime || 0);
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                    </>
                  )}
                  {showUtilizationTaskMonth && (
                    <>
                      <Bar 
                        dataKey="monthly" 
                        name="Monthly Avg %" 
                        stackId="monthly"
                        fill="#ed8936" 
                        radius={[0, 0, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          // Only show label if there's no overtime
                          if (payload.monthlyOvertime > 0) return '';
                          const total = payload.monthly || 0;
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                      <Bar 
                        dataKey="monthlyOvertime" 
                        name="Monthly Overtime" 
                        stackId="monthly"
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          const total = (payload.monthly || 0) + (payload.monthlyOvertime || 0);
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* UTILIZATION PERCENTAGE CHART - CATEGORIES */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📊 Time Utilization Percentage: Daily Categories</h2>
                <p className="chart-description">Percentage of allocated time actually used by category (100% = perfect match, &gt;100% = overtime)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showUtilizationCategoryWeek ? 'active' : ''}`}
                  onClick={() => setShowUtilizationCategoryWeek(!showUtilizationCategoryWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showUtilizationCategoryWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationCategoryMonth ? 'active' : ''}`}
                  onClick={() => setShowUtilizationCategoryMonth(!showUtilizationCategoryMonth)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showUtilizationCategoryMonth ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
                <button 
                  onClick={() => {
                    setModalChartType('utilization-category' as any);
                    setShowDetailModal(true);
                  }}
                  className="expand-button"
                >
                  🔍 View All
                </button>
              </div>
            </div>
            
            <div className="unified-comparison-chart">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    // Aggregate task data by category
                    const categoryMap = new Map<string, {
                      category_name: string;
                      allocated: number;
                      todaySpent: number;
                      weekSpent: number;
                      monthSpent: number;
                    }>();
                    
                    allTasksData.forEach((task) => {
                      const todayTask = todayTaskData.find(t => t.task_id === task.task_id);
                      const weekTask = weekTaskData.find(t => t.task_id === task.task_id);
                      const monthTask = monthTaskData.find(t => t.task_id === task.task_id);
                      
                      const allocated = task.allocated_minutes / 60;
                      const todaySpent = (todayTask?.spent_minutes || 0) / 60;
                      const weekSpent = (weekTask?.spent_minutes || 0) / 60;
                      const monthSpent = (monthTask?.spent_minutes || 0) / 60;
                      
                      if (!categoryMap.has(task.category_name)) {
                        categoryMap.set(task.category_name, {
                          category_name: task.category_name,
                          allocated: 0,
                          todaySpent: 0,
                          weekSpent: 0,
                          monthSpent: 0
                        });
                      }
                      
                      const cat = categoryMap.get(task.category_name)!;
                      cat.allocated += allocated;
                      cat.todaySpent += todaySpent;
                      cat.weekSpent += weekSpent;
                      cat.monthSpent += monthSpent;
                    });
                    
                    return Array.from(categoryMap.values())
                      .map((cat) => {
                        const weeklyAvg = cat.weekSpent / daysInWeek;
                        const monthlyAvg = cat.monthSpent / daysInMonth;
                        
                        // Calculate utilization percentages
                        const todayUtil = cat.allocated > 0 ? (cat.todaySpent / cat.allocated) * 100 : 0;
                        const weekUtil = cat.allocated > 0 ? (weeklyAvg / cat.allocated) * 100 : 0;
                        const monthUtil = cat.allocated > 0 ? (monthlyAvg / cat.allocated) * 100 : 0;
                        
                        return {
                          name: cat.category_name,
                          today: Math.min(todayUtil, 100),
                          todayOvertime: Math.max(todayUtil - 100, 0),
                          weekly: Math.min(weekUtil, 100),
                          weeklyOvertime: Math.max(weekUtil - 100, 0),
                          monthly: Math.min(monthUtil, 100),
                          monthlyOvertime: Math.max(monthUtil - 100, 0),
                          hasData: cat.allocated > 0 || cat.todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                        };
                      })
                      .filter(cat => cat.hasData)
                      .sort((a, b) => {
                        // Sort by Daily tab category order
                        const categoryOrderA = CATEGORY_ORDER.indexOf(a.name);
                        const categoryOrderB = CATEGORY_ORDER.indexOf(b.name);
                        return (categoryOrderA === -1 ? 999 : categoryOrderA) - (categoryOrderB === -1 ? 999 : categoryOrderB);
                      });
                  })()}
                  barSize={25}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    height={60}
                    interval={0}
                    tick={<CustomMultilineLabel />}
                  />
                  <YAxis 
                    label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  {/* Reference line at 100% - Target utilization */}
                  <ReferenceLine y={100} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" label={{ value: '100%', position: 'right', fill: '#10b981', fontSize: 12, fontWeight: 600 }} />
                  <Bar 
                    dataKey="today" 
                    name="Today %" 
                    stackId="today"
                    fill="#4299e1" 
                    radius={[0, 0, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontSize: 10, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                      if (!props || !props.payload) return '';
                      const payload = props.payload;
                      if (payload.todayOvertime > 0) return ''; // Overtime bar will show label
                      const total = payload.today || 0;
                      return total > 0 ? `${total.toFixed(0)}%` : '';
                    }}}
                  />
                  <Bar 
                    dataKey="todayOvertime" 
                    name="Overtime" 
                    stackId="today"
                    fill="#dc2626" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontSize: 10, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                      if (!props || !props.payload) return '';
                      const payload = props.payload;
                      const total = (payload.today || 0) + (payload.todayOvertime || 0);
                      return total > 0 ? `${total.toFixed(0)}%` : '';
                    }}}
                  />
                  {showUtilizationCategoryWeek && (
                    <>
                      <Bar 
                        dataKey="weekly" 
                        name="Weekly Avg %" 
                        stackId="weekly"
                        fill="#48bb78" 
                        radius={[0, 0, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontSize: 10, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          if (payload.weeklyOvertime > 0) return ''; // Overtime bar will show label
                          const total = payload.weekly || 0;
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                      <Bar 
                        dataKey="weeklyOvertime" 
                        name="Weekly Overtime" 
                        stackId="weekly"
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 10, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          const total = (payload.weekly || 0) + (payload.weeklyOvertime || 0);
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                    </>
                  )}
                  {showUtilizationCategoryMonth && (
                    <>
                      <Bar 
                        dataKey="monthly" 
                        name="Monthly Avg %" 
                        stackId="monthly"
                        fill="#ed8936" 
                        radius={[0, 0, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontSize: 10, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          if (payload.monthlyOvertime > 0) return ''; // Overtime bar will show label
                          const total = payload.monthly || 0;
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                      <Bar 
                        dataKey="monthlyOvertime" 
                        name="Monthly Overtime" 
                        stackId="monthly"
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 10, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          const total = (payload.monthly || 0) + (payload.monthlyOvertime || 0);
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* UTILIZATION PERCENTAGE CHART - ONE-TIME TASKS */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📊 Time Utilization Percentage: Daily: One-Time Tasks</h2>
                <p className="chart-description">Percentage of allocated time actually used for one-time tasks (100% = perfect match, &gt;100% = overtime)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showUtilizationOneTimeWeek ? 'active' : ''}`}
                  onClick={() => setShowUtilizationOneTimeWeek(!showUtilizationOneTimeWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showUtilizationOneTimeWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationOneTimeMonth ? 'active' : ''}`}
                  onClick={() => setShowUtilizationOneTimeMonth(!showUtilizationOneTimeMonth)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showUtilizationOneTimeMonth ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
                <button 
                  onClick={() => {
                    setModalChartType('utilization-onetime' as any);
                    setShowDetailModal(true);
                  }}
                  className="expand-button"
                >
                  🔍 View All
                </button>
              </div>
            </div>
            
            <div className="unified-comparison-chart">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    return allOneTimeTasksData
                      .map((task) => {
                        const todayTask = todayOneTimeTaskData.find(t => t.task_id === task.task_id);
                        const weekTask = weekOneTimeTaskData.find(t => t.task_id === task.task_id);
                        const monthTask = monthOneTimeTaskData.find(t => t.task_id === task.task_id);
                        
                        const allocated = task.allocated_minutes / 60;
                        const todaySpent = (todayTask?.spent_minutes || 0) / 60;
                        const weeklyAvg = (weekTask?.spent_minutes || 0) / 60 / daysInWeek;
                        const monthlyAvg = (monthTask?.spent_minutes || 0) / 60 / daysInMonth;
                        
                        // Calculate utilization percentages
                        const todayUtil = allocated > 0 ? (todaySpent / allocated) * 100 : 0;
                        const weekUtil = allocated > 0 ? (weeklyAvg / allocated) * 100 : 0;
                        const monthUtil = allocated > 0 ? (monthlyAvg / allocated) * 100 : 0;
                        
                        return {
                          name: task.task_name,
                          category: task.category_name,
                          today: Math.min(todayUtil, 100),
                          todayOvertime: Math.max(todayUtil - 100, 0),
                          weekly: Math.min(weekUtil, 100),
                          weeklyOvertime: Math.max(weekUtil - 100, 0),
                          monthly: Math.min(monthUtil, 100),
                          monthlyOvertime: Math.max(monthUtil - 100, 0),
                          hasData: allocated > 0 || todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                        };
                      })
                      .filter(task => task.hasData)
                      .sort((a, b) => {
                        // Sort by Daily tab order: category first
                        const categoryOrderA = CATEGORY_ORDER.indexOf(a.category);
                        const categoryOrderB = CATEGORY_ORDER.indexOf(b.category);
                        
                        if (categoryOrderA !== categoryOrderB) {
                          return (categoryOrderA === -1 ? 999 : categoryOrderA) - (categoryOrderB === -1 ? 999 : categoryOrderB);
                        }
                        
                        // Within same category, sort by task name order
                        const taskOrderA = TASK_NAME_ORDER[a.name] || 999;
                        const taskOrderB = TASK_NAME_ORDER[b.name] || 999;
                        
                        if (taskOrderA !== taskOrderB) {
                          return taskOrderA - taskOrderB;
                        }
                        
                        return a.name.localeCompare(b.name);
                      })
                      .slice(0, 20); // Show top 20 tasks
                  })()}
                  barSize={15}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    height={60}
                    interval={0}
                    tick={<CustomMultilineLabel />}
                  />
                  <YAxis 
                    label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  {/* Reference line at 100% - Target utilization */}
                  <ReferenceLine y={100} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" label={{ value: '100%', position: 'right', fill: '#10b981', fontSize: 12, fontWeight: 600 }} />
                  <Bar 
                    dataKey="today" 
                    name="Today %" 
                    stackId="today"
                    fill="#4299e1" 
                    radius={[0, 0, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                      if (!props || !props.payload) return '';
                      const payload = props.payload;
                      // Only show label if there's no overtime (red bar will handle it otherwise)
                      if (payload.todayOvertime > 0) return '';
                      const total = payload.today || 0;
                      return total > 0 ? `${total.toFixed(0)}%` : '';
                    }}}
                  />
                  <Bar 
                    dataKey="todayOvertime" 
                    name="Overtime" 
                    stackId="today"
                    fill="#dc2626" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                      if (!props || !props.payload) return '';
                      const payload = props.payload;
                      const total = (payload.today || 0) + (payload.todayOvertime || 0);
                      return total > 0 ? `${total.toFixed(0)}%` : '';
                    }}}
                  />
                  {showUtilizationOneTimeWeek && (
                    <>
                      <Bar 
                        dataKey="weekly" 
                        name="Weekly Avg %" 
                        stackId="weekly"
                        fill="#48bb78" 
                        radius={[0, 0, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          if (payload.weeklyOvertime > 0) return ''; // Overtime bar will show label
                          const total = payload.weekly || 0;
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                      <Bar 
                        dataKey="weeklyOvertime" 
                        name="Weekly Overtime" 
                        stackId="weekly"
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          const total = (payload.weekly || 0) + (payload.weeklyOvertime || 0);
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                    </>
                  )}
                  {showUtilizationOneTimeMonth && (
                    <>
                      <Bar 
                        dataKey="monthly" 
                        name="Monthly Avg %" 
                        stackId="monthly"
                        fill="#ed8936" 
                        radius={[0, 0, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontSize: 9, fontWeight: 500, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          if (payload.monthlyOvertime > 0) return ''; // Overtime bar will show label
                          const total = payload.monthly || 0;
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                      <Bar 
                        dataKey="monthlyOvertime" 
                        name="Monthly Overtime" 
                        stackId="monthly"
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number, name: any, props: any) => {
                          if (!props || !props.payload) return '';
                          const payload = props.payload;
                          const total = (payload.monthly || 0) + (payload.monthlyOvertime || 0);
                          return total > 0 ? `${total.toFixed(0)}%` : '';
                        }}}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CATEGORY TIME COMPARISON */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📂 Category Time Comparison</h2>
                <p className="chart-description">Ideal allocation vs actual time spent by category</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showCategoryWeek ? 'active' : ''}`}
                  onClick={() => setShowCategoryWeek(!showCategoryWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showCategoryWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showCategoryMonth ? 'active' : ''}`}
                  onClick={() => setShowCategoryMonth(!showCategoryMonth)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showCategoryMonth ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
              </div>
            </div>
            
            <div 
              className="category-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('category');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={(() => {
                    console.log('=== Category Chart Data Mapping ===');
                    console.log('allCategoriesData:', allCategoriesData);
                    console.log('todayCategoryData:', todayCategoryData);
                    console.log('weekCategoryData:', weekCategoryData);
                    console.log('monthCategoryData:', monthCategoryData);
                    
                    // Calculate days in week and month (Monday-based weeks)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate(); // Current day of month
                    
                    console.log('Week start (Monday):', weekStart);
                    console.log('Days in week so far:', daysInWeek);
                    console.log('Days in month so far:', daysInMonth);
                    
                    const mappedData = allCategoriesData
                      .filter((category) => category.allocated_hours > 0) // Only show categories with time allocated in daily tab
                      .map((category) => {
                        // Find matching today, week, and month data
                        const todayData = todayCategoryData.find(t => t.category_id === category.category_id);
                        const weekData = weekCategoryData.find(w => w.category_id === category.category_id);
                        const monthData = monthCategoryData.find(m => m.category_id === category.category_id);
                        
                        const result = {
                          category_name: category.category_name,
                          pillar_name: category.pillar_name,
                          allocated: category.allocated_hours, // Now from daily tab tasks
                          today: todayData?.spent_hours || 0,
                          weekAvg: weekData ? (weekData.spent_hours / daysInWeek) : 0,
                          monthAvg: monthData ? (monthData.spent_hours / daysInMonth) : 0,
                          sortOrder: CATEGORY_ORDER.indexOf(category.category_name)
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
                    
                    // Calculate total today time for validation
                    const totalTodayHours = mappedData.reduce((sum, cat) => sum + cat.today, 0);
                    console.log('Final mapped data:', mappedData);
                    console.log('⚠️ TOTAL TODAY TIME ACROSS ALL CATEGORIES:', totalTodayHours.toFixed(2), 'hours');
                    if (totalTodayHours > 24) {
                      console.error('❌ ERROR: Total time exceeds 24 hours! Possible double counting.');
                      console.error('Categories with time spent:');
                      mappedData
                        .filter(cat => cat.today > 0)
                        .forEach(cat => console.error(`  ${cat.category_name}: ${cat.today.toFixed(2)} hours`));
                    }
                    return mappedData;
                  })()}
                  barSize={12}
                  barCategoryGap={40}
                  margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="category_name" 
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    interval={0}
                    fontSize={12}
                  />
                  <YAxis 
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} 
                    domain={[0, 'auto']}
                  />
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
                  {showCategoryWeek && (
                    <Bar 
                      dataKey="weekAvg" 
                      name="Week Avg/Day" 
                      fill="#48bb78" 
                      radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                  {showCategoryMonth && (
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

          {/* DAILY TIME-BASED TASKS COMPARISON */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>⏰ Daily: Time-Based Tasks</h2>
                <p className="chart-description">Ideal allocation vs actual time spent (tasks from Daily tab ⏰Time-Based Tasks section)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showTaskWeek ? 'active' : ''}`}
                  onClick={() => setShowTaskWeek(!showTaskWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showTaskWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showTaskMonth ? 'active' : ''}`}
                  onClick={() => setShowTaskMonth(!showTaskMonth)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showTaskMonth ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
              </div>
            </div>
            
            <div 
              className="unified-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('task');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={(() => {
                    // Calculate days for proper averaging
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    // Map ALL tasks with all time periods
                    const mappedTaskData = allTasksData
                      .map((task) => {
                        const todayTask = todayTaskData.find(t => t.task_id === task.task_id);
                        const weekTask = weekTaskData.find(t => t.task_id === task.task_id);
                        const monthTask = monthTaskData.find(t => t.task_id === task.task_id);
                        
                        return {
                          name: task.task_name,
                          pillar: task.pillar_name,
                          category: task.category_name,
                          allocated: task.allocated_minutes / 60, // Convert to hours (daily)
                          today: (todayTask?.spent_minutes || 0) / 60,
                          weekly: (weekTask?.spent_minutes || 0) / 60 / daysInWeek, // Weekly average per day
                          monthly: (monthTask?.spent_minutes || 0) / 60 / daysInMonth, // Monthly average per day
                          totalSpent: (todayTask?.spent_minutes || 0) + (weekTask?.spent_minutes || 0) + (monthTask?.spent_minutes || 0)
                        };
                      })
                      .filter(task => task.allocated > 0 || task.totalSpent > 0) // Only tasks with allocation or time spent
                      .sort((a, b) => {
                        // Sort by Daily tab order: category first (which groups by pillar), then task name
                        const categoryOrderA = CATEGORY_ORDER.indexOf(a.category);
                        const categoryOrderB = CATEGORY_ORDER.indexOf(b.category);
                        
                        // Compare categories first
                        if (categoryOrderA !== categoryOrderB) {
                          return (categoryOrderA === -1 ? 999 : categoryOrderA) - (categoryOrderB === -1 ? 999 : categoryOrderB);
                        }
                        
                        // Within same category, sort by task name order, or alphabetically if not in list
                        const taskOrderA = TASK_NAME_ORDER[a.name] || 999;
                        const taskOrderB = TASK_NAME_ORDER[b.name] || 999;
                        
                        if (taskOrderA !== taskOrderB) {
                          return taskOrderA - taskOrderB;
                        }
                        
                        // If both not in order list, sort alphabetically
                        return a.name.localeCompare(b.name);
                      });
                    
                    // Debug logging for Time-Based Tasks chart
                    const totalTaskTodayHours = mappedTaskData.reduce((sum, task) => sum + task.today, 0);
                    console.log('📊 TIME-BASED TASKS - Total Today Hours:', totalTaskTodayHours.toFixed(2), 'hours');
                    if (totalTaskTodayHours > 24) {
                      console.error('❌ TIME-BASED TASKS ERROR: Total time exceeds 24 hours!');
                    }
                    
                    return mappedTaskData;
                  })()}
                  barSize={10}
                  barCategoryGap={25}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    height={60}
                    interval={0}
                    tick={<CustomMultilineLabel />}
                  />
                  <YAxis 
                    label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  <Bar 
                    dataKey="allocated" 
                    name="Ideal (Allocated)" 
                    fill="#cbd5e0" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#666', fontSize: 9, fontWeight: 500, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  <Bar 
                    dataKey="today" 
                    name="Today (Actual)" 
                    fill="#4299e1" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  {showTaskWeek && (
                    <Bar 
                      dataKey="weekly" 
                      name="Weekly Avg (Actual)" 
                      fill="#48bb78" 
                      radius={[4, 4, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                  {showTaskMonth && (
                    <Bar 
                      dataKey="monthly" 
                      name="Monthly Avg (Actual)" 
                      fill="#ed8936" 
                      radius={[4, 4, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DAILY ONE-TIME TASKS COMPARISON */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>⏰ Daily: One-Time Tasks</h2>
                <p className="chart-description">Ideal allocation vs actual time spent (tasks from Daily tab ⏰Daily: One Time Tasks section)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showOneTimeTaskWeek ? 'active' : ''}`}
                  onClick={() => setShowOneTimeTaskWeek(!showOneTimeTaskWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showOneTimeTaskWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showOneTimeTaskMonth ? 'active' : ''}`}
                  onClick={() => setShowOneTimeTaskMonth(!showOneTimeTaskMonth)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showOneTimeTaskMonth ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
              </div>
            </div>
            
            <div 
              className="unified-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('onetime-task');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={(() => {
                    // Calculate days for proper averaging
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    // Map ONE-TIME tasks with all time periods
                    return allOneTimeTasksData
                      .map((task) => {
                        const todayTask = todayOneTimeTaskData.find(t => t.task_id === task.task_id);
                        const weekTask = weekOneTimeTaskData.find(t => t.task_id === task.task_id);
                        const monthTask = monthOneTimeTaskData.find(t => t.task_id === task.task_id);
                        
                        return {
                          name: task.task_name,
                          category: task.category_name,
                          allocated: task.allocated_minutes, // Keep as minutes
                          today: (todayTask?.spent_minutes || 0),
                          weekly: (weekTask?.spent_minutes || 0) / daysInWeek, // Weekly average per day in minutes
                          monthly: (monthTask?.spent_minutes || 0) / daysInMonth, // Monthly average per day in minutes
                          totalSpent: (todayTask?.spent_minutes || 0) + (weekTask?.spent_minutes || 0) + (monthTask?.spent_minutes || 0)
                        };
                      })
                      .filter(task => task.allocated > 0 || task.totalSpent > 0) // Only tasks with allocation or time spent
                      .sort((a, b) => (b.allocated + b.totalSpent) - (a.allocated + a.totalSpent)); // Sort by most important
                  })()}
                  barSize={10}
                  barCategoryGap={25}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    height={60}
                    interval={0}
                    tick={<CustomMultilineLabel />}
                  />
                  <YAxis 
                    label={{ value: 'Minutes (Daily Average)', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <ReferenceLine y={0} stroke="#000" />
                  
                  {/* Allocated - Target line */}
                  <Bar 
                    dataKey="allocated" 
                    name="Allocated (Daily)" 
                    fill="#cbd5e0" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}m` : '' }}
                  />
                  
                  {/* Today's Actual */}
                  <Bar 
                    dataKey="today" 
                    name="Today (Actual)" 
                    fill="#4299e1" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}m` : '' }}
                  />
                  
                  {/* This Week Average - Only show if toggle is ON */}
                  {showOneTimeTaskWeek && (
                    <Bar 
                      dataKey="weekly" 
                      name="Weekly Avg (Actual)" 
                      fill="#48bb78" 
                      radius={[4, 4, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}m` : '' }}
                    />
                  )}
                  
                  {/* This Month Average - Only show if toggle is ON */}
                  {showOneTimeTaskMonth && (
                    <Bar 
                      dataKey="monthly" 
                      name="Monthly Avg (Actual)" 
                      fill="#ed8936" 
                      radius={[4, 4, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}m` : '' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PER-PILLAR CATEGORY BREAKDOWN CHARTS */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📊 Category Breakdown by Pillar</h2>
                <p className="chart-description">Time spent on categories within each pillar</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showCategoryBreakdownWeek ? 'active' : ''}`}
                  onClick={() => setShowCategoryBreakdownWeek(!showCategoryBreakdownWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showCategoryBreakdownWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showMonthColumn ? 'active' : ''}`}
                  onClick={() => setShowMonthColumn(!showMonthColumn)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showMonthColumn ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
              </div>
            </div>
            
            {dailyPillarData
              .sort((a, b) => {
                // Sort by Daily tab pillar order
                const orderA = PILLAR_ORDER.indexOf(a.pillar_name);
                const orderB = PILLAR_ORDER.indexOf(b.pillar_name);
                return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
              })
              .filter(pillar => pillar.spent_hours > 0)
              .map((pillar) => {
                // Get categories for this pillar
                const pillarCategories = allCategoriesData
                  .filter(cat => cat.pillar_name === pillar.pillar_name)
                  .map(category => {
                    const todayData = todayCategoryData.find(t => t.category_id === category.category_id);
                    const weekData = weekCategoryData.find(w => w.category_id === category.category_id);
                    const monthData = monthCategoryData.find(m => m.category_id === category.category_id);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    return {
                      category_name: category.category_name,
                      allocated: category.allocated_hours, // Daily allocation from Category table
                      today: todayData?.spent_hours || 0,
                      weekAvg: weekData ? (weekData.spent_hours / daysInWeek) : 0,
                      monthAvg: monthData ? (monthData.spent_hours / daysInMonth) : 0,
                      totalSpent: (todayData?.spent_hours || 0) + (weekData?.spent_hours || 0) + (monthData?.spent_hours || 0)
                    };
                  })
                  .filter(cat => cat.totalSpent > 0 || cat.allocated > 0)
                  .sort((a, b) => {
                    // Sort by Daily tab category order
                    const orderA = CATEGORY_ORDER.indexOf(a.category_name);
                    const orderB = CATEGORY_ORDER.indexOf(b.category_name);
                    return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
                  });

                if (pillarCategories.length === 0) return null;

                return (
                  <div key={pillar.pillar_id} className="pillar-category-breakdown">
                    <div className="pillar-category-header">
                      <h3 style={{ color: pillar.color_code }}>
                        {pillar.icon} {pillar.pillar_name}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="pillar-total-time">{pillar.spent_hours.toFixed(1)}h total</span>
                        <button 
                          className={`toggle-month-btn ${showCategoryBreakdownWeek[pillar.pillar_name] ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCategoryBreakdownWeek({...showCategoryBreakdownWeek, [pillar.pillar_name]: !showCategoryBreakdownWeek[pillar.pillar_name]});
                          }}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          {showCategoryBreakdownWeek[pillar.pillar_name] ? '📊 Hide Weekly' : '📊 Show Weekly'}
                        </button>
                        <button 
                          className={`toggle-month-btn ${showCategoryBreakdownMonth[pillar.pillar_name] ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCategoryBreakdownMonth({...showCategoryBreakdownMonth, [pillar.pillar_name]: !showCategoryBreakdownMonth[pillar.pillar_name]});
                          }}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          {showCategoryBreakdownMonth[pillar.pillar_name] ? '📊 Hide Monthly' : '📊 Show Monthly'}
                        </button>
                      </div>
                    </div>
                    <div
                      className="clickable-chart"
                      onClick={() => {
                        setModalChartType(('pillar-categories-' + pillar.pillar_id) as any);
                        setShowDetailModal(true);
                      }}
                      title="Click to view enlarged chart"
                      style={{ cursor: 'pointer' }}
                    >
                      <ResponsiveContainer width="100%" height={500}>
                      <BarChart 
                        data={pillarCategories}
                        barSize={35}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="category_name"
                          height={60}
                          interval={0}
                          tick={<CustomMultilineLabel />}
                        />
                        <YAxis 
                          label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '12px' }}
                          domain={[0, 'auto']}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar 
                          dataKey="allocated" 
                          name="Ideal (Allocated)" 
                          fill="#cbd5e0" 
                          radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                        />
                        <Bar 
                          dataKey="today" 
                          name="Today" 
                          fill="#4299e1" 
                          radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                        />
                        {showCategoryBreakdownWeek[pillar.pillar_name] && (
                          <Bar 
                            dataKey="weekAvg" 
                            name="Weekly Avg" 
                            fill="#48bb78" 
                            radius={[6, 6, 0, 0]}
                            label={{ position: 'top', fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                          />
                        )}
                        {showCategoryBreakdownMonth[pillar.pillar_name] && (
                          <Bar 
                            dataKey="monthAvg" 
                            name="Monthly Avg" 
                            fill="#ed8936" 
                            radius={[6, 6, 0, 0]}
                            label={{ position: 'top', fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* TASK-LEVEL BREAKDOWN BY PILLAR */}
          <div className="comparative-charts-section">
            <div className="section-header-with-toggle">
              <div>
                <h2>📋 Task Breakdown by Pillar</h2>
                <p className="chart-description">Individual task performance within each pillar</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`toggle-month-btn ${showTaskBreakdownWeek ? 'active' : ''}`}
                  onClick={() => setShowTaskBreakdownWeek(!showTaskBreakdownWeek)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showTaskBreakdownWeek ? '📊 Hide Weekly' : '📊 Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showMonthColumn ? 'active' : ''}`}
                  onClick={() => setShowMonthColumn(!showMonthColumn)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showMonthColumn ? '📊 Hide Monthly' : '📊 Show Monthly'}
                </button>
              </div>
            </div>
            
            {dailyPillarData
              .filter(pillar => pillar.spent_hours > 0)
              .map((pillar) => {
                // Get categories for this pillar to filter tasks
                const pillarCategoryIds = allCategoriesData
                  .filter(cat => cat.pillar_name === pillar.pillar_name)
                  .map(cat => cat.category_id);
                
                // Get all tasks for this pillar by matching category
                let debugCount = 0;
                const pillarTasks = allTasksData
                  .filter(task => {
                    // Find the category for this task
                    const taskCategory = allCategoriesData.find(cat => cat.category_name === task.category_name);
                    return taskCategory && pillarCategoryIds.includes(taskCategory.category_id);
                  })
                  .map(task => {
                    const todayData = todayTaskData.find(t => t.task_id === task.task_id);
                    const weekData = weekTaskData.find(w => w.task_id === task.task_id);
                    const monthData = monthTaskData.find(m => m.task_id === task.task_id);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    const taskData = {
                      task_name: task.task_name,
                      allocated: task.allocated_minutes / 60, // Convert to hours
                      today: todayData ? (todayData.spent_minutes / 60) : 0,
                      weekAvg: weekData ? (weekData.spent_minutes / 60 / daysInWeek) : 0,
                      monthAvg: monthData ? (monthData.spent_minutes / 60 / daysInMonth) : 0,
                      totalSpent: (todayData?.spent_minutes || 0) + (weekData?.spent_minutes || 0) + (monthData?.spent_minutes || 0)
                    };
                    
                    // Debug logging for first few tasks
                    if (debugCount < 3) {
                      console.log(`Task: ${task.task_name}`);
                      console.log(`  todayData:`, todayData);
                      console.log(`  weekData:`, weekData);
                      console.log(`  monthData:`, monthData);
                      console.log(`  Calculated: today=${taskData.today}h, weekAvg=${taskData.weekAvg}h, monthAvg=${taskData.monthAvg}h`);
                      debugCount++;
                    }
                    
                    return taskData;
                  })
                  .filter(task => task.totalSpent > 0 || task.allocated > 0)
                  .sort((a, b) => b.totalSpent - a.totalSpent);
                
                // Log summary for this pillar
                console.log(`${pillar.pillar_name} - All Tasks:`, {
                  totalTasks: pillarTasks.length,
                  sampleTasks: pillarTasks.slice(0, 3).map(t => ({
                    name: t.task_name,
                    allocated: t.allocated,
                    today: t.today,
                    weekAvg: t.weekAvg,
                    monthAvg: t.monthAvg
                  }))
                });

                if (pillarTasks.length === 0) return null;

                return (
                  <div key={`tasks-${pillar.pillar_id}`} className="pillar-category-breakdown">
                    <div className="pillar-category-header">
                      <h3 style={{ color: pillar.color_code }}>
                        {pillar.icon} {pillar.pillar_name} - All Tasks
                      </h3>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span className="pillar-total-time">{pillarTasks.length} tasks</span>
                        <button 
                          className={`toggle-month-btn ${showTaskBreakdownWeek[pillar.pillar_name] ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTaskBreakdownWeek({...showTaskBreakdownWeek, [pillar.pillar_name]: !showTaskBreakdownWeek[pillar.pillar_name]});
                          }}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          {showTaskBreakdownWeek[pillar.pillar_name] ? '📊 Hide Weekly' : '📊 Show Weekly'}
                        </button>
                        <button 
                          className={`toggle-month-btn ${showTaskBreakdownMonth[pillar.pillar_name] ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTaskBreakdownMonth({...showTaskBreakdownMonth, [pillar.pillar_name]: !showTaskBreakdownMonth[pillar.pillar_name]});
                          }}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          {showTaskBreakdownMonth[pillar.pillar_name] ? '📊 Hide Monthly' : '📊 Show Monthly'}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalChartType(('pillar-tasks-' + pillar.pillar_id) as any);
                            setShowDetailModal(true);
                          }}
                          className="expand-button"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          🔍 Expand
                        </button>
                      </div>
                    </div>
                    <div
                      className="clickable-chart"
                      onClick={() => {
                        setModalChartType(('pillar-tasks-' + pillar.pillar_id) as any);
                        setShowDetailModal(true);
                      }}
                      title="Click to view enlarged chart"
                      style={{ cursor: 'pointer' }}
                    >
                      <ResponsiveContainer width="100%" height={500}>
                      <BarChart 
                        data={pillarTasks}
                        barSize={20}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="task_name"
                          height={60}
                          interval={0}
                          tick={<CustomMultilineLabel />}
                        />
                        <YAxis 
                          label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '11px' }}
                          domain={[0, 'auto']}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar 
                          dataKey="allocated" 
                          name="Ideal (Allocated)" 
                          fill="#cbd5e0" 
                          radius={[4, 4, 0, 0]}
                          label={{ position: 'top', fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                        />
                        <Bar 
                          dataKey="today" 
                          name="Today (Actual)" 
                          fill="#4299e1" 
                          radius={[4, 4, 0, 0]}
                          label={{ position: 'top', fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                        />
                        {showTaskBreakdownWeek[pillar.pillar_name] && (
                          <Bar 
                            dataKey="weekAvg" 
                            name="Weekly Avg (Actual)" 
                            fill="#48bb78" 
                            radius={[4, 4, 0, 0]}
                            label={{ position: 'top', fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                          />
                        )}
                        {showTaskBreakdownMonth[pillar.pillar_name] && (
                          <Bar 
                            dataKey="monthAvg" 
                            name="Monthly Avg (Actual)" 
                            fill="#ed8936" 
                            radius={[4, 4, 0, 0]}
                            label={{ position: 'top', fontSize: 9, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
          </div>
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

      {/* DETAILED VIEW: Custom Date Selection with Comparison Charts */}
      {viewMode === 'detailed' && (
        <div className="detailed-view-section">
          <h2>📅 Detailed Analytics - Custom Time Period</h2>
          <p className="chart-description">Select a specific date, week, or month to view detailed comparisons</p>
          
          {/* Period Type and Date Selector */}
          <div className="detailed-controls">
            <div className="period-type-selector">
              <label>View By:</label>
              <select 
                value={detailedPeriodType} 
                onChange={(e) => setDetailedPeriodType(e.target.value as 'day' | 'week' | 'month')}
              >
                <option value="day">Single Day</option>
                <option value="week">Week (Monday-Sunday)</option>
                <option value="month">Month</option>
              </select>
            </div>
            
            <div className="date-selector">
              <label>Select Date:</label>
              <input
                type="date"
                value={detailedDate}
                onChange={(e) => setDetailedDate(e.target.value)}
              />
            </div>
            
            <button 
              className={`toggle-month-btn ${showMonthColumn ? 'active' : ''}`}
              onClick={() => setShowMonthColumn(!showMonthColumn)}
              style={{ marginLeft: 'auto' }}
            >
              {showMonthColumn ? '📊 Hide Monthly' : '📊 Show Monthly'}
            </button>
          </div>

          <div className="detailed-info-banner">
            <span className="info-icon">ℹ️</span>
            <span>
              {detailedPeriodType === 'day' && `Showing data for ${detailedDate}`}
              {detailedPeriodType === 'week' && `Showing data for week starting Monday of ${detailedDate}`}
              {detailedPeriodType === 'month' && `Showing data for entire month of ${detailedDate}`}
            </span>
          </div>

          {/* Same comparison charts as Overview */}
          <div className="comparative-charts-section">
            <div className="section-header">
              <h2>🎯 Pillar Time Comparison</h2>
              <p className="chart-description">Compare allocated vs actual time for selected period</p>
            </div>
            
            <div 
              className="unified-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('pillar-simple');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={pillarData.map((pillar) => ({
                    name: pillar.pillar_name,
                    allocated: pillar.allocated_hours,
                    actual: pillar.spent_hours,
                    color: pillar.color_code
                  }))}
                  barSize={40}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    style={{ fontSize: '14px', fontWeight: 600 }}
                  />
                  <YAxis 
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(2)}h`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend iconType="rect" />
                  <Bar 
                    dataKey="allocated" 
                    name="Allocated" 
                    fill="#cbd5e0" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#666', fontSize: 11, fontWeight: 500, formatter: (value: number) => `${value.toFixed(1)}h` }}
                  />
                  <Bar 
                    dataKey="actual" 
                    name="Actual" 
                    fill="#4299e1" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 11, formatter: (value: number) => `${value.toFixed(1)}h` }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Comparison for Detailed View */}
          <div className="comparative-charts-section">
            <div className="section-header">
              <h2>📂 Category Time Comparison</h2>
              <p className="chart-description">Daily allocated vs actual time by category for selected period</p>
            </div>
            
            <div 
              className="unified-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('category-simple');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={categoryData.slice(0, 10).map(cat => ({
                    category_name: cat.category_name,
                    allocated_hours: cat.allocated_hours, // Now from daily tab tasks
                    spent_hours: cat.spent_hours
                  }))}
                  barSize={25}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="category_name" 
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis 
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} 
                    domain={[0, 'auto']}
                  />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                  <Legend />
                  <Bar 
                    dataKey="allocated_hours" 
                    name="Allocated" 
                    fill="#cbd5e0" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="spent_hours" 
                    name="Actual" 
                    fill="#48bb78" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tasks Comparison for Detailed View */}
          <div className="comparative-charts-section">
            <div className="section-header">
              <h2>✓ Tasks Time Comparison</h2>
              <p className="chart-description">Top 10 tasks by time spent</p>
            </div>
            
            <div 
              className="unified-comparison-chart clickable-chart"
              onClick={() => {
                setModalChartType('task-simple');
                setShowDetailModal(true);
              }}
              title="Click to view enlarged chart"
            >
              <ResponsiveContainer width="100%" height={450}>
                <BarChart 
                  data={todayTaskData
                    .filter(task => task.allocated_minutes > 0 || task.spent_minutes > 0)
                    .sort((a, b) => b.spent_minutes - a.spent_minutes)
                    .slice(0, 10)
                    .map(task => ({
                      name: task.task_name,
                      allocated: task.allocated_minutes / 60,
                      actual: task.spent_minutes / 60
                    }))}
                  barSize={20}
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    style={{ fontSize: '10px' }}
                  />
                  <YAxis 
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} 
                    domain={[0, 'auto']}
                  />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                  <Legend />
                  <Bar 
                    dataKey="allocated" 
                    name="Allocated" 
                    fill="#cbd5e0" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="actual" 
                    name="Actual" 
                    fill="#ed8936" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PER-PILLAR CATEGORY BREAKDOWN FOR DETAILED VIEW */}
          <div className="comparative-charts-section">
            <div className="section-header">
              <h2>📊 Category Breakdown by Pillar</h2>
              <p className="chart-description">Time spent on categories within each pillar for selected period</p>
            </div>
            
            {pillarData
              .filter(pillar => pillar.spent_hours > 0)
              .map((pillar) => {
                // Get categories for this pillar based on selected date range
                const pillarCategories = categoryData
                  .filter(cat => cat.pillar_name === pillar.pillar_name)
                  .map(category => ({
                    category_name: category.category_name,
                    spent_hours: category.spent_hours,
                    allocated_hours: category.allocated_hours
                  }))
                  .filter(cat => cat.spent_hours > 0 || cat.allocated_hours > 0)
                  .sort((a, b) => b.spent_hours - a.spent_hours);

                if (pillarCategories.length === 0) return null;

                return (
                  <div key={pillar.pillar_id} className="pillar-category-breakdown">
                    <div className="pillar-category-header">
                      <h3 style={{ color: pillar.color_code }}>
                        {pillar.icon || '📌'} {pillar.pillar_name}
                      </h3>
                      <span className="pillar-total-time">{pillar.spent_hours.toFixed(1)}h total</span>
                    </div>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart 
                        data={pillarCategories}
                        layout="vertical"
                        barSize={25}
                        margin={{ top: 20, right: 30, left: 150, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" horizontal={false} />
                        <XAxis 
                          dataKey="category_name"
                          angle={-45}
                          textAnchor="end"
                          height={120}
                          interval={0}
                          style={{ fontSize: '11px' }}
                        />
                        <YAxis 
                          label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '11px' }}
                          domain={[0, 'auto']}
                        />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar 
                          dataKey="allocated_hours" 
                          name="Allocated" 
                          fill="#cbd5e0" 
                          radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                        />
                        <Bar 
                          dataKey="spent_hours" 
                          name="Actual" 
                          fill="#4299e1" 
                          radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 10, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* WHEEL MODE: Wheel of Life Visualization */}
      {viewMode === 'wheel' && (
        <WheelsOfLife
          dailyPillarData={dailyPillarData}
          weeklyPillarData={weeklyPillarData}
          monthlyPillarData={monthlyPillarData}
          todayCategoryData={todayCategoryData}
          weekCategoryData={weekCategoryData}
          monthCategoryData={monthCategoryData}
          todayTaskData={todayTaskData}
          weekTaskData={weekTaskData}
          monthTaskData={monthTaskData}
          todayOneTimeTaskData={todayOneTimeTaskData}
          weekOneTimeTaskData={weekOneTimeTaskData}
          monthOneTimeTaskData={monthOneTimeTaskData}
          allTasksData={allTasksData}
        />
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

      {/* DETAIL VIEW MODAL */}
      {showDetailModal && (
        <div className="chart-detail-modal" onClick={() => setShowDetailModal(false)}>
          <div 
            className={`modal-content modal-content-fullwidth ${modalChartType === 'task' ? 'task-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {modalChartType === 'pillar' && '🎯 Pillar Time Comparison - Detailed View'}
                {modalChartType === 'category' && '📂 Category Time Comparison - Detailed View'}
                {modalChartType === 'task' && '✓ Tasks Time Comparison - Detailed View'}
                {modalChartType === 'utilization' && '📊 Time Utilization Percentage: Daily Tasks - All Tasks'}
                {modalChartType === 'utilization-category' && '📊 Time Utilization Percentage: Daily Categories - All Categories'}
                {modalChartType === 'pillar-simple' && '🎯 Pillar Time Comparison'}
                {modalChartType === 'category-simple' && '📂 Category Time Comparison'}
                {modalChartType === 'task-simple' && '✓ Tasks Time Comparison'}
                {String(modalChartType).startsWith('pillar-tasks-') && '📋 Task Breakdown - Detailed View'}
                {String(modalChartType).startsWith('pillar-categories-') && '📊 Category Breakdown - Detailed View'}
              </h2>
              <button className="close-modal-btn" onClick={() => setShowDetailModal(false)}>
                ✕
              </button>
            </div>
            
            {/* Date/Week/Month Selector */}
            <div className="modal-date-controls">
              <div className="modal-view-type-selector">
                <button 
                  className={`modal-view-type-btn ${modalViewType === 'date' ? 'active' : ''}`}
                  onClick={() => setModalViewType('date')}
                >
                  📅 Date Range
                </button>
                <button 
                  className={`modal-view-type-btn ${modalViewType === 'week' ? 'active' : ''}`}
                  onClick={() => setModalViewType('week')}
                >
                  📆 Week
                </button>
                <button 
                  className={`modal-view-type-btn ${modalViewType === 'month' ? 'active' : ''}`}
                  onClick={() => setModalViewType('month')}
                >
                  🗓️ Month
                </button>
              </div>
              
              <div className="modal-date-inputs">
                {modalViewType === 'date' && (
                  <>
                    <div className="modal-date-input-group">
                      <label>Start Date</label>
                      <input 
                        type="date" 
                        value={modalStartDate}
                        onChange={(e) => setModalStartDate(e.target.value)}
                      />
                    </div>
                    <div className="modal-date-input-group">
                      <label>End Date</label>
                      <input 
                        type="date" 
                        value={modalEndDate}
                        onChange={(e) => setModalEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
                
                {modalViewType === 'week' && (
                  <div className="modal-date-input-group">
                    <label>Select Week (Monday)</label>
                    <input 
                      type="date" 
                      value={modalWeekDate}
                      onChange={(e) => {
                        const selectedDate = new Date(e.target.value);
                        const weekStart = getWeekStart(selectedDate);
                        setModalWeekDate(formatDateForInput(weekStart));
                      }}
                    />
                  </div>
                )}
                
                {modalViewType === 'month' && (
                  <div className="modal-date-input-group">
                    <label>Select Month</label>
                    <input 
                      type="month" 
                      value={modalMonth}
                      onChange={(e) => setModalMonth(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-body">
              {modalChartType === 'pillar' && (
                <ResponsiveContainer width="100%" height={800}>
                  <BarChart 
                    data={dailyPillarData.map((pillar) => {
                      const weekData = weeklyPillarData.find(w => w.pillar_id === pillar.pillar_id);
                      const monthData = monthlyPillarData.find(m => m.pillar_id === pillar.pillar_id);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Normalize to midnight
                      const weekStart = getWeekStart(today);
                      const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const daysInMonth = today.getDate();
                      return {
                        name: pillar.pillar_name,
                        allocated: pillar.allocated_hours,
                        today: pillar.spent_hours,
                        weekly: weekData ? (weekData.spent_hours / daysInWeek) : 0,
                        monthly: monthData ? (monthData.spent_hours / daysInMonth) : 0,
                      };
                    })}
                    barSize={100}
                    margin={{ top: 40, right: 80, left: 60, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" style={{ fontSize: '20px', fontWeight: 600 }} />
                    <YAxis label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft', style: { fontSize: '18px' } }} domain={[0, 'auto']} style={{ fontSize: '16px' }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} contentStyle={{ fontSize: '16px' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '16px' }} iconType="rect" iconSize={20} />
                    <Bar dataKey="allocated" name="Ideal (Allocated)" fill="#cbd5e0" radius={[10, 10, 0, 0]} label={{ position: 'top', fontSize: 16, fontWeight: 700 }} />
                    <Bar dataKey="today" name="Today (Actual)" fill="#4299e1" radius={[10, 10, 0, 0]} label={{ position: 'top', fontSize: 16, fontWeight: 700 }} />
                    <Bar dataKey="weekly" name="Weekly Avg (Actual)" fill="#48bb78" radius={[10, 10, 0, 0]} label={{ position: 'top', fontSize: 16, fontWeight: 700 }} />
                    {showMonthColumn && <Bar dataKey="monthly" name="Monthly Avg (Actual)" fill="#ed8936" radius={[10, 10, 0, 0]} label={{ position: 'top', fontSize: 16, fontWeight: 700 }} />}
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {modalChartType === 'category' && (
                <ResponsiveContainer width="100%" height={700}>
                  <BarChart 
                    data={allCategoriesData
                      .filter((category) => category.allocated_hours > 0) // Only show categories with time allocated in daily tab
                      .map((category) => {
                      const todayData = todayCategoryData.find(t => t.category_id === category.category_id);
                      const weekData = weekCategoryData.find(w => w.category_id === category.category_id);
                      const monthData = monthCategoryData.find(m => m.category_id === category.category_id);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Normalize to midnight
                      const weekStart = getWeekStart(today);
                      const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const daysInMonth = today.getDate();
                      return {
                        category_name: category.category_name,
                        allocated: category.allocated_hours, // Now from daily tab tasks
                        today: todayData?.spent_hours || 0,
                        weekAvg: weekData ? (weekData.spent_hours / daysInWeek) : 0,
                        monthAvg: monthData ? (monthData.spent_hours / daysInMonth) : 0,
                      };
                    })}
                    barSize={35}
                    margin={{ top: 30, right: 50, left: 30, bottom: 120 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="category_name" angle={-30} textAnchor="end" height={120} interval={0} style={{ fontSize: '13px' }} />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} domain={[0, 'auto']} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="allocated" name="Allocated (Daily)" fill="#cbd5e0" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12 }} />
                    <Bar dataKey="today" name="Today" fill="#4299e1" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12 }} />
                    <Bar dataKey="weekAvg" name="Week Avg/Day" fill="#48bb78" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12 }} />
                    {showCategoryMonth && <Bar dataKey="monthAvg" name="Month Avg/Day" fill="#ed8936" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12 }} />}
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {modalChartType === 'task' && (
                <ResponsiveContainer width="100%" height={800}>
                  <BarChart 
                    layout="vertical"
                    data={allTasksData
                      .map((task) => {
                        const todayTask = todayTaskData.find(t => t.task_id === task.task_id);
                        const weekTask = weekTaskData.find(t => t.task_id === task.task_id);
                        const monthTask = monthTaskData.find(t => t.task_id === task.task_id);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0); // Normalize to midnight
                        const weekStart = getWeekStart(today);
                        const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const daysInMonth = today.getDate();
                        return {
                          name: task.task_name,
                          allocated: task.allocated_minutes / 60,
                          today: (todayTask?.spent_minutes || 0) / 60,
                          weekly: (weekTask?.spent_minutes || 0) / 60 / daysInWeek,
                          monthly: (monthTask?.spent_minutes || 0) / 60 / daysInMonth,
                          totalSpent: (todayTask?.spent_minutes || 0) + (weekTask?.spent_minutes || 0) + (monthTask?.spent_minutes || 0)
                        };
                      })
                      .filter(task => task.allocated > 0 || task.totalSpent > 0)
                      .sort((a, b) => (b.allocated + b.totalSpent) - (a.allocated + a.totalSpent))}
                    barSize={20}
                    margin={{ top: 20, right: 80, left: 200, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" horizontal={false} />
                    <XAxis 
                      type="number" 
                      label={{ value: 'Hours (Daily Average)', position: 'insideBottom', offset: -10 }}
                      style={{ fontSize: '12px' }}
                      domain={[0, 'auto']}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={190}
                      style={{ fontSize: '11px' }}
                    />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="allocated" name="Ideal (Allocated)" fill="#cbd5e0" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10 }} />
                    <Bar dataKey="today" name="Today (Actual)" fill="#4299e1" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10 }} />
                    <Bar dataKey="weekly" name="Weekly Avg (Actual)" fill="#48bb78" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10 }} />
                    {showTaskMonth && <Bar dataKey="monthly" name="Monthly Avg (Actual)" fill="#ed8936" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10 }} />}
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {modalChartType === 'utilization' && (
                <ResponsiveContainer width="100%" height={Math.max(700, allTasksData.length * 35)}>
                  <BarChart 
                    data={(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Normalize to midnight
                      const weekStart = getWeekStart(today);
                      const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const daysInMonth = today.getDate();
                      
                      return allTasksData
                        .map((task) => {
                          const todayTask = todayTaskData.find(t => t.task_id === task.task_id);
                          const weekTask = weekTaskData.find(t => t.task_id === task.task_id);
                          const monthTask = monthTaskData.find(t => t.task_id === task.task_id);
                          
                          const allocated = task.allocated_minutes / 60;
                          const todaySpent = (todayTask?.spent_minutes || 0) / 60;
                          const weeklyAvg = (weekTask?.spent_minutes || 0) / 60 / daysInWeek;
                          const monthlyAvg = (monthTask?.spent_minutes || 0) / 60 / daysInMonth;
                          
                          const todayUtil = allocated > 0 ? (todaySpent / allocated) * 100 : 0;
                          const weekUtil = allocated > 0 ? (weeklyAvg / allocated) * 100 : 0;
                          const monthUtil = allocated > 0 ? (monthlyAvg / allocated) * 100 : 0;
                          
                          return {
                            name: task.task_name,
                            today: todayUtil,
                            weekly: weekUtil,
                            monthly: monthUtil,
                            hasData: allocated > 0 || todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                          };
                        })
                        .filter(task => task.hasData)
                        .sort((a, b) => (b.today + b.weekly + b.monthly) - (a.today + a.weekly + a.monthly));
                    })()}
                    barSize={25}
                    margin={{ top: 30, right: 50, left: 30, bottom: 180 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      angle={-60}
                      textAnchor="end"
                      height={170}
                      interval={0}
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis 
                      label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} 
                      style={{ fontSize: '13px' }}
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="rect" />
                    <Bar dataKey="today" name="Today %" fill="#4299e1" radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontSize: 11, fontWeight: 500, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}%` : '' }} />
                    <Bar dataKey="weekly" name="Weekly Avg %" fill="#48bb78" radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}%` : '' }} />
                    <Bar dataKey="monthly" name="Monthly Avg %" fill="#ed8936" radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 600, fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(0)}%` : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {String(modalChartType).startsWith('pillar-tasks-') && (() => {
                const pillarId = parseInt(String(modalChartType).replace('pillar-tasks-', ''));
                const pillar = dailyPillarData.find(p => p.pillar_id === pillarId);
                if (!pillar) return null;
                
                // Get categories that belong to this pillar by matching pillar_name
                const pillarCategoryIds = allCategoriesData
                  .filter(cat => cat.pillar_name === pillar.pillar_name)
                  .map(cat => cat.category_id);
                
                const pillarTasks = allTasksData
                  .filter(task => {
                    const taskCategory = allCategoriesData.find(cat => cat.category_name === task.category_name);
                    return taskCategory && pillarCategoryIds.includes(taskCategory.category_id);
                  })
                  .map(task => {
                    const todayData = todayTaskData.find(t => t.task_id === task.task_id);
                    const weekData = weekTaskData.find(w => w.task_id === task.task_id);
                    const monthData = monthTaskData.find(m => m.task_id === task.task_id);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    return {
                      task_name: task.task_name,
                      allocated: task.allocated_minutes / 60,
                      today: todayData ? (todayData.spent_minutes / 60) : 0,
                      weekAvg: weekData ? (weekData.spent_minutes / 60 / daysInWeek) : 0,
                      monthAvg: monthData ? (monthData.spent_minutes / 60 / daysInMonth) : 0,
                      totalSpent: (todayData?.spent_minutes || 0) + (weekData?.spent_minutes || 0) + (monthData?.spent_minutes || 0)
                    };
                  })
                  .filter(task => task.totalSpent > 0 || task.allocated > 0)
                  .sort((a, b) => b.totalSpent - a.totalSpent);
                
                return (
                  <div>
                    <h3 style={{ color: pillar.color_code, marginBottom: '20px' }}>
                      {pillar.icon} {pillar.pillar_name} - All Tasks ({pillarTasks.length} tasks)
                    </h3>
                    <ResponsiveContainer width="100%" height={Math.max(700, pillarTasks.length * 40)}>
                      <BarChart 
                        data={pillarTasks}
                        barSize={30}
                        margin={{ top: 30, right: 50, left: 30, bottom: 180 }}
                      >
                        <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="task_name"
                          angle={-60}
                          textAnchor="end"
                          height={170}
                          interval={0}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '13px' }}
                          domain={[0, 'auto']}
                        />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="allocated" name="Ideal (Allocated)" fill="#cbd5e0" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                        <Bar dataKey="today" name="Today (Actual)" fill="#4299e1" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                        <Bar dataKey="weekAvg" name="Weekly Avg (Actual)" fill="#48bb78" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                        <Bar dataKey="monthAvg" name="Monthly Avg (Actual)" fill="#ed8936" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 11, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
              
              {/* Simple Pillar Comparison Modal */}
              {modalChartType === 'pillar-simple' && (
                <ResponsiveContainer width="100%" height={800}>
                  <BarChart 
                    data={pillarData.map((pillar) => ({
                      name: pillar.pillar_name,
                      allocated: pillar.allocated_hours,
                      actual: pillar.spent_hours
                    }))}
                    barSize={120}
                    margin={{ top: 40, right: 80, left: 60, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" style={{ fontSize: '20px', fontWeight: 600 }} />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: '18px' } }} style={{ fontSize: '16px' }} domain={[0, 'auto']} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} contentStyle={{ fontSize: '16px' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '16px' }} iconType="rect" iconSize={20} />
                    <Bar dataKey="allocated" name="Allocated" fill="#cbd5e0" radius={[10, 10, 0, 0]} label={{ position: 'top', fontSize: 18, fontWeight: 700 }} />
                    <Bar dataKey="actual" name="Actual" fill="#4299e1" radius={[10, 10, 0, 0]} label={{ position: 'top', fontSize: 18, fontWeight: 700 }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {/* Simple Category Comparison Modal */}
              {modalChartType === 'category-simple' && (
                <ResponsiveContainer width="100%" height={850}>
                  <BarChart 
                    data={categoryData.map(cat => ({
                      category_name: cat.category_name,
                      allocated_hours: cat.allocated_hours,
                      spent_hours: cat.spent_hours
                    }))}
                    barSize={60}
                    margin={{ top: 40, right: 80, left: 60, bottom: 180 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="category_name" angle={-60} textAnchor="end" height={170} interval={0} style={{ fontSize: '15px' }} />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: '18px' } }} style={{ fontSize: '16px' }} domain={[0, 'auto']} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} contentStyle={{ fontSize: '16px' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '16px' }} iconSize={20} />
                    <Bar dataKey="allocated_hours" name="Allocated (Daily)" fill="#cbd5e0" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 14, fontWeight: 700 }} />
                    <Bar dataKey="spent_hours" name="Actual" fill="#48bb78" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 14, fontWeight: 700 }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {/* Simple Task Comparison Modal */}
              {modalChartType === 'task-simple' && (
                <ResponsiveContainer width="100%" height={Math.max(850, todayTaskData.filter(t => t.allocated_minutes > 0 || t.spent_minutes > 0).length * 45)}>
                  <BarChart 
                    data={todayTaskData
                      .filter(task => task.allocated_minutes > 0 || task.spent_minutes > 0)
                      .sort((a, b) => b.spent_minutes - a.spent_minutes)
                      .map(task => ({
                        name: task.task_name,
                        allocated: task.allocated_minutes / 60,
                        actual: task.spent_minutes / 60
                      }))}
                    barSize={35}
                    margin={{ top: 40, right: 80, left: 60, bottom: 200 }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" angle={-60} textAnchor="end" height={190} interval={0} style={{ fontSize: '14px' }} />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: '18px' } }} style={{ fontSize: '16px' }} domain={[0, 'auto']} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} contentStyle={{ fontSize: '16px' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '16px' }} iconSize={20} />
                    <Bar dataKey="allocated" name="Allocated" fill="#cbd5e0" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 13, fontWeight: 700 }} />
                    <Bar dataKey="actual" name="Actual" fill="#48bb78" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 13, fontWeight: 700 }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {/* Pillar Categories Modal */}
              {String(modalChartType).startsWith('pillar-categories-') && (() => {
                const pillarId = parseInt(String(modalChartType).replace('pillar-categories-', ''));
                const pillar = dailyPillarData.find(p => p.pillar_id === pillarId);
                if (!pillar) return null;
                
                const pillarCategories = allCategoriesData
                  .filter(cat => cat.pillar_name === pillar.pillar_name)
                  .map(category => {
                    const todayData = todayCategoryData.find(t => t.category_id === category.category_id);
                    const weekData = weekCategoryData.find(w => w.category_id === category.category_id);
                    const monthData = monthCategoryData.find(m => m.category_id === category.category_id);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize to midnight
                    const weekStart = getWeekStart(today);
                    const daysInWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const daysInMonth = today.getDate();
                    
                    return {
                      category_name: category.category_name,
                      allocated: category.allocated_hours,
                      today: todayData?.spent_hours || 0,
                      weekAvg: weekData ? (weekData.spent_hours / daysInWeek) : 0,
                      monthAvg: monthData ? (monthData.spent_hours / daysInMonth) : 0
                    };
                  })
                  .filter(cat => cat.allocated > 0 || cat.today > 0 || cat.weekAvg > 0 || cat.monthAvg > 0);
                
                return (
                  <div>
                    <h3 style={{ color: pillar.color_code, marginBottom: '20px' }}>
                      {pillar.icon} {pillar.pillar_name} - Categories ({pillarCategories.length} categories)
                    </h3>
                    <ResponsiveContainer width="100%" height={600}>
                      <BarChart 
                        data={pillarCategories}
                        barSize={40}
                        margin={{ top: 30, right: 50, left: 30, bottom: 120 }}
                      >
                        <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="category_name"
                          angle={-45}
                          textAnchor="end"
                          height={110}
                          interval={0}
                          style={{ fontSize: '13px' }}
                        />
                        <YAxis 
                          label={{ value: 'Hours (Daily Average)', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '14px' }}
                          domain={[0, 'auto']}
                        />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="allocated" name="Ideal (Allocated)" fill="#cbd5e0" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 12, fontWeight: 600, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                        <Bar dataKey="today" name="Today" fill="#4299e1" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 12, fontWeight: 600, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                        <Bar dataKey="weekAvg" name="Weekly Avg" fill="#48bb78" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 12, fontWeight: 600, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                        <Bar dataKey="monthAvg" name="Monthly Avg" fill="#ed8936" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 12, fontWeight: 600, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
