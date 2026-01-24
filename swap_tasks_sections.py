#!/usr/bin/env python3
"""
Swap Milestones and Frequency Tasks sections in Tasks.tsx
Current: All Tasks → Linked → Milestones → Frequency → Completed → Description
Target: All Tasks → Linked → Frequency → Milestones → Completed → Description
"""

def swap_milestones_frequency():
    file_path = 'frontend/src/pages/Tasks.tsx'
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Find section boundaries
    # Linked Tasks ends before Milestones section
    milestones_start = None
    for i, line in enumerate(lines):
        if 'className="project-milestones-section"' in line and i > 8600:
            # Go back to find the comment
            for j in range(i-5, i):
                if '{/* Tasks by Frequency Section - NEW */}' in lines[j]:
                    milestones_start = j
                    break
            if not milestones_start:
                milestones_start = i - 1  # Just before the div
            break
    
    if not milestones_start:
        print("❌ Could not find Milestones section start")
        return False
    
    print(f"✓ Milestones starts at line {milestones_start}")
    
    # Find where Milestones ends (before Frequency Tasks)
    frequency_start = None
    for i in range(milestones_start + 10, len(lines)):
        if 'className="project-frequency-tasks-section"' in lines[i]:
            # Go back to find comment
            for j in range(i-5, i):
                if '{/* Tasks by Frequency Section - NEW */}' in lines[j]:
                    frequency_start = j
                    break
            if not frequency_start:
                frequency_start = i - 1
            break
    
    if not frequency_start:
        print("❌ Could not find Frequency Tasks section start")
        return False
    
    print(f"✓ Frequency Tasks starts at line {frequency_start}")
    
    # Find where Frequency ends (before Completed Tasks)
    frequency_end = None
    for i in range(frequency_start + 10, len(lines)):
        if '{/* Completed Tasks Section */}' in lines[i]:
            frequency_end = i
            break
    
    if not frequency_end:
        print("❌ Could not find Frequency Tasks section end")
        return False
    
    print(f"✓ Frequency Tasks ends at line {frequency_end}")
    
    # Extract sections
    milestones_section = lines[milestones_start:frequency_start]
    frequency_section = lines[frequency_start:frequency_end]
    
    print(f"\n✓ Milestones section: {len(milestones_section)} lines")
    print(f"✓ Frequency section: {len(frequency_section)} lines")
    
    # Build new content: Linked → Frequency → Milestones → Completed
    new_lines = lines[:milestones_start] + frequency_section + milestones_section + lines[frequency_end:]
    
    new_content = '\n'.join(new_lines)
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print("\n✅ Successfully swapped sections!")
    print("New order: All Tasks → Linked Tasks → Frequency Tasks → Milestones → Completed → Description")
    return True

if __name__ == '__main__':
    success = swap_milestones_frequency()
    if not success:
        print("\n⚠️ Swap failed - file unchanged")
        exit(1)
