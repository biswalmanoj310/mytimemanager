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

function App() {
  return (
    <Router>
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
