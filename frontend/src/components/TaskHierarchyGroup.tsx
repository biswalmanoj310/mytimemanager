/**
 * Task Hierarchy Group Component
 * 
 * Renders a collapsible group of tasks organized by pillar|category hierarchy.
 * Used across all task list pages for consistent task grouping.
 * 
 * Features:
 * - Collapsible pillar|category groups
 * - Task count display
 * - Expand/collapse state management
 * - Hierarchy-based styling
 */

import React from 'react';
import { Task } from '../types';

interface TaskHierarchyGroupProps {
  /** Group identifier (e.g., "Hard Work|Office-Tasks") */
  groupKey: string;
  
  /** Display name for the group */
  groupName: string;
  
  /** Tasks in this group */
  tasks: Task[];
  
  /** Whether the group is expanded */
  isExpanded: boolean;
  
  /** Callback when group is toggled */
  onToggle: (groupKey: string) => void;
  
  /** Render function for individual tasks */
  renderTask: (task: Task) => React.ReactNode;
  
  /** Optional CSS classes */
  className?: string;
  
  /** Show task count badge */
  showTaskCount?: boolean;
  
  /** Optional group color/theme */
  color?: string;
}

/**
 * Task Hierarchy Group Component
 * Collapsible group for displaying tasks organized by hierarchy
 */
const TaskHierarchyGroup: React.FC<TaskHierarchyGroupProps> = ({
  groupKey,
  groupName,
  tasks,
  isExpanded,
  onToggle,
  renderTask,
  className = '',
  showTaskCount = true,
  color,
}) => {
  /**
   * Get active task count
   */
  const getActiveTaskCount = (): number => {
    return tasks.filter(t => t.is_active && !t.is_completed && !t.na_marked_at).length;
  };

  /**
   * Get completed task count
   */
  const getCompletedTaskCount = (): number => {
    return tasks.filter(t => t.is_completed).length;
  };

  /**
   * Handle group toggle
   */
  const handleToggle = () => {
    onToggle(groupKey);
  };

  const activeCount = getActiveTaskCount();
  const completedCount = getCompletedTaskCount();
  const totalCount = tasks.length;

  return (
    <div className={`task-hierarchy-group ${className}`} data-group-key={groupKey}>
      {/* Group Header */}
      <div
        className={`group-header ${isExpanded ? 'expanded' : 'collapsed'}`}
        onClick={handleToggle}
        style={color ? { borderLeftColor: color } : undefined}
      >
        {/* Expand/Collapse Icon */}
        <div className="toggle-icon">
          <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
        </div>

        {/* Group Name */}
        <div className="group-name">
          <strong>{groupName}</strong>
        </div>

        {/* Task Counts */}
        {showTaskCount && (
          <div className="task-counts">
            <span className="badge bg-primary" title="Active tasks">
              {activeCount}
            </span>
            {completedCount > 0 && (
              <span className="badge bg-success ms-1" title="Completed tasks">
                {completedCount}
              </span>
            )}
            <span className="text-muted ms-2" title="Total tasks">
              ({totalCount} total)
            </span>
          </div>
        )}
      </div>

      {/* Group Content */}
      {isExpanded && (
        <div className="group-content">
          {tasks.length === 0 ? (
            <div className="no-tasks text-muted">
              <i className="fas fa-info-circle me-1"></i>
              No tasks in this group
            </div>
          ) : (
            <div className="tasks-list">
              {tasks.map((task) => (
                <div key={task.id} className="task-item">
                  {renderTask(task)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskHierarchyGroup;
