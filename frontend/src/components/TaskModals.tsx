/**
 * TaskModals Component
 * Extracted from Tasks.tsx to manage file size (Babel 500KB limit)
 * Contains all modal dialogs for task management
 */

import React from 'react';

interface TaskModalsProps {
  // Modal visibility states
  showEditTaskModal: boolean;
  showEditProjectMilestoneModal: boolean;
  showMilestoneDetailModal: boolean;
  showAddProjectModal: boolean;
  showAddProjectMilestoneModal: boolean;
  showAddTaskModal: boolean;
  showAddWeeklyTaskModal: boolean;
  showAddMonthlyTaskModal: boolean;
  showAddYearlyTaskModal: boolean;
  showAddOneTimeTaskModal: boolean;
  showAddMiscGroupModal: boolean;
  showAddMiscTaskModal: boolean;
  showAddHabitModal: boolean;
  showHabitDetailsModal: boolean;
  showAddWishModal: boolean;
  showWishDetailsModal: boolean;
  showAddGoalModal: boolean;
  showAddMilestoneModal: boolean;
  showAddGoalTaskModal: boolean;
  showLinkTaskModal: boolean;

  // State setters
  setShowEditTaskModal: (show: boolean) => void;
  setShowEditProjectMilestoneModal: (show: boolean) => void;
  setShowMilestoneDetailModal: (show: boolean) => void;
  setShowAddProjectModal: (show: boolean) => void;
  setShowAddProjectMilestoneModal: (show: boolean) => void;
  setShowAddTaskModal: (show: boolean) => void;
  setShowAddWeeklyTaskModal: (show: boolean) => void;
  setShowAddMonthlyTaskModal: (show: boolean) => void;
  setShowAddYearlyTaskModal: (show: boolean) => void;
  setShowAddOneTimeTaskModal: (show: boolean) => void;
  setShowAddMiscGroupModal: (show: boolean) => void;
  setShowAddMiscTaskModal: (show: boolean) => void;
  setShowAddHabitModal: (show: boolean) => void;
  setShowHabitDetailsModal: (show: boolean) => void;
  setShowAddWishModal: (show: boolean) => void;
  setShowWishDetailsModal: (show: boolean) => void;
  setShowAddGoalModal: (show: boolean) => void;
  setShowAddMilestoneModal: (show: boolean) => void;
  setShowAddGoalTaskModal: (show: boolean) => void;
  setShowLinkTaskModal: (show: boolean) => void;

  // Data states
  editingTask: any;
  setEditingTask: (task: any) => void;
  editingMilestone: any;
  setEditingMilestone: (milestone: any) => void;
  selectedMilestone: any;
  setSelectedMilestone: (milestone: any) => void;
  selectedProject: any;
  projectMilestones: any[];
  projectTasks: any[];
  expandedTasks: Set<number>;
  tasks: any[];
  selectedDailyTask: number | null;
  setSelectedDailyTask: (id: number | null) => void;
  selectedDailyTaskForMonthly: number | null;
  setSelectedDailyTaskForMonthly: (id: number | null) => void;
  selectedDailyTaskForYearly: number | null;
  setSelectedDailyTaskForYearly: (id: number | null) => void;
  selectedTaskForOneTime: number | null;
  setSelectedTaskForOneTime: (id: number | null) => void;
  selectedMiscGroup: any;
  selectedGoal: any;
  selectedHabit: any;
  selectedWish: any;
  habits: any[];
  wishes: any[];

  // Handler functions
  handleUpdateTask: (e: React.FormEvent) => Promise<void>;
  handleCreateProjectMilestone: (data: any) => Promise<void>;
  handleDeleteProjectMilestone: (id: number) => Promise<void>;
  toggleTaskExpansion: (id: number) => void;
  handleToggleProjectTask: (id: number, status: boolean) => void;
  handleEditTask: (task: any) => void;
  handleAddWeeklyTask: () => Promise<void>;
  handleAddMonthlyTask: () => Promise<void>;
  handleAddYearlyTask: () => Promise<void>;
  handleAddOneTimeTask: () => Promise<void>;
  handleCreateHabit: (data: any) => Promise<void>;
  handleUpdateHabit: (id: number, updates: any) => Promise<void>;
  handleCreateWish: (data: any) => Promise<void>;
  handleUpdateWish: (id: number, updates: any) => Promise<void>;
  handleCreateLifeGoal: (data: any) => Promise<void>;
  handleCreateMilestone: (goalId: number, data: any) => Promise<void>;
  handleCreateGoalTask: (goalId: number, data: any) => Promise<void>;
  handleLinkTask: (goalId: number, taskId: number, taskType: string, timeAllocated?: number, notes?: string) => Promise<void>;
  
