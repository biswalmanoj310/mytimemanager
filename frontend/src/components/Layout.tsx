/**
 * Layout Component
 * Main layout with sidebar navigation and header
 */

import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  CheckSquare, 
  Target, 
  Clock, 
  BarChart3,
  CheckCircle2,
  Trophy,
  Menu,
  X,
  Settings
} from 'lucide-react';
import { useState } from 'react';
import PomodoroTree from './PomodoroTree';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/tasks', label: 'Tasks', icon: <CheckSquare size={20} /> },
  { path: '/goals', label: 'Goals', icon: <Target size={20} /> },
  { path: '/challenges', label: 'Challenges', icon: <Trophy size={20} /> },
  { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  { path: '/completed', label: 'Completed', icon: <CheckCircle2 size={20} /> },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="menu-button" onClick={toggleSidebar}>
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="app-title">MakingMeHappier</h1>
        <div className="header-spacer"></div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">MakingMeHappier</h2>
          <p className="sidebar-subtitle">
            <span className="subtitle-balance">Balance</span> • <span className="subtitle-growth">Growth</span> • <span className="subtitle-joy">Joy</span>
          </p>
          <div className="emotion-tags-header">
            <span className="emotion-tag-small fulfillment">✨ Fulfillment</span>
            <span className="emotion-tag-small bliss">💫 Bliss</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Pomodoro Tree in Sidebar */}
        <div className="sidebar-pomodoro">
          <PomodoroTree />
        </div>

        <div className="sidebar-footer">
          <div className="pillar-legend">
            <h4>Three Pillars</h4>
            <div className="pillar-item">
              <span className="pillar-dot hard-work">💼</span>
              <span>Hard Work</span>
            </div>
            <div className="pillar-item">
              <span className="pillar-dot calmness">🧘</span>
              <span>Calmness</span>
            </div>
            <div className="pillar-item">
              <span className="pillar-dot family">👨‍👩‍👦</span>
              <span>Family</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-wrapper">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}
    </div>
  );
}
