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

interface WheelsOfLifeProps {
  dailyPillarData: PillarData[];
  weeklyPillarData: PillarData[];
  monthlyPillarData: PillarData[];
  todayCategoryData: CategoryData[];
  weekCategoryData: CategoryData[];
  monthCategoryData: CategoryData[];
  allTasksData: any[];
}

const WheelsOfLife: React.FC<WheelsOfLifeProps> = ({
  dailyPillarData,
  weeklyPillarData,
  monthlyPillarData,
  todayCategoryData,
  weekCategoryData,
  monthCategoryData,
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
      return {
        pillar: p.pillar_name,
        allocated: p.allocated_hours,
        spent: dailyAvgSpent, // Show daily average in radar
        actualSpent: p.spent_hours, // Keep actual total for table
        icon: p.icon,
        color: p.color_code
      };
    });

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
              domain={[0, 'auto']}
              tick={{ fontSize: 10 }}
            />
            <Radar 
              name="Allocated (Ideal)" 
              dataKey="allocated" 
              stroke="#cbd5e0" 
              fill="#cbd5e0" 
              fillOpacity={0.2} 
              strokeWidth={2}
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
              const percentage = item.allocated > 0 ? (item.spent / item.allocated) * 100 : 0;
              return (
                <tr key={index}>
                  <td className="pillar-icon">{item.icon}</td>
                  <td style={{ color: item.color, fontWeight: 600 }}>{item.pillar}</td>
                  <td>{item.allocated.toFixed(1)}h</td>
                  <td>{item.spent.toFixed(1)}h</td>
                  <td>{percentage.toFixed(0)}%</td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr style={{ backgroundColor: '#f7fafc', fontWeight: 700, borderTop: '2px solid #cbd5e0' }}>
              <td className="pillar-icon"></td>
              <td>Total</td>
              <td>{radarData.reduce((sum, item) => sum + item.allocated, 0).toFixed(1)}h</td>
              <td>{radarData.reduce((sum, item) => sum + item.spent, 0).toFixed(1)}h</td>
              <td>
                {radarData.reduce((sum, item) => sum + item.allocated, 0) > 0
                  ? ((radarData.reduce((sum, item) => sum + item.spent, 0) / 
                     radarData.reduce((sum, item) => sum + item.allocated, 0)) * 100).toFixed(0)
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
      return {
        category: c.category_name,
        fullName: c.category_name,
        allocated: c.allocated_hours,
        spent: dailyAvgSpent, // Show daily average in radar
        actualSpent: c.spent_hours // Keep actual total for table
      };
    });

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
              domain={[0, 'auto']}
              tick={{ fontSize: 10 }}
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
              const percentage = item.allocated > 0 
                ? (item.spent / item.allocated) * 100 
                : 0;
              return (
                <tr key={index}>
                  <td style={{ fontWeight: 500 }}>{item.fullName}</td>
                  <td>{item.allocated.toFixed(1)}h</td>
                  <td>{item.spent.toFixed(1)}h</td>
                  <td>{percentage.toFixed(0)}%</td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr style={{ backgroundColor: '#f7fafc', fontWeight: 700, borderTop: '2px solid #cbd5e0' }}>
              <td>Total</td>
              <td>{radarData.reduce((sum, item) => sum + item.allocated, 0).toFixed(1)}h</td>
              <td>{radarData.reduce((sum, item) => sum + item.spent, 0).toFixed(1)}h</td>
              <td>
                {radarData.reduce((sum, item) => sum + item.allocated, 0) > 0
                  ? ((radarData.reduce((sum, item) => sum + item.spent, 0) / 
                     radarData.reduce((sum, item) => sum + item.allocated, 0)) * 100).toFixed(0)
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
    </div>
  );
};

export default WheelsOfLife;
