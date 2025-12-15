#!/usr/bin/env python3
"""Add pillar grouping to Misc tasks tab"""

import re

filepath = 'frontend/src/pages/Tasks.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Find the section starting with "<!---Active Misc Tasks View -->" and ending with "{/* Completed Misc Tasks Section */}"
# We need to replace the entire task rendering logic

old_section_pattern = r'(              <div className="task-list">.*?</div>\s+)\s+}\s+</div>\s+{/\* Completed Misc Tasks Section \*/}'

# Read the current file to verify pattern
matches = list(re.finditer(r'{/\* Active Misc Tasks View', content))
print(f"Found {len(matches)} matches for Active Misc Tasks View comment")

# Find by looking for unique markers
start_marker = '              <div className="task-list">'
end_marker = '          {/* Completed Misc Tasks Section */'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Could not find markers. start_idx={start_idx}, end_idx={end_idx}")
    exit(1)

# Extract the section we're replacing
old_section = content[start_idx:end_idx]
print(f"Found section from {start_idx} to {end_idx}, length={len(old_section)}")
print("First 200 chars:")
print(old_section[:200])
print("\nLast 200 chars:")
print(old_section[-200:])

# Build the new section with pillar grouping
new_section = '''              <>
                {/* Hard Work Pillar Section */}
                {(() => {
                  const pillarTasks = miscTasks.filter(t => !t.parent_task_id && !t.is_completed && t.pillar_name === 'Hard Work').filter(task => {
                    if (projectTaskFilter === 'all') return true;
                    if (projectTaskFilter === 'in-progress') return !task.is_completed;
                    if (projectTaskFilter === 'overdue') {
                      return !task.is_completed && task.due_date && parseDateString(task.due_date.split('T')[0]) < new Date();
                    }
                    return true;
                  });
                  
                  if (pillarTasks.length === 0) return null;
                  
                  return (
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2563eb', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>
                        💼 Hard Work ({pillarTasks.length})
                      </h3>
                      <div className="task-list">
                        {pillarTasks.map((task) => (
                          <TaskNode 
                            key={`${task.id}-${task.is_completed}`} 
                            task={task} 
                            level={0}
                            allTasks={miscTasks}
                            expandedTasks={expandedMiscTasks}
                            onToggleExpand={(taskId: number) => {
                              const newExpanded = new Set(expandedMiscTasks);
                              if (newExpanded.has(taskId)) {
                                newExpanded.delete(taskId);
                              } else {
                                newExpanded.add(taskId);
                              }
                              setExpandedMiscTasks(newExpanded);
                              localStorage.setItem('expandedMiscTasks', JSON.stringify(Array.from(newExpanded)));
                            }}
                            onToggleComplete={async (taskId: number, currentStatus: boolean) => {
                              if (!currentStatus) {
                                const hasIncompleteSubtasks = miscTasks.some(t => t.parent_task_id === taskId && !t.is_completed);
                                if (hasIncompleteSubtasks) {
                                  alert('Cannot mark this task as done because it has incomplete subtasks. Please complete all subtasks first.');
                                  return;
                                }
                              }
                              try {
                                await api.put(`/api/tasks/${taskId}`, { is_completed: !currentStatus });
                                setMiscTasks([]);
                                await loadMiscTaskGroups();
                              } catch (err: any) {
                                console.error('Error toggling task:', err);
                              }
                            }}
                            onEdit={(task: ProjectTaskData) => { setSelectedTaskId(task.id); setIsTaskFormOpen(true); }}
                            onDelete={async (taskId: number) => {
                              const hasIncompleteSubtasks = miscTasks.some(t => t.parent_task_id === taskId && !t.is_completed);
                              if (hasIncompleteSubtasks) {
                                alert('Cannot delete this task because it has incomplete subtasks. Please complete or delete all subtasks first.');
                                return;
                              }
                              if (confirm('Are you sure you want to delete this task? This will also delete all subtasks.')) {
                                try {
                                  await api.delete(`/api/tasks/${taskId}`);
                                  await loadMiscTaskGroups();
                                } catch (err: any) {
                                  console.error('Error deleting task:', err);
                                  const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                                  alert('Failed to delete task: ' + errorMsg);
                                }
                              }
                            }}
                            onUpdateDueDate={async (taskId: number, newDueDate: string) => {
                              try {
                                await api.put(`/api/tasks/${taskId}`, { due_date: newDueDate });
                                await loadMiscTaskGroups();
                              } catch (err: any) {
                                console.error('Error updating due date:', err);
                                alert('Failed to update due date. Please try again.');
                              }
                            }}
                            getDueDateColorClass={getDueDateColorClass}
                            getTasksByParentId={(parentId: number | null) => miscTasks.filter(t => t.parent_task_id === parentId)}
                            onAddSubtask={(parentTask: ProjectTaskData) => { setEditingMiscTask(parentTask); setShowAddMiscTaskModal(true); }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Calmness Pillar Section */}
                {(() => {
                  const pillarTasks = miscTasks.filter(t => !t.parent_task_id && !t.is_completed && t.pillar_name === 'Calmness').filter(task => {
                    if (projectTaskFilter === 'all') return true;
                    if (projectTaskFilter === 'in-progress') return !task.is_completed;
                    if (projectTaskFilter === 'overdue') {
                      return !task.is_completed && task.due_date && parseDateString(task.due_date.split('T')[0]) < new Date();
                    }
                    return true;
                  });
                  
                  if (pillarTasks.length === 0) return null;
                  
                  return (
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#16a34a', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #22c55e' }}>
                        🧘 Calmness ({pillarTasks.length})
                      </h3>
                      <div className="task-list">
                        {pillarTasks.map((task) => (
                          <TaskNode 
                            key={`${task.id}-${task.is_completed}`} 
                            task={task} 
                            level={0}
                            allTasks={miscTasks}
                            expandedTasks={expandedMiscTasks}
                            onToggleExpand={(taskId: number) => {
                              const newExpanded = new Set(expandedMiscTasks);
                              if (newExpanded.has(taskId)) {
                                newExpanded.delete(taskId);
                              } else {
                                newExpanded.add(taskId);
                              }
                              setExpandedMiscTasks(newExpanded);
                              localStorage.setItem('expandedMiscTasks', JSON.stringify(Array.from(newExpanded)));
                            }}
                            onToggleComplete={async (taskId: number, currentStatus: boolean) => {
                              if (!currentStatus) {
                                const hasIncompleteSubtasks = miscTasks.some(t => t.parent_task_id === taskId && !t.is_completed);
                                if (hasIncompleteSubtasks) {
                                  alert('Cannot mark this task as done because it has incomplete subtasks. Please complete all subtasks first.');
                                  return;
                                }
                              }
                              try {
                                await api.put(`/api/tasks/${taskId}`, { is_completed: !currentStatus });
                                setMiscTasks([]);
                                await loadMiscTaskGroups();
                              } catch (err: any) {
                                console.error('Error toggling task:', err);
                              }
                            }}
                            onEdit={(task: ProjectTaskData) => { setSelectedTaskId(task.id); setIsTaskFormOpen(true); }}
                            onDelete={async (taskId: number) => {
                              const hasIncompleteSubtasks = miscTasks.some(t => t.parent_task_id === taskId && !t.is_completed);
                              if (hasIncompleteSubtasks) {
                                alert('Cannot delete this task because it has incomplete subtasks. Please complete or delete all subtasks first.');
                                return;
                              }
                              if (confirm('Are you sure you want to delete this task? This will also delete all subtasks.')) {
                                try {
                                  await api.delete(`/api/tasks/${taskId}`);
                                  await loadMiscTaskGroups();
                                } catch (err: any) {
                                  console.error('Error deleting task:', err);
                                  const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                                  alert('Failed to delete task: ' + errorMsg);
                                }
                              }
                            }}
                            onUpdateDueDate={async (taskId: number, newDueDate: string) => {
                              try {
                                await api.put(`/api/tasks/${taskId}`, { due_date: newDueDate });
                                await loadMiscTaskGroups();
                              } catch (err: any) {
                                console.error('Error updating due date:', err);
                                alert('Failed to update due date. Please try again.');
                              }
                            }}
                            getDueDateColorClass={getDueDateColorClass}
                            getTasksByParentId={(parentId: number | null) => miscTasks.filter(t => t.parent_task_id === parentId)}
                            onAddSubtask={(parentTask: ProjectTaskData) => { setEditingMiscTask(parentTask); setShowAddMiscTaskModal(true); }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Family Pillar Section */}
                {(() => {
                  const pillarTasks = miscTasks.filter(t => !t.parent_task_id && !t.is_completed && t.pillar_name === 'Family').filter(task => {
                    if (projectTaskFilter === 'all') return true;
                    if (projectTaskFilter === 'in-progress') return !task.is_completed;
                    if (projectTaskFilter === 'overdue') {
                      return !task.is_completed && task.due_date && parseDateString(task.due_date.split('T')[0]) < new Date();
                    }
                    return true;
                  });
                  
                  if (pillarTasks.length === 0) return null;
                  
                  return (
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#9333ea', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #a855f7' }}>
                        👨‍👩‍👦 Family ({pillarTasks.length})
                      </h3>
                      <div className="task-list">
                        {pillarTasks.map((task) => (
                          <TaskNode 
                            key={`${task.id}-${task.is_completed}`} 
                            task={task} 
                            level={0}
                            allTasks={miscTasks}
                            expandedTasks={expandedMiscTasks}
                            onToggleExpand={(taskId: number) => {
                              const newExpanded = new Set(expandedMiscTasks);
                              if (newExpanded.has(taskId)) {
                                newExpanded.delete(taskId);
                              } else {
                                newExpanded.add(taskId);
                              }
                              setExpandedMiscTasks(newExpanded);
                              localStorage.setItem('expandedMiscTasks', JSON.stringify(Array.from(newExpanded)));
                            }}
                            onToggleComplete={async (taskId: number, currentStatus: boolean) => {
                              if (!currentStatus) {
                                const hasIncompleteSubtasks = miscTasks.some(t => t.parent_task_id === taskId && !t.is_completed);
                                if (hasIncompleteSubtasks) {
                                  alert('Cannot mark this task as done because it has incomplete subtasks. Please complete all subtasks first.');
                                  return;
                                }
                              }
                              try {
                                await api.put(`/api/tasks/${taskId}`, { is_completed: !currentStatus });
                                setMiscTasks([]);
                                await loadMiscTaskGroups();
                              } catch (err: any) {
                                console.error('Error toggling task:', err);
                              }
                            }}
                            onEdit={(task: ProjectTaskData) => { setSelectedTaskId(task.id); setIsTaskFormOpen(true); }}
                            onDelete={async (taskId: number) => {
                              const hasIncompleteSubtasks = miscTasks.some(t => t.parent_task_id === taskId && !t.is_completed);
                              if (hasIncompleteSubtasks) {
                                alert('Cannot delete this task because it has incomplete subtasks. Please complete or delete all subtasks first.');
                                return;
                              }
                              if (confirm('Are you sure you want to delete this task? This will also delete all subtasks.')) {
                                try {
                                  await api.delete(`/api/tasks/${taskId}`);
                                  await loadMiscTaskGroups();
                                } catch (err: any) {
                                  console.error('Error deleting task:', err);
                                  const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                                  alert('Failed to delete task: ' + errorMsg);
                                }
                              }
                            }}
                            onUpdateDueDate={async (taskId: number, newDueDate: string) => {
                              try {
                                await api.put(`/api/tasks/${taskId}`, { due_date: newDueDate });
                                await loadMiscTaskGroups();
                              } catch (err: any) {
                                console.error('Error updating due date:', err);
                                alert('Failed to update due date. Please try again.');
                              }
                            }}
                            getDueDateColorClass={getDueDateColorClass}
                            getTasksByParentId={(parentId: number | null) => miscTasks.filter(t => t.parent_task_id === parentId)}
                            onAddSubtask={(parentTask: ProjectTaskData) => { setEditingMiscTask(parentTask); setShowAddMiscTaskModal(true); }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          '''

# Replace
new_content = content[:start_idx] + new_section + content[end_idx:]

# Write back
with open(filepath, 'w') as f:
    f.write(new_content)

print("✓ Replacement complete!")
print(f"File length changed from {len(content)} to {len(new_content)} bytes")
