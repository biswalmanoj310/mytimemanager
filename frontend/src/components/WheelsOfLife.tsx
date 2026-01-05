import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from 'recharts';
import './WheelsOfLife.css';

const PILLAR_ORDER = ['Hard Work', 'Calmness', 'Family'];
const CATEGORY_ORDER = [
  'Office-Tasks', 'Learning', 'Confidence',  // Hard Work
  'Yoga', 'Sleep',                           // Calmness
  'My Tasks', 'Home Tasks', 'Time Waste'     // Family
];

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
  pillar_name?: string;
  category_name?: string;
  allocated_minutes: number;
  spent_minutes: number;
}

interface WheelsOfLifeProps {
  dailyPillarData: PillarData[];
  weeklyPillarData: PillarData[];
  monthlyPillarData: PillarData[];
  todayCategoryData: CategoryData[];
  weekCategoryData: CategoryData[];
  monthCategoryData: CategoryData[];
  todayTaskData: TaskData[];
  weekTaskData: TaskData[];
  monthTaskData: TaskData[];
  todayOneTimeTaskData: TaskData[];
  weekOneTimeTaskData: TaskData[];
  monthOneTimeTaskData: TaskData[];
  allTasksData: any[];
}

const WheelsOfLife: React.FC<WheelsOfLifeProps> = ({
  dailyPillarData,
  weeklyPillarData,
  monthlyPillarData,
  todayCategoryData,
  weekCategoryData,
  monthCategoryData,
  todayTaskData,
  weekTaskData,
  monthTaskData,
  todayOneTimeTaskData,
  weekOneTimeTaskData,
  monthOneTimeTaskData,
}) => {
  
  // Helper: Get days elapsed in current week (week starts Monday, local time)
  const getDaysElapsedInWeek = (): number => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Convert to Monday-based: Monday = 1, Tuesday = 2, ..., Sunday = 7
    const mondayBased = dayOfWeek === 0 ? 7 : dayOfWeek;
    return mondayBased; // Days elapsed including today
  };
  
  // Helper: Get days elapsed in current month (local time)
  const getDaysElapsedInMonth = (): number => {
    const today = new Date();
    return today.getDate(); // Day of month (1-31)
  };
  
  // Helper: Normalize spent hours to daily average based on period type
  const normalizeToDailyAverage = (spentHours: number, periodType: 'today' | 'week' | 'month'): number => {
    if (periodType === 'today') {
      return spentHours; // No normalization for today
    } else if (periodType === 'week') {
      const daysElapsed = getDaysElapsedInWeek();
      return daysElapsed > 0 ? spentHours / daysElapsed : 0;
    } else { // month
      const daysElapsed = getDaysElapsedInMonth();
      return daysElapsed > 0 ? spentHours / daysElapsed : 0;
    }
  };
  
  // Filter pillars/categories that have allocated time and active tasks
  const getFilteredPillarData = (pillarData: PillarData[]) => {
    return pillarData.filter(p => p.allocated_hours > 0 && p.spent_hours >= 0);
  };

  const getFilteredCategoryData = (categoryData: CategoryData[]) => {
    return categoryData.filter(c => c.allocated_hours > 0);
  };

  const getFilteredTaskData = (taskData: TaskData[]) => {
    return taskData.filter(t => t.allocated_minutes > 0);
  };

  const renderPillarWheel = (
    pillarData: PillarData[],
    title: string,
    emoji: string,
    radarColor: string
  ) => {
    const filteredData = getFilteredPillarData(pillarData);
    
    // Determine period type from title
    const periodType: 'today' | 'week' | 'month' = 
      title.includes('Today') ? 'today' : 
      title.includes('Week') ? 'week' : 'month';
    
    // Sort by Daily tab pillar order
    const sortedData = [...filteredData].sort((a, b) => {
      const orderA = PILLAR_ORDER.indexOf(a.pillar_name);
      const orderB = PILLAR_ORDER.indexOf(b.pillar_name);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });

    const radarData = sortedData.map(p => {
      const dailyAvgSpent = normalizeToDailyAverage(p.spent_hours, periodType);
      const percentage = p.allocated_hours > 0 ? (dailyAvgSpent / p.allocated_hours) * 100 : 0;
      return {
        pillar: p.pillar_name,
        allocated: 100, // Always 100% as the target
        spent: percentage, // No cap - let it scale naturally
        actualAllocated: p.allocated_hours,
        actualSpent: dailyAvgSpent,
        icon: p.icon,
        color: p.color_code
      };
    });

    // Dynamic scaling: minimum 100%, round up to nearest 50 if exceeds 100%
    const maxPercent = Math.max(...radarData.map(d => d.spent), 100);
    const dynamicMax = Math.max(100, Math.ceil(maxPercent / 50) * 50);

    return (
      <div className="wheel-card">
        <h3>{emoji} {title}</h3>

        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="pillar" 
              tick={{ fontSize: 12, fontWeight: 500, fill: '#2b6cb0' }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, dynamicMax]}
              tickCount={(dynamicMax / 50) + 1}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 10, fill: '#ff6b35', fontWeight: 600 }}
            />
            <Radar 
              name="Allocated (Target)" 
              dataKey="allocated" 
              stroke="#cbd5e0" 
              fill="#cbd5e0" 
              fillOpacity={0.2} 
              strokeWidth={2}
            />
            <Radar 
              name="Actual % Achieved" 
              dataKey="spent" 
              stroke={radarColor} 
              fill={radarColor} 
              fillOpacity={0.5} 
              strokeWidth={2}
            />
            <Tooltip 
              formatter={(value: any, name: string, props: any) => {
                const data = props.payload;
                if (name === 'Actual % Achieved') {
                  return [
                    `${data.actualSpent.toFixed(1)}h (${value.toFixed(0)}%)`,
                    name
                  ];
                }
                return [`${value}%`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Percentage Breakdown Table */}
        <table className="pillar-breakdown-table">
          <thead>
            <tr>
              <th className="pillar-icon"></th>
              <th>Pillar</th>
              <th>Allocated</th>
              <th>Spent<br/>(day)</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {radarData.map((item, index) => {
              const percentage = item.actualAllocated > 0 ? (item.actualSpent / item.actualAllocated) * 100 : 0;
              return (
                <tr key={index}>
                  <td className="pillar-icon">{item.icon}</td>
                  <td style={{ color: item.color, fontWeight: 600 }}>{item.pillar}</td>
                  <td>{item.actualAllocated.toFixed(1)}h</td>
                  <td>{item.actualSpent.toFixed(1)}h</td>
                  <td>{percentage.toFixed(0)}%</td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr style={{ backgroundColor: '#f7fafc', fontWeight: 700, borderTop: '2px solid #cbd5e0' }}>
              <td className="pillar-icon"></td>
              <td>Total</td>
              <td>{radarData.reduce((sum, item) => sum + item.actualAllocated, 0).toFixed(1)}h</td>
              <td>{radarData.reduce((sum, item) => sum + item.actualSpent, 0).toFixed(1)}h</td>
              <td>
                {radarData.reduce((sum, item) => sum + item.actualAllocated, 0) > 0
                  ? ((radarData.reduce((sum, item) => sum + item.actualSpent, 0) / 
                     radarData.reduce((sum, item) => sum + item.actualAllocated, 0)) * 100).toFixed(0)
                  : 0}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderCategoryWheel = (
    categoryData: CategoryData[],
    title: string,
    emoji: string
  ) => {
    const filteredData = getFilteredCategoryData(categoryData);
    
    // Determine period type from title
    const periodType: 'today' | 'week' | 'month' = 
      title.includes('Today') ? 'today' : 
      title.includes('Week') ? 'week' : 'month';
    
    // Sort by Daily tab category order
    const sortedData = [...filteredData].sort((a, b) => {
      const orderA = CATEGORY_ORDER.indexOf(a.category_name);
      const orderB = CATEGORY_ORDER.indexOf(b.category_name);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    }).slice(0, 8);

    const radarData = sortedData.map(c => {
      const dailyAvgSpent = normalizeToDailyAverage(c.spent_hours, periodType);
      const percentage = c.allocated_hours > 0 ? (dailyAvgSpent / c.allocated_hours) * 100 : 0;
      return {
        category: c.category_name,
        fullName: c.category_name,
        spent: percentage, // No cap - let it scale naturally
        actualAllocated: c.allocated_hours,
        actualSpent: dailyAvgSpent
      };
    });

    // Dynamic scaling: minimum 100%, round up to nearest 50 if exceeds 100%
    const maxPercent = Math.max(...radarData.map(d => d.spent), 100);
    const dynamicMax = Math.max(100, Math.ceil(maxPercent / 50) * 50);

    // Determine color based on title (Today/Weekly/Monthly)
    const radarColor = title.includes('Today') ? '#4299e1' : 
                       title.includes('Week') ? '#48bb78' : '#ed8936';

    // Custom tick renderer for multi-line text
    const CustomTick = (props: any) => {
      const { x, y, payload } = props;
      const lines = payload.value.split(' ');
      
      return (
        <text 
          x={x} 
          y={y} 
          textAnchor="middle" 
          fontSize={11} 
          fontWeight={500} 
          fill="#2b6cb0"
        >
          {lines.map((line: string, index: number) => (
            <tspan 
              key={index} 
              x={x} 
              dy={index === 0 ? 0 : 12}
            >
              {line}
            </tspan>
          ))}
        </text>
      );
    };

    return (
      <div className="wheel-card">
        <h3>{emoji} {title}</h3>

        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="category" 
              tick={<CustomTick />}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, dynamicMax]}
              tickCount={(dynamicMax / 50) + 1}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 10, fill: '#ff6b35', fontWeight: 600 }}
            />
            <Radar 
              name="Actual Time Spent" 
              dataKey="spent" 
              stroke={radarColor} 
              fill={radarColor} 
              fillOpacity={0.5} 
              strokeWidth={2}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                `${Number(value).toFixed(1)}h`,
                name
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Category Breakdown Table */}
        <table className="pillar-breakdown-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Allocated</th>
              <th>Spent<br/>(day)</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {radarData.map((item, index) => {
              const percentage = item.actualAllocated > 0 
                ? (item.actualSpent / item.actualAllocated) * 100 
                : 0;
              return (
                <tr key={index}>
                  <td style={{ fontWeight: 500 }}>{item.fullName}</td>
                  <td>{item.actualAllocated.toFixed(1)}h</td>
                  <td>{item.actualSpent.toFixed(1)}h</td>
                  <td>{percentage.toFixed(0)}%</td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr style={{ backgroundColor: '#f7fafc', fontWeight: 700, borderTop: '2px solid #cbd5e0' }}>
              <td>Total</td>
              <td>{radarData.reduce((sum, item) => sum + item.actualAllocated, 0).toFixed(1)}h</td>
              <td>{radarData.reduce((sum, item) => sum + item.actualSpent, 0).toFixed(1)}h</td>
              <td>
                {radarData.reduce((sum, item) => sum + item.actualAllocated, 0) > 0
                  ? ((radarData.reduce((sum, item) => sum + item.actualSpent, 0) / 
                     radarData.reduce((sum, item) => sum + item.actualAllocated, 0)) * 100).toFixed(0)
                  : 0}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderTaskWheel = (
    taskData: TaskData[],
    title: string,
    emoji: string,
    radarColor: string
  ) => {
    const filteredData = getFilteredTaskData(taskData);
    
    // Determine period type from title
    const periodType: 'today' | 'week' | 'month' = 
      title.includes('Today') ? 'today' : 
      title.includes('Week') ? 'week' : 'month';
    
    // Sort by hierarchy: pillar → category → task name (same as Daily tab)
    const sortedData = [...filteredData]
      .sort((a, b) => {
        // Sort by pillar order first
        const pillarIndexA = PILLAR_ORDER.indexOf(a.pillar_name || '');
        const pillarIndexB = PILLAR_ORDER.indexOf(b.pillar_name || '');
        if (pillarIndexA !== pillarIndexB) {
          return (pillarIndexA === -1 ? 999 : pillarIndexA) - (pillarIndexB === -1 ? 999 : pillarIndexB);
        }
        
        // Then by category order
        const categoryIndexA = CATEGORY_ORDER.indexOf(a.category_name || '');
        const categoryIndexB = CATEGORY_ORDER.indexOf(b.category_name || '');
        if (categoryIndexA !== categoryIndexB) {
          return (categoryIndexA === -1 ? 999 : categoryIndexA) - (categoryIndexB === -1 ? 999 : categoryIndexB);
        }
        
        // Finally by task name
        return a.task_name.localeCompare(b.task_name);
      })
      .slice(0, 8); // Show top 8 tasks

    const radarData = sortedData.map(t => {
      const allocatedHours = t.allocated_minutes / 60;
      const actualSpentHours = t.spent_minutes / 60;
      const dailyAvgSpent = normalizeToDailyAverage(actualSpentHours, periodType);
      const percentage = allocatedHours > 0 ? (dailyAvgSpent / allocatedHours) * 100 : 0;
      return {
        task: t.task_name.length > 20 
          ? t.task_name.substring(0, 17) + '...' 
          : t.task_name,
        fullName: t.task_name,
        spent: percentage, // No cap - let it scale naturally
        actualAllocated: allocatedHours,
        actualSpent: dailyAvgSpent
      };
    });

    // Dynamic scaling: minimum 100%, round up to nearest 50 if exceeds 100%
    const maxPercent = Math.max(...radarData.map(d => d.spent), 100);
    const dynamicMax = Math.max(100, Math.ceil(maxPercent / 50) * 50);

    // Custom tick renderer for multi-line text
    const CustomTick = (props: any) => {
      const { x, y, payload } = props;
      const words = payload.value.split(' ');
      
      // If task name is short, show as single line
      if (payload.value.length <= 15) {
        return (
          <text 
            x={x} 
            y={y} 
            textAnchor="middle" 
            fontSize={10} 
            fontWeight={500} 
            fill="#2b6cb0"
          >
            {payload.value}
          </text>
        );
      }
      
      // For longer names, split into lines
      const lines = [];
      let currentLine = '';
      words.forEach((word: string) => {
        if ((currentLine + word).length <= 12) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);
      
      return (
        <text 
          x={x} 
          y={y} 
          textAnchor="middle" 
          fontSize={9} 
          fontWeight={500} 
          fill="#2b6cb0"
        >
          {lines.slice(0, 2).map((line: string, index: number) => (
            <tspan 
              key={index} 
              x={x} 
              dy={index === 0 ? 0 : 10}
            >
              {line}
            </tspan>
          ))}
        </text>
      );
    };

    return (
      <div className="wheel-card">
        <h3>{emoji} {title}</h3>

        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="task" 
              tick={<CustomTick />}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, dynamicMax]}
              tickCount={(dynamicMax / 50) + 1}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 10, fill: '#ff6b35', fontWeight: 600 }}
            />
            <Radar 
              name="Actual Time Spent" 
              dataKey="spent" 
              stroke={radarColor} 
              fill={radarColor} 
              fillOpacity={0.5} 
              strokeWidth={2}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                `${Number(value).toFixed(1)}h`,
                name
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Task Breakdown Table */}
        <table className="pillar-breakdown-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Allocated</th>
              <th>Spent<br/>(day)</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {radarData.map((item, index) => {
              const percentage = item.actualAllocated > 0 
                ? (item.actualSpent / item.actualAllocated) * 100 
                : 0;
              return (
                <tr key={index}>
                  <td style={{ fontWeight: 500 }}>{item.fullName}</td>
                  <td>{item.actualAllocated.toFixed(1)}h</td>
                  <td>{item.actualSpent.toFixed(1)}h</td>
                  <td>{percentage.toFixed(0)}%</td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr style={{ backgroundColor: '#f7fafc', fontWeight: 700, borderTop: '2px solid #cbd5e0' }}>
              <td>Total</td>
              <td>{radarData.reduce((sum, item) => sum + item.actualAllocated, 0).toFixed(1)}h</td>
              <td>{radarData.reduce((sum, item) => sum + item.actualSpent, 0).toFixed(1)}h</td>
              <td>
                {radarData.reduce((sum, item) => sum + item.actualAllocated, 0) > 0
                  ? ((radarData.reduce((sum, item) => sum + item.actualSpent, 0) / 
                     radarData.reduce((sum, item) => sum + item.actualAllocated, 0)) * 100).toFixed(0)
                  : 0}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="wheels-of-life-container">
      <h2>⭕ Wheel of Life - Balance Visualization</h2>
      <p className="chart-description">
        Visualize your time balance across pillars and categories. Each wheel shows the distribution of actual time spent.
      </p>

      {/* Pillar Wheels: Today, Weekly, Monthly */}
      <div className="wheel-comparison-container">
        {renderPillarWheel(dailyPillarData, 'Today - Pillar Balance', '📅', '#4299e1')}
        {renderPillarWheel(weeklyPillarData, 'This Week - Pillar Balance', '📊', '#48bb78')}
        {renderPillarWheel(monthlyPillarData, 'This Month - Pillar Balance', '📈', '#ed8936')}
      </div>

      {/* Category Wheels: Today, Weekly, Monthly */}
      <div className="wheel-comparison-container">
        {renderCategoryWheel(todayCategoryData, 'Today - Category Distribution', '📅')}
        {renderCategoryWheel(weekCategoryData, 'This Week - Category Distribution', '📊')}
        {renderCategoryWheel(monthCategoryData, 'This Month - Category Distribution', '📈')}
      </div>

      {/* Time-Based Tasks Wheels: Today, Weekly, Monthly */}
      <h2 style={{ marginTop: '3rem', marginBottom: '1rem' }}>⏱️ Time-Based Tasks Distribution</h2>
      <p className="chart-description">
        Track time allocation and spending across your daily recurring tasks.
      </p>
      <div className="wheel-comparison-container">
        {renderTaskWheel(todayTaskData, 'Today - Time-Based Tasks', '📅', '#4299e1')}
        {renderTaskWheel(weekTaskData, 'This Week - Time-Based Tasks', '📊', '#48bb78')}
        {renderTaskWheel(monthTaskData, 'This Month - Time-Based Tasks', '📈', '#ed8936')}
      </div>

      {/* One-Time Tasks Wheels: Today, Weekly, Monthly */}
      <h2 style={{ marginTop: '3rem', marginBottom: '1rem' }}>🎯 One-Time Tasks Distribution</h2>
      <p className="chart-description">
        Monitor time spent on one-time important tasks.
      </p>
      <div className="wheel-comparison-container">
        {renderTaskWheel(todayOneTimeTaskData, 'Today - One-Time Tasks', '📅', '#4299e1')}
        {renderTaskWheel(weekOneTimeTaskData, 'This Week - One-Time Tasks', '📊', '#48bb78')}
        {renderTaskWheel(monthOneTimeTaskData, 'This Month - One-Time Tasks', '📈', '#ed8936')}
      </div>
    </div>
  );
};

export default WheelsOfLife;
