/**
 * Main App Component
 * Root component with routing and global state
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';
import TimeTracking from './pages/TimeTracking';
import Completed from './pages/Completed';
import Challenges from './pages/Challenges';
import MyDayDesign from './pages/MyDayDesign';
import { TaskProvider, TimeEntriesProvider, UserPreferencesProvider } from './contexts';

function App() {
  return (
    <Router>
      <TaskProvider>
        <TimeEntriesProvider>
          <UserPreferencesProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/challenges" element={<Challenges />} />
                <Route path="/time-tracking" element={<TimeTracking />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/completed" element={<Completed />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/my-day-design" element={<MyDayDesign />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </UserPreferencesProvider>
        </TimeEntriesProvider>
      </TaskProvider>
    </Router>
  );
}

export default App;
