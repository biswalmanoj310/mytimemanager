import { useState, useEffect, useRef } from 'react';
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
  LineChart,
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
  Cell,
  LabelList
} from 'recharts';
import apiClient from '../services/api';
import './Analytics.css';

// Dynamic pillar/category configuration (loaded from API)
interface PillarConfig {
  id: number;
  name: string;
  order: number;
}

interface CategoryConfig {
  id: number;
  name: string;
  pillar_id: number;
  order: number;
}

interface TaskConfig {
  id: number;
  name: string;
  category_id: number;
  order: number;
}

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
    
    words.forEach((word: string) => {
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
  
  // Dynamic configuration from database
  const [pillarsConfig, setPillarsConfig] = useState<PillarConfig[]>([]);
  const [categoriesConfig, setCategoriesConfig] = useState<CategoryConfig[]>([]);
  const [tasksConfig, setTasksConfig] = useState<TaskConfig[]>([]);
  
  // Get initial viewMode from URL params or default to 'overview'
  const getInitialViewMode = (): 'overview' | 'categories' | 'tasks' | 'wheel' | 'detailed' => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'wheel' || view === 'categories' || view === 'tasks' || view === 'detailed') {
      return view;
    }
    return 'overview';
  };

  // Get initial detailedViewType from URL params or default to 'tasks'
  const getInitialDetailedViewType = (): 'tasks' | 'categories' | 'pillars' | 'balance_visualization' | 'circle_of_life' => {
    const params = new URLSearchParams(window.location.search);
    const detailView = params.get('detailView');
    if (detailView === 'categories' || detailView === 'pillars' || detailView === 'balance_visualization' || detailView === 'circle_of_life') {
      return detailView;
    }
    return 'tasks';
  };
  
  const [viewMode, setViewMode] = useState<'overview' | 'categories' | 'tasks' | 'wheel' | 'detailed'>(getInitialViewMode());
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  
  // Detailed view state
  const [detailedPeriodType, setDetailedPeriodType] = useState<'day' | 'week' | 'month'>('week');
  const [detailedDate, setDetailedDate] = useState<string>(formatDateForInput(new Date()));
  
  // Detailed view - Multi-select state (up to 3 items)
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [detailedViewType, setDetailedViewType] = useState<'tasks' | 'categories' | 'pillars' | 'balance_visualization' | 'circle_of_life'>(getInitialDetailedViewType());
  const getInitialCircleType = (): 'pillar' | 'category' | 'tasks' | 'one_time' => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('circleType');
    if (v === 'category' || v === 'tasks' || v === 'one_time') return v;
    return 'pillar';
  };
  const getInitialCirclePeriod = (): 'week' | 'month' => {
    const params = new URLSearchParams(window.location.search);
    return params.get('circlePeriod') === 'month' ? 'month' : 'week';
  };

  const [circleOfLifePeriod, setCircleOfLifePeriod] = useState<'week' | 'month'>(getInitialCirclePeriod());
  const [circleOfLifeType, setCircleOfLifeType] = useState<'pillar' | 'category' | 'tasks' | 'one_time'>(getInitialCircleType());
  const [circleOfLifeData, setCircleOfLifeData] = useState<{label: string; start: string; end: string; data: any[]}[]>([]);
  const [circleOfLifeLoading, setCircleOfLifeLoading] = useState(false);
  // Balance viz period: 'today' | 'week' | 'month'
  const [balancePeriod, setBalancePeriod] = useState<'today' | 'week' | 'month'>('today');

  // Task Registry state
  const [registryTasks, setRegistryTasks] = useState<any[]>([]);
  const [registryGoals, setRegistryGoals] = useState<any[]>([]);
  const [registryProjects, setRegistryProjects] = useState<any[]>([]);
  const [registryWishes, setRegistryWishes] = useState<any[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryFilter, setRegistryFilter] = useState<'all' | 'in_progress' | 'completed' | 'inactive'>('all');
  const [registrySearch, setRegistrySearch] = useState('');

  
  // Detailed view - Week/Month-over-Week/Month toggles
  const [showWeekOverWeek, setShowWeekOverWeek] = useState(false);
  const [showMonthOverMonth, setShowMonthOverMonth] = useState(false);
  const [showAsHours, setShowAsHours] = useState(false);
  const [showUtilizationAsHours, setShowUtilizationAsHours] = useState(false);
  
  // Detailed view - Historical trend data
  const [taskTrendData, setTaskTrendData] = useState<any[]>([]);
  const [categoryTrendData, setCategoryTrendData] = useState<any[]>([]);
  const [pillarTrendData, setPillarTrendData] = useState<any[]>([]);
  
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
  const [showCategoryBreakdownWeekAll, setShowCategoryBreakdownWeekAll] = useState(false); // Section-level toggle
  const [showCategoryBreakdownMonth, setShowCategoryBreakdownMonth] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showTaskBreakdownWeek, setShowTaskBreakdownWeek] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showTaskBreakdownWeekAll, setShowTaskBreakdownWeekAll] = useState(false); // Section-level toggle
  const [showTaskBreakdownMonth, setShowTaskBreakdownMonth] = useState<{[key: string]: boolean}>({}); // Toggle per pillar
  const [showUtilizationTaskWeek, setShowUtilizationTaskWeek] = useState(false);
  const [showUtilizationTaskMonth, setShowUtilizationTaskMonth] = useState(false);
  const [showUtilizationCategoryWeek, setShowUtilizationCategoryWeek] = useState(false);
  const [showUtilizationCategoryMonth, setShowUtilizationCategoryMonth] = useState(false);
  const [showUtilizationOneTimeWeek, setShowUtilizationOneTimeWeek] = useState(false);
  const [showUtilizationOneTimeMonth, setShowUtilizationOneTimeMonth] = useState(false);
  
  // Modal state for detail view
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalChartType, setModalChartType] = useState<'pillar' | 'category' | 'task' | 'utilization' | string>('pillar');
  
  // Modal date filtering state
  const [modalViewType, setModalViewType] = useState<'date' | 'week' | 'month'>('date');
  const [modalStartDate, setModalStartDate] = useState(formatDateForInput(new Date()));
  const [modalEndDate, setModalEndDate] = useState(formatDateForInput(new Date()));
  const [modalWeekDate, setModalWeekDate] = useState(formatDateForInput(new Date()));
  const [modalMonth, setModalMonth] = useState(formatDateForInput(new Date()).substring(0, 7)); // YYYY-MM format

  // Note: Weekly/Monthly toggles intentionally reset to false on every page load/refresh

  // Ref holding the scroll Y to restore after data loads
  const pendingScrollRef = useRef<number | null>(null);

  // On mount: read saved scroll position and store in ref for later restoration
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('analytics-scroll-y');
    if (savedScroll) {
      pendingScrollRef.current = parseInt(savedScroll, 10);
      sessionStorage.removeItem('analytics-scroll-y');
    }
  }, []);

  // Restore scroll once the heaviest loading state settles (circle data or main data)
  useEffect(() => {
    if (!circleOfLifeLoading && !loading && pendingScrollRef.current !== null) {
      const y = pendingScrollRef.current;
      pendingScrollRef.current = null;
      // Small frame delay so the DOM has painted
      const t = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), 80);
      return () => clearTimeout(t);
    }
  }, [circleOfLifeLoading, loading]);

  // Save scroll position before page unload
  useEffect(() => {
    const saveScroll = () => sessionStorage.setItem('analytics-scroll-y', window.scrollY.toString());
    window.addEventListener('beforeunload', saveScroll);
    return () => window.removeEventListener('beforeunload', saveScroll);
  }, []);

  // Load dynamic configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

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

  // Load detailed trend data when selections change
  useEffect(() => {
    if (viewMode === 'detailed') {
      loadDetailedTrendData();
    }
  }, [viewMode, detailedViewType, selectedTasks, selectedCategories, selectedPillars]);

  // Load circle of life data when view type or period changes
  useEffect(() => {
    if (viewMode === 'detailed' && detailedViewType === 'circle_of_life') {
      loadCircleOfLifeData(circleOfLifePeriod, circleOfLifeType);
    }
  }, [viewMode, detailedViewType, circleOfLifePeriod, circleOfLifeType]);

  // Load task registry when tasks tab becomes active
  useEffect(() => {
    if (viewMode === 'tasks') {
      loadTaskRegistry();
    }
  }, [viewMode]);

  // Load pillars, categories, and tasks configuration from API
  const loadConfiguration = async () => {
    try {
      // Load pillars
      const pillarsResponse = await apiClient.get('/api/pillars/');
      const pillars = pillarsResponse.data.map((p: any, index: number) => ({
        id: p.id,
        name: p.name,
        order: index // Use array order from database
      }));
      setPillarsConfig(pillars);
      
      // Load categories
      const categoriesResponse = await apiClient.get('/api/categories/');
      const categories = categoriesResponse.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        pillar_id: c.pillar_id,
        order: c.id // Use ID as order to match Daily tab
      }));
      setCategoriesConfig(categories);
      
      // Load all tasks for ordering
      const tasksResponse = await apiClient.get('/api/tasks?limit=1000');
      const tasks = tasksResponse.data.map((t: any) => ({
        id: t.id,
        name: t.name,
        category_id: t.category_id,
        order: t.id // Use ID as order to match Daily tab
      }));
      setTasksConfig(tasks);
      
      console.log('Loaded configuration:', {
        pillars: pillars.length,
        categories: categories.length,
        tasks: tasks.length
      });
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const loadTaskRegistry = async () => {
    setRegistryLoading(true);
    try {
      const [tasksRes, goalsRes, projectsRes, wishesRes] = await Promise.all([
        apiClient.get('/api/tasks/?limit=100000'),
        apiClient.get('/api/life-goals/'),
        apiClient.get('/api/projects/'),
        apiClient.get('/api/wishes/'),
      ]);
      setRegistryTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setRegistryGoals(Array.isArray(goalsRes.data) ? goalsRes.data : []);
      setRegistryProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      setRegistryWishes(Array.isArray(wishesRes.data) ? wishesRes.data : []);
    } catch (err) {
      console.error('Failed to load task registry:', err);
    } finally {
      setRegistryLoading(false);
    }
  };
  
  const getPillarOrder = (pillarName: string): number => {
    const pillar = pillarsConfig.find(p => p.name === pillarName);
    return pillar ? pillar.order : 999;
  };
  
  // Define hierarchy order (same as Daily tab in Tasks.tsx)
  const hierarchyOrder: { [key: string]: number } = {
    // Hard Work
    'Hard Work|Office-Tasks': 1,
    'Hard Work|Learning': 2,
    'Hard Work|Confidence': 3,
    // Calmness
    'Calmness|Yoga': 4,
    'Calmness|Sleep': 5,
    // Family
    'Family|My Tasks': 6,
    'Family|Home Tasks': 7,
    'Family|Time Waste': 8,
  };
  
  const getCategoryOrder = (categoryName: string): number => {
    // Find category to get pillar info
    const category = categoriesConfig.find(c => c.name === categoryName);
    if (!category) return 999;
    
    // Find pillar name
    const pillar = pillarsConfig.find(p => p.id === category.pillar_id);
    if (!pillar) return 999;
    
    // Use hierarchy order mapping
    const hierarchyKey = `${pillar.name}|${categoryName}`;
    return hierarchyOrder[hierarchyKey] || 999;
  };
  
  const getTaskOrder = (taskName: string): number => {
    const task = tasksConfig.find(t => t.name === taskName);
    return task ? task.order : 999;
  };

  const loadCircleOfLifeData = async (period: 'week' | 'month' | 'year', cType: 'pillar' | 'category' | 'tasks' | 'one_time') => {
    setCircleOfLifeLoading(true);
    const PILLAR_ORDER_LOCAL = ['Hard Work', 'Calmness', 'Family'];
    const CATEGORY_ORDER_LOCAL = ['Office-Tasks', 'Learning', 'Confidence', 'Yoga', 'Sleep', 'My Tasks', 'Home Tasks', 'Time Waste'];

    const fetchData = async (startStr: string, endStr: string) => {
      if (cType === 'pillar') {
        const resp = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${startStr}&end_date=${endStr}`);
        return (resp.data.pillars || []).sort((a: PillarData, b: PillarData) =>
          PILLAR_ORDER_LOCAL.indexOf(a.pillar_name) - PILLAR_ORDER_LOCAL.indexOf(b.pillar_name)
        );
      } else if (cType === 'category') {
        const resp = await apiClient.get(`/api/analytics/category-breakdown?start_date=${startStr}&end_date=${endStr}`);
        const cats: CategoryData[] = resp.data.categories || [];
        return cats.sort((a, b) => CATEGORY_ORDER_LOCAL.indexOf(a.category_name) - CATEGORY_ORDER_LOCAL.indexOf(b.category_name));
      } else {
        // tasks / one_time — fetch actual task-level time entries
        const baseTaskList = cType === 'tasks' ? allTasksData : allOneTimeTasksData;
        const entriesResp = await apiClient.get(`/api/daily-time?start_date=${startStr}&end_date=${endStr}`);
        const entries: any[] = entriesResp.data || [];
        const spentMap = new Map<number, number>();
        entries.forEach((e: any) => { spentMap.set(e.task_id, (spentMap.get(e.task_id) || 0) + e.minutes); });
        // Sort by pillar → category → task ID (same order as Daily tab)
        const sorted = [...baseTaskList]
          .filter(t => t.allocated_minutes > 0)
          .sort((a, b) => {
            const pa = PILLAR_ORDER_LOCAL.indexOf(a.pillar_name || '');
            const pb = PILLAR_ORDER_LOCAL.indexOf(b.pillar_name || '');
            if (pa !== pb) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
            const ca = CATEGORY_ORDER_LOCAL.indexOf(a.category_name || '');
            const cb = CATEGORY_ORDER_LOCAL.indexOf(b.category_name || '');
            if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb);
            return (a.task_id || 0) - (b.task_id || 0);
          });
        return sorted.map(task => ({
          name: task.task_name,
          category_name: task.category_name || '',
          allocated_hours: task.allocated_minutes / 60,
          spent_hours: (spentMap.get(task.task_id) || 0) / 60
        }));
      }
    };

    try {
      const today = new Date();
      const periods: {label: string; start: string; end: string; data: any[]}[] = [];

      if (period === 'week') {
        const currentWeekMonday = getWeekStart(today);
        for (let i = 7; i >= 0; i--) {
          const weekStart = new Date(currentWeekMonday);
          weekStart.setDate(currentWeekMonday.getDate() - i * 7);
          const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
          const actualEnd = weekEnd > today ? today : weekEnd;
          const startStr = formatDateForInput(weekStart);
          const endStr = formatDateForInput(actualEnd);
          const label = i === 0 ? 'This Week' : i === 1 ? 'Last Week' :
            `${weekStart.toLocaleString('en-US', { month: 'short', day: 'numeric' })}–${actualEnd.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
          try {
            const data = await fetchData(startStr, endStr);
            periods.push({ label, start: startStr, end: endStr, data });
          } catch { periods.push({ label, start: startStr, end: endStr, data: [] }); }
        }
      } else if (period === 'month') {
        for (let i = 7; i >= 0; i--) {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
          const actualEnd = monthEnd > today ? today : monthEnd;
          const startStr = formatDateForInput(monthStart);
          const endStr = formatDateForInput(actualEnd);
          const label = monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          try {
            const data = await fetchData(startStr, endStr);
            periods.push({ label, start: startStr, end: endStr, data });
          } catch { periods.push({ label, start: startStr, end: endStr, data: [] }); }
        }
      } else { // year — last 8 full years
        for (let i = 7; i >= 0; i--) {
          const yr = today.getFullYear() - i;
          const yearStart = new Date(yr, 0, 1);
          const yearEnd = new Date(yr, 11, 31);
          const actualEnd = yearEnd > today ? today : yearEnd;
          const startStr = formatDateForInput(yearStart);
          const endStr = formatDateForInput(actualEnd);
          const label = yr.toString();
          try {
            const data = await fetchData(startStr, endStr);
            periods.push({ label, start: startStr, end: endStr, data });
          } catch { periods.push({ label, start: startStr, end: endStr, data: [] }); }
        }
      }
      setCircleOfLifeData([...periods].reverse()); // newest first
    } catch (error) {
      console.error('Error loading circle of life data:', error);
    } finally {
      setCircleOfLifeLoading(false);
    }
  };

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
      // Sort categories by Daily tab hierarchy order
      const sortedCategories = (allCategoriesResponse.data.categories || []).sort((a: CategoryData, b: CategoryData) => {
        const orderA = getCategoryOrder(a.category_name);
        const orderB = getCategoryOrder(b.category_name);
        return orderA - orderB;
      });
      setAllCategoriesData(sortedCategories);
      console.log('All categories (base, sorted):', sortedCategories);
      
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
      const allTasksResponse = await apiClient.get('/api/tasks?limit=1000&is_active=true&is_completed=false');
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

          // Exclude tasks completed on a previous day via daily_task_status
          // (matches Daily tab behaviour — same check used for one-time tasks)
          const completionDateStr = dailyTaskCompletionDates.get(task.id);
          if (completionDateStr) {
            const [year, month, day] = completionDateStr.split('-').map(Number);
            const completionDate = new Date(year, month - 1, day);
            completionDate.setHours(0, 0, 0, 0);
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            if (completionDate < todayMidnight) return false;
          }

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

  // Load detailed trend data for selected tasks/categories/pillars
  const loadDetailedTrendData = async () => {
    if (viewMode !== 'detailed') return;
    
    try {
      const today = new Date();
      
      // Load task trends if tasks are selected
      if (detailedViewType === 'tasks' && selectedTasks.length > 0) {
        // Load last 56 days (8 weeks) of data
        const dailyData: any[] = [];
        for (let i = 55; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = formatDateForInput(date);
          
          const response = await apiClient.get(`/api/daily-time/entries/${dateStr}`);
          const entries = response.data || [];
          
          // Aggregate by task
          const dayData: any = { date: dateStr };
          selectedTasks.forEach(taskId => {
            // Check both regular tasks and one-time tasks
            const task = allTasksData.find(t => t.task_id === taskId) || allOneTimeTasksData.find(t => t.task_id === taskId);
            if (task) {
              const taskEntries = entries.filter((e: any) => e.task_id === taskId);
              const totalMinutes = taskEntries.reduce((sum: number, e: any) => sum + (e.minutes || 0), 0);
              const allocated = task.allocated_minutes;
              const utilization = allocated > 0 ? (totalMinutes / allocated) * 100 : 0;
              const hours = totalMinutes / 60;
              dayData[`task_${taskId}`] = utilization;
              dayData[`task_${taskId}_hours`] = hours;
              dayData[`task_${taskId}_name`] = task.task_name;
            }
          });
          dailyData.push(dayData);
        }
        setTaskTrendData(dailyData);
      }
      
      // Load category trends if categories are selected
      if (detailedViewType === 'categories' && selectedCategories.length > 0) {
        const dailyData: any[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = formatDateForInput(date);
          
          const response = await apiClient.get(`/api/analytics/category-breakdown?start_date=${dateStr}&end_date=${dateStr}`);
          const categories = response.data.categories || [];
          
          const dayData: any = { date: dateStr };
          selectedCategories.forEach(categoryName => {
            const category = categories.find((c: any) => c.category_name === categoryName);
            if (category) {
              const allocated = category.allocated_hours;
              const spent = category.spent_hours;
              const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
              dayData[`category_${categoryName}`] = utilization;
              dayData[`category_${categoryName}_hours`] = spent;
            }
          });
          dailyData.push(dayData);
        }
        setCategoryTrendData(dailyData);
      }
      
      // Load pillar trends if pillars are selected
      if (detailedViewType === 'pillars' && selectedPillars.length > 0) {
        const dailyData: any[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = formatDateForInput(date);
          
          const response = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${dateStr}&end_date=${dateStr}`);
          const pillars = response.data.pillars || [];
          
          const dayData: any = { date: dateStr };
          selectedPillars.forEach(pillarName => {
            const pillar = pillars.find((p: any) => p.pillar_name === pillarName);
            if (pillar) {
              const allocated = pillar.allocated_hours;
              const spent = pillar.spent_hours;
              const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
              dayData[`pillar_${pillarName}`] = utilization;
              dayData[`pillar_${pillarName}_hours`] = spent;
            }
          });
          dailyData.push(dayData);
        }
        setPillarTrendData(dailyData);
      }
    } catch (error) {
      console.error('Error loading detailed trend data:', error);
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
      start = formatDateForInput(today);
      end = formatDateForInput(today);
    } else if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      start = formatDateForInput(weekAgo);
      end = formatDateForInput(today);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      start = formatDateForInput(monthAgo);
      end = formatDateForInput(today);
    } else if (dateRange === '4weeks') {
      const fourWeeksAgo = new Date(today);
      fourWeeksAgo.setDate(today.getDate() - 28);
      start = formatDateForInput(fourWeeksAgo);
      end = formatDateForInput(today);
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
            onClick={() => {
              setViewMode('overview');
              const params = new URLSearchParams(window.location.search);
              params.set('view', 'overview');
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }}
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
            onClick={() => {
              setViewMode('detailed');
              const params = new URLSearchParams(window.location.search);
              params.set('view', 'detailed');
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }}
          >
            📅 Detailed View
          </button>
          <button 
            className={`tab-button ${viewMode === 'categories' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('categories');
              const params = new URLSearchParams(window.location.search);
              params.set('view', 'categories');
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }}
          >
            📁 Categories
          </button>
          <button 
            className={`tab-button ${viewMode === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('tasks');
              const params = new URLSearchParams(window.location.search);
              params.set('view', 'tasks');
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }}
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
                      const orderA = getPillarOrder(a.name);
                      const orderB = getPillarOrder(b.name);
                      return orderA - orderB;
                    });
                  })()}
                  barSize={35}
                  margin={{ top: 40, right: 30, left: 20, bottom: 5 }}
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
                    label={{ position: 'top', fill: '#666', fontSize: 12, fontWeight: 600, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  <Bar 
                    dataKey="today" 
                    name="Today (Actual)" 
                    fill="#4299e1" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#333', fontWeight: 700, fontSize: 12, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                  />
                  {showPillarWeek && (
                    <Bar 
                      dataKey="weekly" 
                      name="Weekly Avg (Actual)" 
                      fill="#48bb78" 
                      radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 700, fontSize: 12, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
                    />
                  )}
                  {showMonthColumn && (
                    <Bar 
                      dataKey="monthly" 
                      name="Monthly Avg (Actual)" 
                      fill="#ed8936" 
                      radius={[6, 6, 0, 0]}
                      label={{ position: 'top', fill: '#333', fontWeight: 700, fontSize: 12, formatter: (value: number) => value > 0 ? `${value.toFixed(1)}h` : '' }}
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
                <h2>📊 Time Utilization: Daily Tasks</h2>
                <p className="chart-description">Today / weekly avg / monthly avg — toggle between % and hours</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowUtilizationAsHours(!showUtilizationAsHours)}
                  style={{ fontSize: '11px', padding: '6px 10px', background: showUtilizationAsHours ? '#48bb78' : '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {showUtilizationAsHours ? '⏱️ Hours' : '📊 %'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationTaskWeek ? 'active' : ''}`}
                  onClick={() => setShowUtilizationTaskWeek(!showUtilizationTaskWeek)}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {showUtilizationTaskWeek ? 'Hide Weekly' : 'Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationTaskMonth ? 'active' : ''}`}
                  onClick={() => setShowUtilizationTaskMonth(!showUtilizationTaskMonth)}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {showUtilizationTaskMonth ? 'Hide Monthly' : 'Show Monthly'}
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
                        
                        const todayVal = showUtilizationAsHours ? todaySpent : (allocated > 0 ? Math.min((todaySpent / allocated) * 100, 100) : 0);
                        const todayOT = showUtilizationAsHours ? 0 : (allocated > 0 ? Math.max((todaySpent / allocated) * 100 - 100, 0) : 0);
                        const weeklyVal = showUtilizationAsHours ? weeklyAvg : (allocated > 0 ? Math.min((weeklyAvg / allocated) * 100, 100) : 0);
                        const weeklyOT = showUtilizationAsHours ? 0 : (allocated > 0 ? Math.max((weeklyAvg / allocated) * 100 - 100, 0) : 0);
                        const monthlyVal = showUtilizationAsHours ? monthlyAvg : (allocated > 0 ? Math.min((monthlyAvg / allocated) * 100, 100) : 0);
                        const monthlyOT = showUtilizationAsHours ? 0 : (allocated > 0 ? Math.max((monthlyAvg / allocated) * 100 - 100, 0) : 0);
                        
                        return {
                          name: task.task_name,
                          category: task.category_name,
                          today: todayVal,
                          todayOvertime: todayOT,
                          weekly: weeklyVal,
                          weeklyOvertime: weeklyOT,
                          monthly: monthlyVal,
                          monthlyOvertime: monthlyOT,
                          hasData: allocated > 0 || todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                        };
                      })
                      .filter(task => task.hasData)
                      .sort((a, b) => {
                        // Sort by Daily tab order: category first
                        const categoryOrderA = getCategoryOrder(a.category);
                        const categoryOrderB = getCategoryOrder(b.category);
                        
                        if (categoryOrderA !== categoryOrderB) {
                          return categoryOrderA - categoryOrderB;
                        }
                        
                        // Within same category, sort by task name order
                        const taskOrderA = getTaskOrder(a.name);
                        const taskOrderB = getTaskOrder(b.name);
                        
                        if (taskOrderA !== taskOrderB) {
                          return taskOrderA - taskOrderB;
                        }
                        
                        return a.name.localeCompare(b.name);
                      })
                      .slice(0, 20); // Show top 20 tasks
                  })()}
                  barSize={15}
                  margin={{ top: 80, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    height={60}
                    interval={0}
                    tick={<CustomMultilineLabel />}
                  />
                  <YAxis 
                    label={{ value: showUtilizationAsHours ? 'Hours' : 'Utilization %', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  {!showUtilizationAsHours && <ReferenceLine y={100} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" />}
                  <Bar 
                    dataKey="today" 
                    name={showUtilizationAsHours ? 'Today h' : 'Today %'} 
                    stackId="today"
                    fill="#4299e1" 
                    radius={[0, 0, 0, 0]}
                  >
                    <LabelList 
                      dataKey="today"
                      position="top"
                      content={(props: any) => {
                        const { x, y, width, value } = props;
                        if (!value || value === 0) return null;
                        return (
                          <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                            {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  {!showUtilizationAsHours && (
                    <Bar 
                      dataKey="todayOvertime" 
                      name="Today OT" 
                      stackId="today"
                      fill="#dc2626" 
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="todayOvertime"
                        position="top"
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (!value || value === 0) return null;
                          return (
                            <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                              {`${value.toFixed(0)}%`}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  )}
                  {showUtilizationTaskWeek && (
                    <>
                      <Bar 
                        dataKey="weekly" 
                        name={showUtilizationAsHours ? 'Weekly Avg h' : 'Weekly Avg %'} 
                        stackId="weekly"
                        fill="#48bb78" 
                        radius={[0, 0, 0, 0]}
                      >
                        <LabelList 
                          dataKey="weekly"
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value === 0) return null;
                            return (
                              <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      {!showUtilizationAsHours && (
                        <Bar 
                          dataKey="weeklyOvertime" 
                          name="Weekly OT" 
                          stackId="weekly"
                          fill="#dc2626" 
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey="weeklyOvertime"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                  {`${value.toFixed(0)}%`}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      )}
                    </>
                  )}
                  {showUtilizationTaskMonth && (
                    <>
                      <Bar 
                        dataKey="monthly" 
                        name={showUtilizationAsHours ? 'Monthly Avg h' : 'Monthly Avg %'} 
                        stackId="monthly"
                        fill="#ed8936" 
                        radius={[0, 0, 0, 0]}
                      >
                        <LabelList 
                          dataKey="monthly"
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value === 0) return null;
                            return (
                              <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      {!showUtilizationAsHours && (
                        <Bar 
                          dataKey="monthlyOvertime" 
                          name="Monthly OT" 
                          stackId="monthly"
                          fill="#dc2626" 
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey="monthlyOvertime"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                  {`${value.toFixed(0)}%`}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      )}
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
                <h2>📊 Time Utilization: Daily Categories</h2>
                <p className="chart-description">Today / weekly avg / monthly avg — toggle between % and hours</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowUtilizationAsHours(!showUtilizationAsHours)}
                  style={{ fontSize: '11px', padding: '6px 10px', background: showUtilizationAsHours ? '#48bb78' : '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {showUtilizationAsHours ? '⏱️ Hours' : '📊 %'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationCategoryWeek ? 'active' : ''}`}
                  onClick={() => setShowUtilizationCategoryWeek(!showUtilizationCategoryWeek)}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {showUtilizationCategoryWeek ? 'Hide Weekly' : 'Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationCategoryMonth ? 'active' : ''}`}
                  onClick={() => setShowUtilizationCategoryMonth(!showUtilizationCategoryMonth)}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {showUtilizationCategoryMonth ? 'Hide Monthly' : 'Show Monthly'}
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
                        
                        const todayVal = showUtilizationAsHours ? cat.todaySpent : (cat.allocated > 0 ? Math.min((cat.todaySpent / cat.allocated) * 100, 100) : 0);
                        const todayOT = showUtilizationAsHours ? 0 : (cat.allocated > 0 ? Math.max((cat.todaySpent / cat.allocated) * 100 - 100, 0) : 0);
                        const weeklyVal = showUtilizationAsHours ? weeklyAvg : (cat.allocated > 0 ? Math.min((weeklyAvg / cat.allocated) * 100, 100) : 0);
                        const weeklyOT = showUtilizationAsHours ? 0 : (cat.allocated > 0 ? Math.max((weeklyAvg / cat.allocated) * 100 - 100, 0) : 0);
                        const monthlyVal = showUtilizationAsHours ? monthlyAvg : (cat.allocated > 0 ? Math.min((monthlyAvg / cat.allocated) * 100, 100) : 0);
                        const monthlyOT = showUtilizationAsHours ? 0 : (cat.allocated > 0 ? Math.max((monthlyAvg / cat.allocated) * 100 - 100, 0) : 0);
                        
                        return {
                          name: cat.category_name,
                          today: todayVal,
                          todayOvertime: todayOT,
                          weekly: weeklyVal,
                          weeklyOvertime: weeklyOT,
                          monthly: monthlyVal,
                          monthlyOvertime: monthlyOT,
                          hasData: cat.allocated > 0 || cat.todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                        };
                      })
                      .filter(cat => cat.hasData)
                      .sort((a, b) => {
                        // Sort by Daily tab category order
                        const categoryOrderA = getCategoryOrder(a.name);
                        const categoryOrderB = getCategoryOrder(b.name);
                        return categoryOrderA - categoryOrderB;
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
                    label={{ value: showUtilizationAsHours ? 'Hours' : 'Utilization %', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  {!showUtilizationAsHours && <ReferenceLine y={100} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" />}
                  <Bar 
                    dataKey="today" 
                    name={showUtilizationAsHours ? 'Today h' : 'Today %'} 
                    stackId="today"
                    fill="#4299e1" 
                    radius={[0, 0, 0, 0]}
                  >
                    <LabelList 
                      dataKey="today"
                      position="top"
                      content={(props: any) => {
                        const { x, y, width, value } = props;
                        if (!value || value === 0) return null;
                        return (
                          <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                            {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  {!showUtilizationAsHours && (
                    <Bar 
                      dataKey="todayOvertime" 
                      name="Today OT" 
                      stackId="today"
                      fill="#dc2626" 
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="todayOvertime"
                        position="top"
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (!value || value === 0) return null;
                          return (
                            <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                              {`${value.toFixed(0)}%`}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  )}
                  {showUtilizationCategoryWeek && (
                    <>
                      <Bar 
                        dataKey="weekly" 
                        name={showUtilizationAsHours ? 'Weekly Avg h' : 'Weekly Avg %'} 
                        stackId="weekly"
                        fill="#48bb78" 
                        radius={[0, 0, 0, 0]}
                      >
                        <LabelList 
                          dataKey="weekly"
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value === 0) return null;
                            return (
                              <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      {!showUtilizationAsHours && (
                        <Bar 
                          dataKey="weeklyOvertime" 
                          name="Weekly OT" 
                          stackId="weekly"
                          fill="#dc2626" 
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey="weeklyOvertime"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                  {`${value.toFixed(0)}%`}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      )}
                    </>
                  )}
                  {showUtilizationCategoryMonth && (
                    <>
                      <Bar 
                        dataKey="monthly" 
                        name={showUtilizationAsHours ? 'Monthly Avg h' : 'Monthly Avg %'} 
                        stackId="monthly"
                        fill="#ed8936" 
                        radius={[0, 0, 0, 0]}
                      >
                        <LabelList 
                          dataKey="monthly"
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value === 0) return null;
                            return (
                              <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      {!showUtilizationAsHours && (
                        <Bar 
                          dataKey="monthlyOvertime" 
                          name="Monthly OT" 
                          stackId="monthly"
                          fill="#dc2626" 
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey="monthlyOvertime"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                  {`${value.toFixed(0)}%`}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      )}
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
                <h2>📊 Time Utilization: Daily: One-Time Tasks</h2>
                <p className="chart-description">Today / weekly avg / monthly avg — toggle between % and hours</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowUtilizationAsHours(!showUtilizationAsHours)}
                  style={{ fontSize: '11px', padding: '6px 10px', background: showUtilizationAsHours ? '#48bb78' : '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {showUtilizationAsHours ? '⏱️ Hours' : '📊 %'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationOneTimeWeek ? 'active' : ''}`}
                  onClick={() => setShowUtilizationOneTimeWeek(!showUtilizationOneTimeWeek)}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {showUtilizationOneTimeWeek ? 'Hide Weekly' : 'Show Weekly'}
                </button>
                <button 
                  className={`toggle-month-btn ${showUtilizationOneTimeMonth ? 'active' : ''}`}
                  onClick={() => setShowUtilizationOneTimeMonth(!showUtilizationOneTimeMonth)}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {showUtilizationOneTimeMonth ? 'Hide Monthly' : 'Show Monthly'}
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
                        
                        const todayVal = showUtilizationAsHours ? todaySpent : (allocated > 0 ? Math.min((todaySpent / allocated) * 100, 100) : 0);
                        const todayOT = showUtilizationAsHours ? 0 : (allocated > 0 ? Math.max((todaySpent / allocated) * 100 - 100, 0) : 0);
                        const weeklyVal = showUtilizationAsHours ? weeklyAvg : (allocated > 0 ? Math.min((weeklyAvg / allocated) * 100, 100) : 0);
                        const weeklyOT = showUtilizationAsHours ? 0 : (allocated > 0 ? Math.max((weeklyAvg / allocated) * 100 - 100, 0) : 0);
                        const monthlyVal = showUtilizationAsHours ? monthlyAvg : (allocated > 0 ? Math.min((monthlyAvg / allocated) * 100, 100) : 0);
                        const monthlyOT = showUtilizationAsHours ? 0 : (allocated > 0 ? Math.max((monthlyAvg / allocated) * 100 - 100, 0) : 0);
                        
                        return {
                          name: task.task_name,
                          category: task.category_name,
                          today: todayVal,
                          todayOvertime: todayOT,
                          weekly: weeklyVal,
                          weeklyOvertime: weeklyOT,
                          monthly: monthlyVal,
                          monthlyOvertime: monthlyOT,
                          hasData: allocated > 0 || todaySpent > 0 || weeklyAvg > 0 || monthlyAvg > 0
                        };
                      })
                      .filter(task => task.hasData)
                      .sort((a, b) => {
                        // Sort by Daily tab order: category first
                        const categoryOrderA = getCategoryOrder(a.category);
                        const categoryOrderB = getCategoryOrder(b.category);
                        
                        if (categoryOrderA !== categoryOrderB) {
                          return categoryOrderA - categoryOrderB;
                        }
                        
                        // Within same category, sort by task name order
                        const taskOrderA = getTaskOrder(a.name);
                        const taskOrderB = getTaskOrder(b.name);
                        
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
                    label={{ value: showUtilizationAsHours ? 'Hours' : 'Utilization %', angle: -90, position: 'insideLeft' }} 
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="rect"
                  />
                  {!showUtilizationAsHours && <ReferenceLine y={100} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" />}
                  <Bar 
                    dataKey="today" 
                    name={showUtilizationAsHours ? 'Today h' : 'Today %'} 
                    stackId="today"
                    fill="#4299e1" 
                    radius={[0, 0, 0, 0]}
                  >
                    <LabelList 
                      dataKey="today"
                      position="top"
                      content={(props: any) => {
                        const { x, y, width, value } = props;
                        if (!value || value === 0) return null;
                        return (
                          <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                            {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  {!showUtilizationAsHours && (
                    <Bar 
                      dataKey="todayOvertime" 
                      name="Today OT" 
                      stackId="today"
                      fill="#dc2626" 
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="todayOvertime"
                        position="top"
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (!value || value === 0) return null;
                          return (
                            <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                              {`${value.toFixed(0)}%`}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  )}
                  {showUtilizationOneTimeWeek && (
                    <>
                      <Bar 
                        dataKey="weekly" 
                        name={showUtilizationAsHours ? 'Weekly Avg h' : 'Weekly Avg %'} 
                        stackId="weekly"
                        fill="#48bb78" 
                        radius={[0, 0, 0, 0]}
                      >
                        <LabelList 
                          dataKey="weekly"
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value === 0) return null;
                            return (
                              <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      {!showUtilizationAsHours && (
                        <Bar 
                          dataKey="weeklyOvertime" 
                          name="Weekly OT" 
                          stackId="weekly"
                          fill="#dc2626" 
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey="weeklyOvertime"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                  {`${value.toFixed(0)}%`}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      )}
                    </>
                  )}
                  {showUtilizationOneTimeMonth && (
                    <>
                      <Bar 
                        dataKey="monthly" 
                        name={showUtilizationAsHours ? 'Monthly Avg h' : 'Monthly Avg %'} 
                        stackId="monthly"
                        fill="#ed8936" 
                        radius={[0, 0, 0, 0]}
                      >
                        <LabelList 
                          dataKey="monthly"
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value === 0) return null;
                            return (
                              <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                {showUtilizationAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(0)}%`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      {!showUtilizationAsHours && (
                        <Bar 
                          dataKey="monthlyOvertime" 
                          name="Monthly OT" 
                          stackId="monthly"
                          fill="#dc2626" 
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey="monthlyOvertime"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" fontSize="10" fontWeight="bold">
                                  {`${value.toFixed(0)}%`}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      )}
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
                          sortOrder: getCategoryOrder(category.category_name)
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
                        const categoryOrderA = getCategoryOrder(a.category);
                        const categoryOrderB = getCategoryOrder(b.category);
                        
                        // Compare categories first
                        if (categoryOrderA !== categoryOrderB) {
                          return (categoryOrderA === -1 ? 999 : categoryOrderA) - (categoryOrderB === -1 ? 999 : categoryOrderB);
                        }
                        
                        // Within same category, sort by task name order, or alphabetically if not in list
                        const taskOrderA = getTaskOrder(a.name);
                        const taskOrderB = getTaskOrder(b.name);
                        
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
                  className={`toggle-month-btn ${showCategoryBreakdownWeekAll ? 'active' : ''}`}
                  onClick={() => setShowCategoryBreakdownWeekAll(!showCategoryBreakdownWeekAll)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showCategoryBreakdownWeekAll ? '📊 Hide Weekly' : '📊 Show Weekly'}
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
                const orderA = getPillarOrder(a.pillar_name);
                const orderB = getPillarOrder(b.pillar_name);
                return orderA - orderB;
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
                    const orderA = getCategoryOrder(a.category_name);
                    const orderB = getCategoryOrder(b.category_name);
                    return orderA - orderB;
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
                  className={`toggle-month-btn ${showTaskBreakdownWeekAll ? 'active' : ''}`}
                  onClick={() => setShowTaskBreakdownWeekAll(!showTaskBreakdownWeekAll)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {showTaskBreakdownWeekAll ? '📊 Hide Weekly' : '📊 Show Weekly'}
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

          {/* ── TASK REGISTRY ─────────────────────────────────────────── */}
          <div className="task-registry-section">
            <div className="registry-header">
              <div>
                <h2 className="registry-title">📋 Task Registry</h2>
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>
                  Every task you've ever created — your complete history of intentions and actions.
                </p>
              </div>
              <button
                onClick={loadTaskRegistry}
                style={{ padding: '6px 14px', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                🔄 Refresh
              </button>
            </div>

            {/* Filter buttons */}
            <div className="registry-filters">
              {([
                { key: 'all', label: '📂 All Tasks' },
                { key: 'in_progress', label: '🟡 In Progress' },
                { key: 'completed', label: '✅ Completed' },
                { key: 'inactive', label: '🗑️ Inactive / Deleted' },
              ] as { key: typeof registryFilter; label: string }[]).map(f => (
                <button
                  key={f.key}
                  className={`registry-filter-btn ${registryFilter === f.key ? 'active' : ''}`}
                  onClick={() => setRegistryFilter(f.key)}
                >
                  {f.label}
                  <span className="registry-filter-count">
                    {f.key === 'all' ? registryTasks.length
                      : f.key === 'in_progress' ? registryTasks.filter(t => t.is_active && !t.is_completed).length
                      : f.key === 'completed' ? registryTasks.filter(t => t.is_completed).length
                      : registryTasks.filter(t => !t.is_active).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="🔍 Search tasks by name, category, pillar…"
                value={registrySearch}
                onChange={e => setRegistrySearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Pillar / Category breakdown */}
            {!registryLoading && registryTasks.length > 0 && (() => {
              const PILLAR_COLORS: Record<string, { bg: string; border: string; text: string; cat: string }> = {
                'Hard Work': { bg: '#ebf4ff', border: '#4299e1', text: '#2b6cb0', cat: '#bee3f8' },
                'Calmness':  { bg: '#f0fff4', border: '#48bb78', text: '#276749', cat: '#c6f6d5' },
                'Family':    { bg: '#faf5ff', border: '#9f7aea', text: '#553c9a', cat: '#e9d8fd' },
              };
              const DEFAULT_COLOR = { bg: '#f7f8fa', border: '#a0aec0', text: '#4a5568', cat: '#e2e8f0' };

              // Group tasks by pillar → category
              const pillarMap: Record<string, Record<string, number>> = {};
              registryTasks.forEach((t: any) => {
                const p = t.pillar_name || 'Unknown';
                const c = t.category_name || 'Unknown';
                if (!pillarMap[p]) pillarMap[p] = {};
                pillarMap[p][c] = (pillarMap[p][c] || 0) + 1;
              });

              return (
                <div className="registry-breakdown">
                  {Object.entries(pillarMap).map(([pillar, cats]) => {
                    const col = PILLAR_COLORS[pillar] || DEFAULT_COLOR;
                    const total = Object.values(cats).reduce((s, n) => s + n, 0);
                    return (
                      <div key={pillar} className="registry-breakdown-pillar" style={{ background: col.bg, borderColor: col.border }}>
                        <div className="registry-breakdown-pillar-title" style={{ color: col.text }}>
                          {pillar} <span className="registry-breakdown-total">{total}</span>
                        </div>
                        <div className="registry-breakdown-cats">
                          {Object.entries(cats)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, count]) => (
                              <span key={cat} className="registry-breakdown-cat" style={{ background: col.cat, color: col.text }}>
                                {cat} · {count}
                              </span>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {registryLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading task registry…</div>
            ) : (() => {
              const today = new Date();
              const goalMap = Object.fromEntries(registryGoals.map((g: any) => [g.id, g.name || g.title]));
              const projectMap = Object.fromEntries(registryProjects.map((p: any) => [p.id, p.name || p.title]));
              const wishMap = Object.fromEntries(registryWishes.map((w: any) => [w.id, w.title || w.name]));

              const filtered = registryTasks
                .filter(t => {
                  if (registryFilter === 'in_progress') return t.is_active && !t.is_completed;
                  if (registryFilter === 'completed') return t.is_completed;
                  if (registryFilter === 'inactive') return !t.is_active;
                  return true; // all
                })
                .filter(t => {
                  if (!registrySearch.trim()) return true;
                  const q = registrySearch.toLowerCase();
                  return (
                    (t.name || '').toLowerCase().includes(q) ||
                    (t.category_name || '').toLowerCase().includes(q) ||
                    (t.pillar_name || '').toLowerCase().includes(q) ||
                    (t.follow_up_frequency || '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              const getRowClass = (t: any) => {
                if (t.is_completed) return 'registry-row-completed';
                if (!t.is_active) return 'registry-row-inactive';
                return 'registry-row-inprogress';
              };

              const getStatusBadge = (t: any) => {
                if (t.is_completed) return <span className="registry-badge badge-completed">✅ Completed</span>;
                if (!t.is_active) return <span className="registry-badge badge-inactive">🗑️ Inactive</span>;
                return <span className="registry-badge badge-inprogress">🔄 In Progress</span>;
              };

              const getDayCount = (t: any) => {
                const created = new Date(t.created_at);
                const end = t.is_completed && t.completed_at ? new Date(t.completed_at) : today;
                return Math.max(0, Math.floor((end.getTime() - created.getTime()) / 86400000));
              };

              const getDayLabel = (t: any) => {
                const days = getDayCount(t);
                if (t.is_completed) return `${days}d to complete`;
                if (!t.is_active) return `${days}d active`;
                return `${days}d running`;
              };

              const getLinkedItem = (t: any) => {
                if (t.goal_id && goalMap[t.goal_id]) return `🎯 ${goalMap[t.goal_id]}`;
                if (t.project_id && projectMap[t.project_id]) return `📁 ${projectMap[t.project_id]}`;
                if (t.related_wish_id && wishMap[t.related_wish_id]) return `💫 ${wishMap[t.related_wish_id]}`;
                return <span style={{ color: '#aaa' }}>—</span>;
              };

              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>No tasks found for this filter.</div>;
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table className="registry-table">
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>Task Name</th>
                        <th>Pillar / Category</th>
                        <th>Goal / Project / Dream</th>
                        <th>Due Date</th>
                        <th>Days</th>
                        <th>Frequency</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t => (
                        <tr key={t.id} className={getRowClass(t)}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                            {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ fontWeight: 500, minWidth: '160px' }}>
                            {!t.is_active ? <span style={{ textDecoration: 'line-through', color: '#999' }}>{t.name}</span> : t.name}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{t.pillar_name || '—'}</div>
                            <div style={{ color: '#666' }}>{t.category_name || ''}</div>
                          </td>
                          <td style={{ fontSize: '12px' }}>{getLinkedItem(t)}</td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                            {t.due_date
                              ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : <span style={{ color: '#aaa' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '12px', textAlign: 'center' }}>
                            <span title={getDayLabel(t)}>{getDayCount(t)}d</span>
                          </td>
                          <td style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                            {(t.follow_up_frequency || '').replace('_', ' ')}
                          </td>
                          <td>{getStatusBadge(t)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#888', textAlign: 'right' }}>
                    Showing {filtered.length} of {registryTasks.length} tasks
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── DAILY BREAKDOWN (existing) ─────────────────────────────── */}
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

      {/* DETAILED VIEW: Task/Category/Pillar Trend Analysis */}
      {viewMode === 'detailed' && (
        <div className="detailed-view-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h2 style={{ margin: 0 }}>📊 Detailed Trend Analysis</h2>
            <button
              onClick={() => setShowAsHours(!showAsHours)}
              style={{ fontSize: '11px', padding: '6px 12px', background: showAsHours ? '#48bb78' : '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              {showAsHours ? '⏱️ Hours' : '📊 %'}
            </button>
          </div>
          <p className="chart-description">Select tasks, categories, or pillars to view their utilization trends over time</p>
          
          {/* View Type Selector */}
          <div className="detailed-controls" style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className={`tab-button ${detailedViewType === 'tasks' ? 'active' : ''}`}
                onClick={() => {
                  setDetailedViewType('tasks');
                  setSelectedTasks([]);
                  setSelectedCategories([]);
                  setSelectedPillars([]);
                  const params = new URLSearchParams(window.location.search);
                  params.set('detailView', 'tasks');
                  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              >
                ✓ Tasks
              </button>
              <button 
                className={`tab-button ${detailedViewType === 'categories' ? 'active' : ''}`}
                onClick={() => {
                  setDetailedViewType('categories');
                  setSelectedTasks([]);
                  setSelectedCategories([]);
                  setSelectedPillars([]);
                  const params = new URLSearchParams(window.location.search);
                  params.set('detailView', 'categories');
                  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              >
                📁 Categories
              </button>
              <button 
                className={`tab-button ${detailedViewType === 'pillars' ? 'active' : ''}`}
                onClick={() => {
                  setDetailedViewType('pillars');
                  setSelectedTasks([]);
                  setSelectedCategories([]);
                  setSelectedPillars([]);
                  const params = new URLSearchParams(window.location.search);
                  params.set('detailView', 'pillars');
                  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              >
                🎯 Pillars
              </button>
              <button
                className={`tab-button ${detailedViewType === 'circle_of_life' ? 'active' : ''}`}
                onClick={() => {
                  setDetailedViewType('circle_of_life');
                  setSelectedTasks([]);
                  setSelectedCategories([]);
                  setSelectedPillars([]);
                  const params = new URLSearchParams(window.location.search);
                  params.set('detailView', 'circle_of_life');
                  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              >
                ⭕ Circle of Life
              </button>
            </div>
          </div>

          {/* Task Selection */}
          {detailedViewType === 'tasks' && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f7fafc', borderRadius: '8px' }}>
              <label style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
                Select Tasks (up to 3) - Time-Based & One-Time Tasks:
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[...allTasksData, ...allOneTimeTasksData]
                  .sort((a, b) => {
                    // Sort by Daily tab order: category first (which groups by pillar), then task name
                    const categoryOrderA = getCategoryOrder(a.category_name);
                    const categoryOrderB = getCategoryOrder(b.category_name);
                    
                    if (categoryOrderA !== categoryOrderB) {
                      return categoryOrderA - categoryOrderB;
                    }
                    
                    // Within same category, sort by task name order
                    const taskOrderA = getTaskOrder(a.task_name);
                    const taskOrderB = getTaskOrder(b.task_name);
                    
                    if (taskOrderA !== taskOrderB) {
                      return taskOrderA - taskOrderB;
                    }
                    
                    return a.task_name.localeCompare(b.task_name);
                  })
                  .slice(0, 50).map(task => (
                  <label key={task.task_id} style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    background: selectedTasks.includes(task.task_id) ? '#4299e1' : 'white',
                    color: selectedTasks.includes(task.task_id) ? 'white' : '#2d3748',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: '1px solid #cbd5e0'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.task_id)}
                      onChange={(e) => {
                        if (e.target.checked && selectedTasks.length < 3) {
                          setSelectedTasks([...selectedTasks, task.task_id]);
                        } else if (!e.target.checked) {
                          setSelectedTasks(selectedTasks.filter(id => id !== task.task_id));
                        }
                      }}
                      disabled={!selectedTasks.includes(task.task_id) && selectedTasks.length >= 3}
                      style={{ marginRight: '8px' }}
                    />
                    {task.task_name}
                  </label>
                ))}
              </div>
              {selectedTasks.length === 3 && (
                <p style={{ marginTop: '10px', color: '#ed8936', fontSize: '14px' }}>
                  Maximum of 3 tasks selected. Uncheck one to select another.
                </p>
              )}
            </div>
          )}

          {/* Category Selection */}
          {detailedViewType === 'categories' && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f7fafc', borderRadius: '8px' }}>
              <label style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
                Select Categories (up to 3):
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {allCategoriesData.map(category => (
                  <label key={category.category_name} style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    background: selectedCategories.includes(category.category_name) ? '#48bb78' : 'white',
                    color: selectedCategories.includes(category.category_name) ? 'white' : '#2d3748',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: '1px solid #cbd5e0'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.category_name)}
                      onChange={(e) => {
                        if (e.target.checked && selectedCategories.length < 3) {
                          setSelectedCategories([...selectedCategories, category.category_name]);
                        } else if (!e.target.checked) {
                          setSelectedCategories(selectedCategories.filter(name => name !== category.category_name));
                        }
                      }}
                      disabled={!selectedCategories.includes(category.category_name) && selectedCategories.length >= 3}
                      style={{ marginRight: '8px' }}
                    />
                    {category.category_name}
                  </label>
                ))}
              </div>
              {selectedCategories.length === 3 && (
                <p style={{ marginTop: '10px', color: '#ed8936', fontSize: '14px' }}>
                  Maximum of 3 categories selected. Uncheck one to select another.
                </p>
              )}
            </div>
          )}

          {/* Pillar Selection */}
          {detailedViewType === 'pillars' && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f7fafc', borderRadius: '8px' }}>
              <label style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
                Select Pillars (up to 3):
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {dailyPillarData.map(pillar => (
                  <label key={pillar.pillar_name} style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    background: selectedPillars.includes(pillar.pillar_name) ? pillar.color_code : 'white',
                    color: selectedPillars.includes(pillar.pillar_name) ? 'white' : '#2d3748',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: '1px solid #cbd5e0'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedPillars.includes(pillar.pillar_name)}
                      onChange={(e) => {
                        if (e.target.checked && selectedPillars.length < 3) {
                          setSelectedPillars([...selectedPillars, pillar.pillar_name]);
                        } else if (!e.target.checked) {
                          setSelectedPillars(selectedPillars.filter(name => name !== pillar.pillar_name));
                        }
                      }}
                      disabled={!selectedPillars.includes(pillar.pillar_name) && selectedPillars.length >= 3}
                      style={{ marginRight: '8px' }}
                    />
                    {pillar.pillar_name}
                  </label>
                ))}
              </div>
              {selectedPillars.length === 3 && (
                <p style={{ marginTop: '10px', color: '#ed8936', fontSize: '14px' }}>
                  Maximum of 3 pillars selected. Uncheck one to select another.
                </p>
              )}
            </div>
          )}

          {/* Show charts only if something is selected */}
          {((detailedViewType === 'tasks' && selectedTasks.length > 0) ||
            (detailedViewType === 'categories' && selectedCategories.length > 0) ||
            (detailedViewType === 'pillars' && selectedPillars.length > 0)) && (
            <div>
              <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  className={`toggle-month-btn ${showWeekOverWeek ? 'active' : ''}`}
                  onClick={() => setShowWeekOverWeek(!showWeekOverWeek)}
                >
                  {showWeekOverWeek ? '✓' : '✗'} Show Week-over-Week
                </button>
                <button 
                  className={`toggle-month-btn ${showMonthOverMonth ? 'active' : ''}`}
                  onClick={() => setShowMonthOverMonth(!showMonthOverMonth)}
                >
                  {showMonthOverMonth ? '✓' : '✗'} Show Month-over-Month
                </button>
              </div>

              {/* Daily Utilization Chart */}
              <div className="comparative-charts-section" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0 }}>📅 Daily {showAsHours ? 'Hours Spent' : 'Utilization'} (Last 56 Days / 8 Weeks)</h3>
                    <button
                      onClick={() => setShowAsHours(!showAsHours)}
                      style={{ fontSize: '11px', padding: '4px 10px', background: showAsHours ? '#48bb78' : '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {showAsHours ? '⏱️ h' : '📊 %'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart 
                      data={detailedViewType === 'tasks' ? taskTrendData : 
                            detailedViewType === 'categories' ? categoryTrendData : pillarTrendData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        style={{ fontSize: '10px' }}
                      />
                      <YAxis label={{ value: showAsHours ? 'Hours' : 'Utilization %', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value: number) => showAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(1)}%`} />
                      <Legend />
                      {!showAsHours && <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" />}
                      
                      {/* Render lines for selected items */}
                      {detailedViewType === 'tasks' && selectedTasks.map((taskId, index) => {
                        const task = allTasksData.find(t => t.task_id === taskId);
                        const colors = ['#4299e1', '#48bb78', '#ed8936'];
                        const idealHours = task?.allocated_minutes ? (task.allocated_minutes / 60).toFixed(1) : '0.0';
                        const taskLabel = `${task?.task_name || `Task ${taskId}`} (Ideal: ${idealHours}h/day)`;
                        return (
                          <Line 
                            key={taskId}
                            type="monotone" 
                            dataKey={showAsHours ? `task_${taskId}_hours` : `task_${taskId}`}
                            name={taskLabel}
                            stroke={colors[index]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        );
                      })}
                      
                      {detailedViewType === 'categories' && selectedCategories.map((categoryName, index) => {
                        const colors = ['#48bb78', '#4299e1', '#ed8936'];
                        return (
                          <Line 
                            key={categoryName}
                            type="monotone" 
                            dataKey={showAsHours ? `category_${categoryName}_hours` : `category_${categoryName}`}
                            name={categoryName}
                            stroke={colors[index]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        );
                      })}
                      
                      {detailedViewType === 'pillars' && selectedPillars.map((pillarName, index) => {
                        const pillar = dailyPillarData.find(p => p.pillar_name === pillarName);
                        return (
                          <Line 
                            key={pillarName}
                            type="monotone" 
                            dataKey={showAsHours ? `pillar_${pillarName}_hours` : `pillar_${pillarName}`}
                            name={pillarName}
                            stroke={pillar?.color_code || '#4299e1'}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

              {/* Weekly Utilization Chart */}
              {showWeekOverWeek && (
                <div className="comparative-charts-section" style={{ marginTop: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    {(() => {
                      const trendLen = (detailedViewType === 'tasks' ? taskTrendData : detailedViewType === 'categories' ? categoryTrendData : pillarTrendData).length;
                      const actualWeeks = Math.ceil(trendLen / 7);
                      return <h3 style={{ margin: 0 }}>📊 Weekly Average (Last {actualWeeks} Week{actualWeeks !== 1 ? 's' : ''}) - {showAsHours ? 'Hours' : 'Utilization %'}</h3>;
                    })()}
                    <button
                      onClick={() => setShowAsHours(!showAsHours)}
                      style={{ fontSize: '11px', padding: '4px 10px', background: showAsHours ? '#48bb78' : '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {showAsHours ? '⏱️ h' : '📊 %'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                      <BarChart 
                        data={(() => {
                          const trendData = detailedViewType === 'tasks' ? taskTrendData : 
                                          detailedViewType === 'categories' ? categoryTrendData : pillarTrendData;
                          
                          // Calculate weekly averages from daily data — trendData is oldest→newest
                          const totalDays = trendData.length;
                          const numWeeks = Math.ceil(totalDays / 7);
                          const weeklyData: any[] = [];
                          for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
                            const weekStart = weekIdx * 7;
                            const weekEnd = Math.min(weekStart + 7, totalDays);
                            const weekData = trendData.slice(weekStart, weekEnd);
                            
                            if (weekData.length === 0) continue;
                            
                            // Calculate actual date range for this week
                            const today = new Date();
                            const daysFromToday = totalDays - 1 - weekStart; // how many days ago this week started
                            const weekStartDate = new Date(today);
                            weekStartDate.setDate(today.getDate() - daysFromToday);
                            const weekEndDate = new Date(weekStartDate);
                            weekEndDate.setDate(weekStartDate.getDate() + weekData.length - 1);
                            const isCurrentWeek = weekIdx === numWeeks - 1;
                            const weekLabel = isCurrentWeek
                              ? 'This Week'
                              : `${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                            
                            const weekEntry: any = { week: weekLabel };
                            
                            // Calculate average for each selected item
                            if (detailedViewType === 'tasks') {
                              selectedTasks.forEach((taskId) => {
                                const task = allTasksData.find(t => t.task_id === taskId) || allOneTimeTasksData.find(t => t.task_id === taskId);
                                const dataKey = showAsHours ? `task_${taskId}_hours` : `task_${taskId}`;
                                const values = weekData.map(d => d[dataKey] || 0).filter(v => v > 0);
                                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                                weekEntry[`task_${taskId}`] = avg;
                                weekEntry[`task_${taskId}_name`] = task?.task_name || `Task ${taskId}`;
                              });
                            } else if (detailedViewType === 'categories') {
                              selectedCategories.forEach((categoryName) => {
                                const dataKey = showAsHours ? `category_${categoryName}_hours` : `category_${categoryName}`;
                                const values = weekData.map(d => d[dataKey] || 0).filter(v => v > 0);
                                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                                weekEntry[`category_${categoryName}`] = avg;
                              });
                            } else if (detailedViewType === 'pillars') {
                              selectedPillars.forEach((pillarName) => {
                                const dataKey = showAsHours ? `pillar_${pillarName}_hours` : `pillar_${pillarName}`;
                                const values = weekData.map(d => d[dataKey] || 0).filter(v => v > 0);
                                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                                weekEntry[`pillar_${pillarName}`] = avg;
                              });
                            }
                            
                            weeklyData.push(weekEntry);
                          }
                          
                          return weeklyData;
                        })()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis label={{ value: showAsHours ? 'Avg Hours' : 'Avg Utilization %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value: number) => showAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(1)}%`} />
                        <Legend />
                        {!showAsHours && <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" />}
                        
                        {/* Render bars for selected items */}
                        {detailedViewType === 'tasks' && selectedTasks.map((taskId, index) => {
                          const task = allTasksData.find(t => t.task_id === taskId) || allOneTimeTasksData.find(t => t.task_id === taskId);
                          const colors = ['#48bb78', '#4299e1', '#ed8936'];
                          const idealHours = task?.allocated_minutes ? (task.allocated_minutes / 60).toFixed(1) : '0.0';
                          const taskLabel = `${task?.task_name || `Task ${taskId}`} (Ideal: ${idealHours}h/day)`;
                          return (
                            <Bar 
                              key={taskId}
                              dataKey={`task_${taskId}`}
                              name={taskLabel}
                              fill={colors[index]}
                              radius={[6, 6, 0, 0]}
                              label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (value: number) => value > 0 ? (showAsHours ? `${value.toFixed(1)}h` : `${value.toFixed(0)}%`) : '' }}
                            />
                          );
                        })}
                        
                        {detailedViewType === 'categories' && selectedCategories.map((categoryName, index) => {
                          const colors = ['#48bb78', '#4299e1', '#ed8936'];
                          return (
                            <Bar 
                              key={categoryName}
                              dataKey={`category_${categoryName}`}
                              name={categoryName}
                              fill={colors[index]}
                              radius={[6, 6, 0, 0]}
                              label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (value: number) => value > 0 ? (showAsHours ? `${value.toFixed(1)}h` : `${value.toFixed(0)}%`) : '' }}
                            />
                          );
                        })}
                        
                        {detailedViewType === 'pillars' && selectedPillars.map((pillarName, index) => {
                          const pillar = dailyPillarData.find(p => p.pillar_name === pillarName);
                          return (
                            <Bar 
                              key={pillarName}
                              dataKey={`pillar_${pillarName}`}
                              name={pillarName}
                              fill={pillar?.color_code || '#48bb78'}
                              radius={[6, 6, 0, 0]}
                              label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (value: number) => value > 0 ? (showAsHours ? `${value.toFixed(1)}h` : `${value.toFixed(0)}%`) : '' }}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
              )}

              {/* Monthly Utilization Chart */}
              {showMonthOverMonth && (
                <div className="comparative-charts-section" style={{ marginTop: '30px' }}>
                  <h3>📈 Monthly Average (Last 3 Months) - {showAsHours ? 'Hours' : 'Utilization %'}</h3>
                  <ResponsiveContainer width="100%" height={350}>
                      <BarChart 
                        data={(() => {
                          const trendData = detailedViewType === 'tasks' ? taskTrendData : 
                                          detailedViewType === 'categories' ? categoryTrendData : pillarTrendData;
                          
                          // Calculate monthly averages from daily data (last 3 months ~ 90 days, but we have 56 days)
                          // We'll use last 56 days and split into roughly 2 months
                          const monthlyData: any[] = [];
                          const daysPerMonth = Math.floor(trendData.length / 3); // Divide available data into 3 periods
                          
                          for (let monthIdx = 0; monthIdx < 3; monthIdx++) {
                            const monthStart = monthIdx * daysPerMonth;
                            const monthEnd = monthIdx === 2 ? trendData.length : (monthIdx + 1) * daysPerMonth;
                            const monthData = trendData.slice(monthStart, monthEnd);
                            
                            if (monthData.length === 0) continue;
                            
                            const today = new Date();
                            const monthDate = new Date(today);
                            monthDate.setMonth(today.getMonth() - (2 - monthIdx));
                            const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                            
                            const monthEntry: any = { month: monthName };
                            
                            // Calculate average for each selected item
                            if (detailedViewType === 'tasks') {
                              selectedTasks.forEach((taskId, index) => {
                                const task = allTasksData.find(t => t.task_id === taskId) || allOneTimeTasksData.find(t => t.task_id === taskId);
                                const dataKey = showAsHours ? `task_${taskId}_hours` : `task_${taskId}`;
                                const values = monthData.map(d => d[dataKey] || 0).filter(v => v > 0);
                                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                                monthEntry[`task_${taskId}`] = avg;
                                monthEntry[`task_${taskId}_name`] = task?.task_name || `Task ${taskId}`;
                              });
                            } else if (detailedViewType === 'categories') {
                              selectedCategories.forEach((categoryName) => {
                                const dataKey = showAsHours ? `category_${categoryName}_hours` : `category_${categoryName}`;
                                const values = monthData.map(d => d[dataKey] || 0).filter(v => v > 0);
                                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                                monthEntry[`category_${categoryName}`] = avg;
                              });
                            } else if (detailedViewType === 'pillars') {
                              selectedPillars.forEach((pillarName) => {
                                const dataKey = showAsHours ? `pillar_${pillarName}_hours` : `pillar_${pillarName}`;
                                const values = monthData.map(d => d[dataKey] || 0).filter(v => v > 0);
                                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                                monthEntry[`pillar_${pillarName}`] = avg;
                              });
                            }
                            
                            monthlyData.push(monthEntry);
                          }
                          
                          return monthlyData;
                        })()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis label={{ value: showAsHours ? 'Avg Hours' : 'Avg Utilization %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value: number) => showAsHours ? `${value.toFixed(2)}h` : `${value.toFixed(1)}%`} />
                        <Legend />
                        {!showAsHours && <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" />}
                        
                        {/* Render bars for selected items */}
                        {detailedViewType === 'tasks' && selectedTasks.map((taskId, index) => {
                          const task = allTasksData.find(t => t.task_id === taskId) || allOneTimeTasksData.find(t => t.task_id === taskId);
                          const colors = ['#ed8936', '#4299e1', '#9f7aea'];
                          const idealHours = task?.allocated_minutes ? (task.allocated_minutes / 60).toFixed(1) : '0.0';
                          const taskLabel = `${task?.task_name || `Task ${taskId}`} (Ideal: ${idealHours}h/day)`;
                          return (
                            <Bar 
                              key={taskId}
                              dataKey={`task_${taskId}`}
                              name={taskLabel}
                              fill={colors[index]}
                              radius={[6, 6, 0, 0]}
                              label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (value: number) => value > 0 ? (showAsHours ? `${value.toFixed(1)}h` : `${value.toFixed(0)}%`) : '' }}
                            />
                          );
                        })}
                        
                        {detailedViewType === 'categories' && selectedCategories.map((categoryName, index) => {
                          const colors = ['#ed8936', '#4299e1', '#9f7aea'];
                          return (
                            <Bar 
                              key={categoryName}
                              dataKey={`category_${categoryName}`}
                              name={categoryName}
                              fill={colors[index]}
                              radius={[6, 6, 0, 0]}
                              label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (value: number) => value > 0 ? (showAsHours ? `${value.toFixed(1)}h` : `${value.toFixed(0)}%`) : '' }}
                            />
                          );
                        })}
                        
                        {detailedViewType === 'pillars' && selectedPillars.map((pillarName, index) => {
                          const pillar = dailyPillarData.find(p => p.pillar_name === pillarName);
                          return (
                            <Bar 
                              key={pillarName}
                              dataKey={`pillar_${pillarName}`}
                              name={pillarName}
                              fill={pillar?.color_code || '#ed8936'}
                              radius={[6, 6, 0, 0]}
                              label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (value: number) => value > 0 ? (showAsHours ? `${value.toFixed(1)}h` : `${value.toFixed(0)}%`) : '' }}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {((detailedViewType === 'tasks' && selectedTasks.length === 0) ||
            (detailedViewType === 'categories' && selectedCategories.length === 0) ||
            (detailedViewType === 'pillars' && selectedPillars.length === 0)) && (
            <div style={{ 
              padding: '60px 20px', 
              textAlign: 'center', 
              background: '#f7fafc', 
              borderRadius: '8px',
              marginTop: '20px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h3 style={{ marginBottom: '8px' }}>No {detailedViewType} selected</h3>
              <p style={{ color: '#718096' }}>
                Select up to 3 {detailedViewType} above to view their utilization trends
              </p>
            </div>
          )}

          {/* Balance Visualisation removed */}
          {detailedViewType === 'balance_visualization' && false && (() => {
            const PILLAR_ORDER_LOCAL = ['Hard Work', 'Calmness', 'Family'];
            const periodOptions: { key: 'today' | 'week' | 'month'; label: string; emoji: string; color: string; data: PillarData[] }[] = [
              { key: 'today', label: 'Today', emoji: '📅', color: '#4299e1', data: dailyPillarData },
              { key: 'week', label: 'This Week', emoji: '📊', color: '#48bb78', data: weeklyPillarData },
              { key: 'month', label: 'This Month', emoji: '📈', color: '#ed8936', data: monthlyPillarData },
            ];
            // normalize daily avg %
            const getDaysElapsed = (key: 'today' | 'week' | 'month') => {
              const today = new Date();
              if (key === 'today') return 1;
              if (key === 'week') { const d = today.getDay(); return d === 0 ? 7 : d; }
              return today.getDate();
            };
            const buildRadar = (pillarData: PillarData[], key: 'today' | 'week' | 'month') => {
              const days = getDaysElapsed(key);
              const sorted = [...pillarData].sort((a, b) =>
                (PILLAR_ORDER_LOCAL.indexOf(a.pillar_name) ?? 999) - (PILLAR_ORDER_LOCAL.indexOf(b.pillar_name) ?? 999)
              );
              return sorted.map(p => ({
                pillar: p.pillar_name,
                icon: p.icon,
                color: p.color_code,
                allocated: 100,
                spent: p.allocated_hours > 0 ? Math.round((p.spent_hours / days / p.allocated_hours) * 100) : 0,
                actualAllocated: p.allocated_hours,
                actualSpent: p.allocated_hours > 0 ? (p.spent_hours / days) : 0,
              }));
            };
            const selected = periodOptions.find(o => o.key === balancePeriod) || periodOptions[0];
            const radarData = buildRadar(selected.data, selected.key);
            const maxPct = Math.max(...radarData.map(d => d.spent), 100);
            const dynMax = Math.max(100, Math.ceil(maxPct / 50) * 50);
            return (
              <div>
                {/* Period selector */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#374151', fontSize: '14px' }}>Period:</span>
                  {periodOptions.map(opt => (
                    <button key={opt.key} onClick={() => setBalancePeriod(opt.key)}
                      style={{ padding: '8px 18px', borderRadius: '8px', border: `2px solid ${balancePeriod === opt.key ? opt.color : '#e2e8f0'}`, background: balancePeriod === opt.key ? opt.color : 'white', color: balancePeriod === opt.key ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
                {/* Single radar + table */}
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '0 0 340px', background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `2px solid ${selected.color}` }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '8px', color: selected.color }}>{selected.emoji} {selected.label} — Pillar Balance</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid gridType="circle" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 12, fontWeight: 600, fill: '#2b6cb0' }} />
                        <PolarRadiusAxis angle={90} domain={[0, dynMax]} tickCount={Math.floor(dynMax / 50) + 1}
                          tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#f97316', fontWeight: 600 }} />
                        <Radar name="Actual % Achieved" dataKey="spent" stroke={selected.color} fill={selected.color} fillOpacity={0.5} strokeWidth={2} />
                        <Radar dataKey="allocated" legendType="none" dot={false} isAnimationActive={false} shape={(props: any) => { const {cx,cy,points}=props; if(!points||!points.length) return <g/>; const r=Math.sqrt(Math.pow(points[0].x-(cx||0),2)+Math.pow(points[0].y-(cy||0),2)); if(r<=0) return <g/>; return <circle cx={cx} cy={cy} r={r} fill="none" stroke="#16a34a" strokeWidth={4} strokeDasharray="10 5" />; }} />
                        <Tooltip formatter={(value: any, name: string, props: any) => {
                          if (name === 'Actual % Achieved') return [`${props.payload.actualSpent?.toFixed(1)}h (${value}%)`, name];
                          return [`${value}%`, name];
                        }} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Breakdown table */}
                  <div style={{ flex: '1 1 260px', background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: '#374151' }}>📋 Breakdown</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f0f4ff' }}>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #c7d2fe' }}>Pillar</th>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #c7d2fe' }}>Allocated</th>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #c7d2fe' }}>Spent/day</th>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #c7d2fe' }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {radarData.map(row => {
                          const pct = row.actualAllocated > 0 ? Math.round((row.actualSpent / row.actualAllocated) * 100) : 0;
                          return (
                            <tr key={row.pillar} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontWeight: '600', color: row.color || '#374151' }}>{row.icon} {row.pillar}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{row.actualAllocated?.toFixed(1)}h</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{row.actualSpent?.toFixed(1)}h</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#b45309' : '#dc2626', background: pct >= 80 ? '#d1fae5' : pct >= 60 ? '#fef3c7' : '#fee2e2', borderRadius: '4px' }}>{pct}%</td>
                            </tr>
                          );
                        })}
                        <tr style={{ borderTop: '2px solid #cbd5e0', fontWeight: '700', background: '#f7fafc' }}>
                          <td style={{ padding: '8px' }}>Total</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{radarData.reduce((s, r) => s + (r.actualAllocated || 0), 0).toFixed(1)}h</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{radarData.reduce((s, r) => s + (r.actualSpent || 0), 0).toFixed(1)}h</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {radarData.reduce((s, r) => s + (r.actualAllocated || 0), 0) > 0
                              ? Math.round((radarData.reduce((s, r) => s + (r.actualSpent || 0), 0) / radarData.reduce((s, r) => s + (r.actualAllocated || 0), 0)) * 100)
                              : 0}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Circle of Life — 8 individual radar charts week-over-week or month-over-month */}
          {detailedViewType === 'circle_of_life' && (() => {
            const PILLAR_COLORS: Record<string, string> = {
              'Hard Work': '#2563eb',
              'Calmness': '#16a34a',
              'Family': '#9333ea',
            };
            const PILLAR_ORDER_LOCAL = ['Hard Work', 'Calmness', 'Family'];

            const circleTypeOptions: { key: 'pillar' | 'category' | 'tasks' | 'one_time'; label: string; desc: string }[] = [
              { key: 'pillar',    label: '🎯 Pillar Balance',         desc: '3 Life Pillars' },
              { key: 'category',  label: '📁 Category Distribution',  desc: 'Categories across pillars' },
              { key: 'tasks',     label: '⏱️ Time-Based Tasks',       desc: 'Recurring task time' },
              { key: 'one_time',  label: '🗂️ One-Time Tasks',         desc: 'Projects & one-offs' },
            ];

            const getDaysInPeriod = (start: string, end: string) => {
              const s = new Date(start); const e = new Date(end);
              return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
            };

            // Score = min(spent%, 100) for ALL categories/tasks.
            // 100% = you spent exactly what you planned = full circle spoke = perfect.
            // Overspending (>100%) shows as a spike beyond the green ring in the radar,
            // but the score is capped at 100 so it doesn't inflate the avg badge.
            // isDrain flag kept only for the ⚠️ icon — no score inversion.
            const DRAIN_NAMES = ['Time Waste', 'Screen Relaxing', 'Life Loss Screen time'];
            const buildRadarData = (data: any[], start: string, end: string) => {
              const days = getDaysInPeriod(start, end);
              if (circleOfLifeType === 'pillar') {
                return PILLAR_ORDER_LOCAL.map(name => {
                  const p = data.find((d: any) => d.pillar_name === name);
                  const raw = p && p.allocated_hours > 0 ? Math.round((p.spent_hours / days / p.allocated_hours) * 100) : 0;
                  const score = Math.min(100, raw);
                  return { name, spent: raw, score, allocated: 100 };
                });
              } else if (circleOfLifeType === 'category') {
                const items = data.filter((c: any) => c.category_name !== 'My Tasks').slice(0, 10);
                return items.map((c: any) => {
                  const raw = c.allocated_hours > 0 ? Math.round((c.spent_hours / days / c.allocated_hours) * 100) : 0;
                  const isDrain = DRAIN_NAMES.includes(c.category_name);
                  const score = Math.min(100, raw);
                  return { name: c.category_name || c.name || 'Unknown', spent: raw, score, allocated: 100, isDrain };
                });
              } else {
                // tasks / one_time — data is [{name, category_name, allocated_hours, spent_hours}]
                return data.map((t: any) => {
                  const raw = t.allocated_hours > 0 ? Math.round((t.spent_hours / days / t.allocated_hours) * 100) : 0;
                  const isDrain = DRAIN_NAMES.includes(t.category_name || '') || DRAIN_NAMES.includes(t.name || '');
                  const score = Math.min(100, raw);
                  return { name: t.name || 'Unknown', spent: raw, score, allocated: 100, isDrain };
                });
              }
            };

            const periodColor = (idx: number, total: number) => {
              const ratio = total > 1 ? idx / (total - 1) : 1;
              const r = Math.round(191 + (29 - 191) * ratio);
              const g = Math.round(219 + (78 - 219) * ratio);
              const b = Math.round(254 + (216 - 254) * ratio);
              return `rgb(${r},${g},${b})`;
            };

            const selectedType = circleTypeOptions.find(o => o.key === circleOfLifeType) || circleTypeOptions[0];

            return (
              <div>
                {/* Circle type selector */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', color: '#374151', fontSize: '14px', marginBottom: '10px' }}>Select Circle Type:</div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {circleTypeOptions.map(opt => (
                      <button key={opt.key} onClick={() => {
                        setCircleOfLifeType(opt.key);
                        const params = new URLSearchParams(window.location.search);
                        params.set('circleType', opt.key);
                        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                      }}
                        style={{ padding: '10px 16px', borderRadius: '10px', border: `2px solid ${circleOfLifeType === opt.key ? '#4299e1' : '#e2e8f0'}`, background: circleOfLifeType === opt.key ? '#ebf4ff' : 'white', color: circleOfLifeType === opt.key ? '#1d4ed8' : '#374151', fontWeight: circleOfLifeType === opt.key ? '700' : '500', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                        <div>{opt.label}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Period selector */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#374151', fontSize: '14px' }}>Show last 8:</span>
                  <button
                    onClick={() => {
                      setCircleOfLifePeriod('week');
                      const params = new URLSearchParams(window.location.search);
                      params.set('circlePeriod', 'week');
                      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: circleOfLifePeriod === 'week' ? '2px solid #4299e1' : '2px solid #e2e8f0', background: circleOfLifePeriod === 'week' ? '#4299e1' : 'white', color: circleOfLifePeriod === 'week' ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                  >📆 Weeks</button>
                  <button
                    onClick={() => {
                      setCircleOfLifePeriod('month');
                      const params = new URLSearchParams(window.location.search);
                      params.set('circlePeriod', 'month');
                      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: circleOfLifePeriod === 'month' ? '2px solid #ed8936' : '2px solid #e2e8f0', background: circleOfLifePeriod === 'month' ? '#ed8936' : 'white', color: circleOfLifePeriod === 'month' ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                  >📅 Months</button>
                  <button
                    onClick={() => {
                      setCircleOfLifePeriod('year');
                      const params = new URLSearchParams(window.location.search);
                      params.set('circlePeriod', 'year');
                      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: circleOfLifePeriod === 'year' ? '2px solid #9333ea' : '2px solid #e2e8f0', background: circleOfLifePeriod === 'year' ? '#9333ea' : 'white', color: circleOfLifePeriod === 'year' ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                  >📊 Years</button>
                </div>

                {circleOfLifeLoading ? (
                  <div style={{ textAlign: 'center', padding: '80px', fontSize: '16px', color: '#64748b' }}>⏳ Loading {selectedType.desc} data...</div>
                ) : circleOfLifeData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No data available. Try a different type or period.</div>
                ) : (
                  <>
                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
                      Each circle shows daily-average % of allocated time for <strong>{selectedType.desc}</strong> per {circleOfLifePeriod}. Dark green ring = 100% goal (full circle = perfect {circleOfLifePeriod}). Labels show highest (green) &amp; lowest (red) only.
                    </p>
                    {/* 8 radar charts in a responsive grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                      {circleOfLifeData.map((period, idx) => {
                        const radarData = buildRadarData(period.data, period.start, period.end);
                        if (radarData.length === 0) return null;
                        const maxSpent = Math.max(...radarData.map(d => d.spent), 100);
                        const dynMax = Math.max(100, Math.ceil(maxSpent / 50) * 50);
                        // Only compute avg when actual data exists; drain categories (e.g. Time Waste) score 100
                        // when spent=0, which inflates the avg for periods with no entries yet.
                        const totalSpent = radarData.reduce((s, d) => s + d.spent, 0);
                        const avgPct = totalSpent === 0 ? 0 : radarData.reduce((s, d) => s + d.score, 0) / radarData.length;
                        const isNewest = idx === 0;
                        const radarColor = isNewest ? '#2563eb' : periodColor(idx, circleOfLifeData.length);
                        return (
                          <div key={period.label} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: isNewest ? '0 0 0 3px #2563eb, 0 4px 12px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.07)', border: isNewest ? '2px solid #2563eb' : '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: isNewest ? '#1d4ed8' : '#374151' }}>
                                {isNewest && '★ '}{period.label}
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: avgPct >= 80 ? '#16a34a' : avgPct >= 60 ? '#b45309' : '#dc2626', background: avgPct >= 80 ? '#d1fae5' : avgPct >= 60 ? '#fef3c7' : '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                                {Math.round(avgPct)}% avg
                              </div>
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px' }}>{period.start} → {period.end}</div>
                            <ResponsiveContainer width="100%" height={240}>
                              <RadarChart data={radarData} margin={{ top: 18, right: 30, bottom: 18, left: 30 }}>
                                <PolarGrid gridType="circle" strokeDasharray="3 3" />
                                <PolarAngleAxis dataKey="name" tick={(props: any) => {
                                    const { x, y, payload, textAnchor } = props;
                                    const name: string = payload.value;
                                    const maxVal = Math.max(...radarData.map((d: any) => d.spent));
                                    const minVal = Math.min(...radarData.map((d: any) => d.spent));
                                    const item = radarData.find((d: any) => d.name === name);
                                    const val = item ? item.spent : null;
                                    const isMax = val !== null && val === maxVal;
                                    const isMin = val !== null && val === minVal && maxVal !== minVal;
                                    // Word-wrap: split into lines of ~12 chars (same as WheelsOfLife)
                                    const words = name.split(' ');
                                    const lines: string[] = [];
                                    let cur = '';
                                    words.forEach((w: string) => {
                                      if ((cur + (cur ? ' ' : '') + w).length <= 12) {
                                        cur = cur ? cur + ' ' + w : w;
                                      } else {
                                        if (cur) lines.push(cur);
                                        cur = w;
                                      }
                                    });
                                    if (cur) lines.push(cur);
                                    return (
                                      <text x={x} y={y} textAnchor={textAnchor || 'middle'} fontSize={10} fontWeight={600} fill="#374151">
                                        {lines.map((line: string, i: number) => (
                                          <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>{line}</tspan>
                                        ))}
                                        {(isMax || isMin) && (
                                          <tspan x={x} dy="13" fontSize={10} fontWeight={700} fill={isMax ? '#16a34a' : '#dc2626'}>{val}%</tspan>
                                        )}
                                      </text>
                                    );
                                  }} />
                                <PolarRadiusAxis angle={90} domain={[0, dynMax]} tickCount={Math.floor(dynMax / 50) + 1} tickFormatter={(v: any) => `${v}%`} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                <Radar name="Actual %" dataKey="spent" stroke={radarColor} fill={radarColor} fillOpacity={0.45} strokeWidth={2}
                                />
                                <Radar dataKey="allocated" legendType="none" dot={false} isAnimationActive={false} shape={(props: any) => { const {cx,cy,outerRadius}=props; if(!outerRadius) return <g/>; const r=(100/dynMax)*outerRadius; return <circle cx={cx} cy={cy} r={r} fill="none" stroke="#16a34a" strokeWidth={4} strokeDasharray="10 5" />; }} />
                                <Tooltip formatter={(v: any, n: string) => [`${v}%`, n]} />
                              </RadarChart>
                            </ResponsiveContainer>
                            {/* Mini table — spent% (picture) + success% (goal adherence) */}
                            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginTop: '6px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#94a3b8' }}>
                                  <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 500 }}>Category</th>
                                  <th style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 500 }} title="Actual time spent vs allocated (matches the picture)">Spent%</th>
                                  <th style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 500 }} title="Goal adherence: min(spent%,100). 100% = you hit your plan exactly.">✓ Goal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {radarData.map(row => (
                                  <tr key={row.name}>
                                    <td style={{ padding: '2px 4px', fontWeight: '600', color: circleOfLifeType === 'pillar' ? (PILLAR_COLORS[row.name] || '#374151') : '#374151' }}>
                                      {circleOfLifeType === 'pillar' ? (row.name === 'Hard Work' ? '💼' : row.name === 'Calmness' ? '🧘' : '👨‍👩‍👦') : (row.isDrain ? '⚠️' : '📌')} {row.name}
                                    </td>
                                    <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: '700', color: row.isDrain ? (row.spent > 100 ? '#dc2626' : '#16a34a') : (row.spent >= 80 ? '#16a34a' : row.spent >= 60 ? '#b45309' : '#dc2626') }}>
                                      {row.spent}%
                                    </td>
                                    <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: '700', color: row.score >= 80 ? '#16a34a' : row.score >= 60 ? '#b45309' : '#dc2626' }}>
                                      {row.score}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Old comparison charts - keep below as additional context */}
          <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '2px solid #e2e8f0' }}>
            <h3 style={{ marginBottom: '20px' }}>📌 Additional Context</h3>
            
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