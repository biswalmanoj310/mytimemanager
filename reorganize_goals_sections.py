#!/usr/bin/env python3
"""
Reorganize sections in Goals.tsx
Target order: Goal Tasks → Linked → Supporting → Projects → Milestones → Why → Description
"""

import re

def reorganize_goals_sections():
    file_path = 'frontend/src/pages/Goals.tsx'
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find section boundaries by looking for section comments and their closing tags
    # We need to extract these sections:
    # 1. Projects Section (line 4215-4385)
    # 2. Why Statements (line 4387-4408)
    # 3. Description (line 4410-4427)
    # 4. Linked Tasks (line 4429-4551)
    # 5. Supporting Tasks (line 4553-4708)
    # 6. Milestones (line 4710-end of sections)
    
    # Split content into lines for easier manipulation
    lines = content.split('\n')
    
    # Find the end of Goal Tasks section (before Projects)
    goal_tasks_end = None
    for i, line in enumerate(lines):
        if i > 4200 and '              {/* Projects Section */' in line:
            goal_tasks_end = i
            break
    
    if not goal_tasks_end:
        print("❌ Could not find Goal Tasks end marker")
        return False
    
    print(f"✓ Found Goal Tasks end at line {goal_tasks_end}")
    
    # Extract sections (we need to find proper closing tags)
    # Let's find where each section starts and ends
    
    # Find Projects section
    projects_start = goal_tasks_end
    projects_end = None
    for i in range(projects_start + 1, len(lines)):
        if '              {/* Why Statements */' in lines[i]:
            projects_end = i
            break
    
    if not projects_end:
        print("❌ Could not find Projects end")
        return False
    
    print(f"✓ Projects: lines {projects_start}-{projects_end}")
    
    # Find Why section
    why_start = projects_end
    why_end = None
    for i in range(why_start + 1, len(lines)):
        if '              {/* Description */' in lines[i]:
            why_end = i
            break
    
    print(f"✓ Why: lines {why_start}-{why_end}")
    
    # Find Description section
    desc_start = why_end
    desc_end = None
    for i in range(desc_start + 1, len(lines)):
        if '              {/* Linked Tasks' in lines[i]:
            desc_end = i
            break
    
    print(f"✓ Description: lines {desc_start}-{desc_end}")
    
    # Find Linked Tasks section
    linked_start = desc_end
    linked_end = None
    for i in range(linked_start + 1, len(lines)):
        if '              {/* Supporting Tasks' in lines[i]:
            linked_end = i
            break
    
    print(f"✓ Linked Tasks: lines {linked_start}-{linked_end}")
    
    # Find Supporting Tasks section
    supporting_start = linked_end
    supporting_end = None
    for i in range(supporting_start + 1, len(lines)):
        if '              {/* Milestones */' in lines[i]:
            supporting_end = i
            break
    
    print(f"✓ Supporting Tasks: lines {supporting_start}-{supporting_end}")
    
    # Find Milestones section (goes until next major section or closing tag)
    milestones_start = supporting_end
    milestones_end = None
    brace_count = 0
    found_first_opening = False
    
    for i in range(milestones_start, len(lines)):
        line = lines[i]
        
        # Count braces to find where Milestones section closes
        if not found_first_opening and '<div className="goal-section milestones-section"' in line:
            found_first_opening = True
            brace_count = 0
        
        if found_first_opening:
            brace_count += line.count('{') - line.count('}')
            
            # When we close all braces and hit a </div> or next section comment
            if brace_count <= -1 and ('</div>' in line or '              )}' in line):
                milestones_end = i + 1
                break
    
    if not milestones_end:
        # Try finding next section marker instead
        for i in range(milestones_start + 100, min(milestones_start + 500, len(lines))):
            if '              {/*' in lines[i] and 'Milestones' not in lines[i]:
                milestones_end = i
                break
    
    if not milestones_end:
        print("❌ Could not find Milestones end - using manual offset")
        # Based on file reading, Milestones section is about 300 lines
        milestones_end = milestones_start + 350
    
    print(f"✓ Milestones: lines {milestones_start}-{milestones_end}")
    
    # Extract sections as text
    projects_section = '\n'.join(lines[projects_start:projects_end])
    why_section = '\n'.join(lines[why_start:why_end])
    desc_section = '\n'.join(lines[desc_start:desc_end])
    linked_section = '\n'.join(lines[linked_start:linked_end])
    supporting_section = '\n'.join(lines[supporting_start:supporting_end])
    milestones_section = '\n'.join(lines[milestones_start:milestones_end])
    
    # Build new order: Goal Tasks (unchanged) → Linked → Supporting → Projects → Milestones → Why → Description
    before_sections = '\n'.join(lines[:goal_tasks_end])
    after_sections = '\n'.join(lines[milestones_end:])
    
    new_content = before_sections + '\n'
    new_content += linked_section + '\n'
    new_content += supporting_section + '\n'
    new_content += projects_section + '\n'
    new_content += milestones_section + '\n'
    new_content += why_section + '\n'
    new_content += desc_section + '\n'
    new_content += after_sections
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print("\n✅ Successfully reorganized sections!")
    print("New order: Goal Tasks → Linked Tasks → Supporting Tasks → Projects → Milestones → Why → Description")
    return True

if __name__ == '__main__':
    success = reorganize_goals_sections()
    if not success:
        print("\n⚠️ Reorganization failed - file unchanged")
        exit(1)