  // API functions
  loadProjects: () => Promise<void>;
  loadProjectTasks: (projectId: number) => Promise<void>;
  loadProjectMilestones: (projectId: number) => Promise<void>;
  loadGoalDetails: (goalId: number) => Promise<void>;
  
  // Utility
  api: any;
}

export default function TaskModals(props: TaskModalsProps) {
  // Helper function for date formatting
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const {
    showEditTaskModal,
    setShowEditTaskModal,
    editingTask,
    setEditingTask,
    handleUpdateTask,
    projectMilestones,
    
    showEditProjectMilestoneModal,
    setShowEditProjectMilestoneModal,
    editingMilestone,
    setEditingMilestone,
    selectedProject,
    api,
    loadProjectMilestones,
    loadProjects,
    
    showMilestoneDetailModal,
    setShowMilestoneDetailModal,
    selectedMilestone,
    setSelectedMilestone,
    projectTasks,
    expandedTasks,
    toggleTaskExpansion,
    handleToggleProjectTask,
    handleEditTask,
    handleDeleteProjectMilestone,
    
    showAddProjectModal,
    setShowAddProjectModal,
    
    showAddProjectMilestoneModal,
    setShowAddProjectMilestoneModal,
    handleCreateProjectMilestone,
    
    showAddTaskModal,
    setShowAddTaskModal,
    loadProjectTasks,
    
    showAddWeeklyTaskModal,
    setShowAddWeeklyTaskModal,
    handleAddWeeklyTask,
    tasks,
    selectedDailyTask,
    setSelectedDailyTask,
    
    showAddMonthlyTaskModal,
    setShowAddMonthlyTaskModal,
    handleAddMonthlyTask,
    selectedDailyTaskForMonthly,
    setSelectedDailyTaskForMonthly,
    
    showAddYearlyTaskModal,
    setShowAddYearlyTaskModal,
    handleAddYearlyTask,
    selectedDailyTaskForYearly,
    setSelectedDailyTaskForYearly,
    
    showAddOneTimeTaskModal,
    setShowAddOneTimeTaskModal,
    handleAddOneTimeTask,
    selectedTaskForOneTime,
    setSelectedTaskForOneTime,
    
    showAddMiscGroupModal,
    setShowAddMiscGroupModal,
    
    showAddMiscTaskModal,
    setShowAddMiscTaskModal,
    selectedMiscGroup,
    
    showAddHabitModal,
    setShowAddHabitModal,
    handleCreateHabit,
    
    showHabitDetailsModal,
    setShowHabitDetailsModal,
    selectedHabit,
    handleUpdateHabit,
    
    showAddWishModal,
    setShowAddWishModal,
    handleCreateWish,
    
    showWishDetailsModal,
    setShowWishDetailsModal,
    selectedWish,
    handleUpdateWish,
    
    showAddGoalModal,
    setShowAddGoalModal,
    handleCreateLifeGoal,
    
    showAddMilestoneModal,
    setShowAddMilestoneModal,
    selectedGoal,
    handleCreateMilestone,
    
    showAddGoalTaskModal,
    setShowAddGoalTaskModal,
    handleCreateGoalTask,
    
    showLinkTaskModal,
    setShowLinkTaskModal,
    handleLinkTask,
    tasks: allTasks,
    habits,
    wishes
  } = props;

  return (
    <>
      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Task</h2>
              <button className="btn-close" onClick={() => setShowEditTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Show parent task hierarchy if this is a subtask */}
              {editingTask.parent_task_id && (() => {
                // Build the hierarchy path from root to immediate parent
                const getTaskPath = (taskId: number): string[] => {
                  const task = projectTasks.find(t => t.id === taskId);
                  if (!task) return [];
                  if (task.parent_task_id) {
                    return [...getTaskPath(task.parent_task_id), task.name];
                  }
                  return [task.name];
                };
                
                const path = getTaskPath(editingTask.parent_task_id);
                const parentTask = projectTasks.find(t => t.id === editingTask.parent_task_id);
                
                return (
                  <div style={{ 
                    marginBottom: '15px', 
                    padding: '12px', 
                    backgroundColor: '#f7fafc', 
                    borderLeft: '4px solid #4299e1',
                    borderRadius: '4px'
                  }}>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px', fontWeight: '500' }}>
                      📂 Task Hierarchy
                    </div>
                    <div style={{ fontSize: '13px', color: '#2d3748' }}>
                      {path.join(' → ')}
                    </div>
                    {parentTask && (
                      <button
                        type="button"
                        onClick={() => setEditingTask(parentTask)}
                        style={{
                          marginTop: '8px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          backgroundColor: '#4299e1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit Parent Task
                      </button>
                    )}
                  </div>
                );
              })()}
              
              <form onSubmit={handleUpdateTask}>
                <div className="form-group">
                  <label htmlFor="edit-task-name">Task Name *</label>
                  <input
                    type="text"
                    id="edit-task-name"
                    className="form-control"
                    value={editingTask.name}
                    onChange={(e) => setEditingTask({...editingTask, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-description">Description</label>
                  <textarea
                    id="edit-task-description"
                    className="form-control"
                    rows={2}
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-parent">Parent Task</label>
                  <select
                    id="edit-task-parent"
                    className="form-control"
                    value={editingTask.parent_task_id || ''}
                    onChange={(e) => setEditingTask({...editingTask, parent_task_id: e.target.value ? Number(e.target.value) : null})}
                  >
                    <option value="">-- Root Task (No Parent) --</option>
                    {projectTasks
                      .filter(task => 
                        task.project_id === editingTask.project_id && 
                        task.id !== editingTask.id && // Can't be parent of itself
                        !(() => {
                          // Prevent circular dependencies: can't select a descendant as parent
                          const isDescendant = (potentialDescendantId: number, ancestorId: number): boolean => {
                            const task = projectTasks.find(t => t.id === potentialDescendantId);
                            if (!task) return false;
                            if (task.parent_task_id === ancestorId) return true;
                            if (task.parent_task_id) return isDescendant(task.parent_task_id, ancestorId);
                            return false;
                          };
                          return isDescendant(task.id, editingTask.id);
                        })()
                      )
                      .map(task => {
                        // Build path to show hierarchy
                        const getPath = (taskId: number): string => {
                          const t = projectTasks.find(x => x.id === taskId);
                          if (!t) return '';
                          if (t.parent_task_id) {
                            const parentPath = getPath(t.parent_task_id);
                            return parentPath ? `${parentPath} → ${t.name}` : t.name;
                          }
                          return t.name;
                        };
                        return (
                          <option key={task.id} value={task.id}>
                            {getPath(task.id)}
                          </option>
                        );
                      })}
                  </select>
                  <small className="form-text">Change the parent task to move this task to a different location in the hierarchy</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-milestone">Milestone</label>
                  <select
                    id="edit-task-milestone"
                    className="form-control"
                    value={editingTask.milestone_id ? String(editingTask.milestone_id) : ''}
                    onChange={(e) => setEditingTask({...editingTask, milestone_id: e.target.value ? Number(e.target.value) : null})}
                  >
                    <option value="">-- None --</option>
                    {(() => {
                      const filteredMilestones = projectMilestones.filter(milestone => 
                        editingTask.project_id && milestone.project_id === editingTask.project_id
                      );
                      return filteredMilestones
                        .sort((a, b) => a.order - b.order)
                        .map(milestone => (
                          <option key={milestone.id} value={milestone.id}>
                            {milestone.name} {milestone.target_date ? `(${new Date(milestone.target_date).toLocaleDateString()})` : ''}
                          </option>
                        ));
                    })()}
                  </select>
                  <small className="form-text">Link this task to a milestone for better tracking</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-due-date">Due Date</label>
                  <input
                    type="date"
                    id="edit-task-due-date"
                    className="form-control"
                    value={editingTask.due_date ? formatDateForInput(new Date(editingTask.due_date)) : ''}
                    onChange={(e) => setEditingTask({...editingTask, due_date: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-priority">Priority</label>
                  <select
                    id="edit-task-priority"
                    className="form-control"
                    value={editingTask.priority || 'medium'}
                    onChange={(e) => setEditingTask({...editingTask, priority: e.target.value as 'low' | 'medium' | 'high'})}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button 
                    type="button"
                    className="btn btn-info"
                    onClick={() => {
                      // Set parent task and open add task modal
                      setShowEditTaskModal(false);
                      setShowAddTaskModal(true);
                      // Pre-select this task as parent in the add form
                      setTimeout(() => {
                        const parentSelect = document.getElementById('task-parent') as HTMLSelectElement;
                        if (parentSelect && editingTask) {
                          parentSelect.value = editingTask.id.toString();
                        }
                      }, 100);
                    }}
                    title="Create a sub-task under this task"
                  >
                    ➕ Add Subtask
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      type="button"
                      className="btn btn-secondary" 
                      onClick={() => setShowEditTaskModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
