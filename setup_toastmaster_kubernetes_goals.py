#!/usr/bin/env python3
"""
Setup script for Toastmaster DTM and Kubernetes Certification goals
Creates goals, projects, milestones, and tasks
"""

import sys
import os
from datetime import date, timedelta
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session
from app.database.config import SessionLocal, engine, Base
from app.models.models import Project, ProjectTask, ProjectMilestone
from app.models.goal import LifeGoal, LifeGoalMilestone, LifeGoalTask

def create_toastmaster_dtm_goal(db: Session):
    """
    Create Toastmaster DTM (Distinguished Toastmaster) goal
    Timeline: 8 months from today
    
    DTM Requirements:
    - Complete two Pathways (Level 5 in two different paths)
    - Serve as club officer for 12 months
    - Serve as district leader or mentor
    """
    today = date.today()
    target_date = today + timedelta(days=8*30)  # 8 months
    
    print("Creating Toastmaster DTM Goal...")
    
    # Create the main goal
    dtm_goal = LifeGoal(
        name="Achieve Toastmaster DTM (Distinguished Toastmaster)",
        description=(
            "Earn the highest recognition in Toastmasters International - the Distinguished Toastmaster (DTM) designation. "
            "This requires completing two Pathways to Level 5, serving as a club officer, and demonstrating leadership. "
            "Target completion: 8 months."
        ),
        start_date=today,
        target_date=target_date,
        status='in_progress',
        category='learning',
        priority='high',
        why_statements=[
            "Develop world-class public speaking and leadership skills",
            "Build confidence in presenting to any audience",
            "Gain recognition and credibility in professional communication",
            "Create networking opportunities with accomplished speakers",
            "Challenge myself to achieve excellence in communication"
        ],
        progress_percentage=0.0,
        time_allocated_hours=200.0  # Estimated total time investment
    )
    db.add(dtm_goal)
    db.flush()
    
    print(f"✓ Created goal: {dtm_goal.name} (ID: {dtm_goal.id})")
    
    # Create milestones
    milestones = [
        {
            "name": "Complete First Pathway to Level 3",
            "description": "Complete levels 1-3 in first chosen pathway (e.g., Dynamic Leadership or Strategic Relationships)",
            "target_date": today + timedelta(days=60),  # 2 months
            "metric": "3 levels completed",
            "order": 1
        },
        {
            "name": "Complete First Pathway to Level 5",
            "description": "Finish all 5 levels in the first pathway, including the final Level 5 project",
            "target_date": today + timedelta(days=120),  # 4 months
            "metric": "1 complete pathway",
            "order": 2
        },
        {
            "name": "Start Club Officer Role",
            "description": "Begin serving as a club officer (VP Education, VP Membership, President, Secretary, or Treasurer)",
            "target_date": today + timedelta(days=30),  # 1 month
            "metric": "Officer role accepted",
            "order": 3
        },
        {
            "name": "Complete Second Pathway to Level 3",
            "description": "Complete levels 1-3 in second chosen pathway",
            "target_date": today + timedelta(days=150),  # 5 months
            "metric": "3 levels completed",
            "order": 4
        },
        {
            "name": "Complete Second Pathway to Level 5",
            "description": "Finish all 5 levels in the second pathway",
            "target_date": today + timedelta(days=210),  # 7 months
            "metric": "2 complete pathways",
            "order": 5
        },
        {
            "name": "Complete 12 Months as Club Officer",
            "description": "Successfully serve full 12-month term as club officer with documented activities",
            "target_date": target_date,
            "metric": "12 months service",
            "order": 6
        },
        {
            "name": "Submit DTM Application",
            "description": "Complete and submit DTM application with all requirements verified",
            "target_date": target_date - timedelta(days=7),
            "metric": "Application submitted",
            "order": 7
        }
    ]
    
    for m_data in milestones:
        milestone = LifeGoalMilestone(
            goal_id=dtm_goal.id,
            **m_data
        )
        db.add(milestone)
    
    print(f"✓ Created {len(milestones)} milestones")
    
    # Create project for tracking pathway progress
    dtm_project = Project(
        name="DTM Pathways Completion Tracker",
        description="Track progress through two Toastmasters Pathways (Level 1-5 each)",
        goal_id=dtm_goal.id,
        start_date=today,
        target_completion_date=target_date,
        status='in_progress',
        is_active=True
    )
    db.add(dtm_project)
    db.flush()
    
    print(f"✓ Created project: {dtm_project.name} (ID: {dtm_project.id})")
    
    # Create project milestones
    project_milestones = [
        {"name": "Pathway 1 - Level 1 Complete", "target_date": today + timedelta(days=20), "order": 1},
        {"name": "Pathway 1 - Level 2 Complete", "target_date": today + timedelta(days=40), "order": 2},
        {"name": "Pathway 1 - Level 3 Complete", "target_date": today + timedelta(days=60), "order": 3},
        {"name": "Pathway 1 - Level 4 Complete", "target_date": today + timedelta(days=90), "order": 4},
        {"name": "Pathway 1 - Level 5 Complete", "target_date": today + timedelta(days=120), "order": 5},
        {"name": "Pathway 2 - Level 1 Complete", "target_date": today + timedelta(days=100), "order": 6},
        {"name": "Pathway 2 - Level 2 Complete", "target_date": today + timedelta(days=120), "order": 7},
        {"name": "Pathway 2 - Level 3 Complete", "target_date": today + timedelta(days=150), "order": 8},
        {"name": "Pathway 2 - Level 4 Complete", "target_date": today + timedelta(days=180), "order": 9},
        {"name": "Pathway 2 - Level 5 Complete", "target_date": today + timedelta(days=210), "order": 10},
    ]
    
    for pm_data in project_milestones:
        pm = ProjectMilestone(
            project_id=dtm_project.id,
            **pm_data
        )
        db.add(pm)
    
    print(f"✓ Created {len(project_milestones)} project milestones")
    
    # Create tasks for DTM goal
    goal_tasks = [
        {
            "name": "Weekly Club Meeting Attendance",
            "description": "Attend club meetings consistently to complete projects and gain experience",
            "task_type": "count",
            "target_value": 32,  # ~4 per month for 8 months
            "unit": "meetings",
            "priority": "high",
            "order": 1
        },
        {
            "name": "Pathway Projects Completion",
            "description": "Complete all required projects in both pathways (speech projects, evaluations, leadership tasks)",
            "task_type": "count",
            "target_value": 10,  # 5 per pathway
            "unit": "pathway levels",
            "priority": "high",
            "order": 2
        },
        {
            "name": "Leadership Role Duties",
            "description": "Fulfill all responsibilities of club officer role (organizing meetings, mentoring, admin tasks)",
            "task_type": "count",
            "target_value": 12,
            "unit": "monthly reports",
            "priority": "high",
            "order": 3
        },
        {
            "name": "Speech Practice Sessions",
            "description": "Practice speeches weekly before delivering at club meetings",
            "task_type": "count",
            "target_value": 30,
            "unit": "practice sessions",
            "priority": "medium",
            "order": 4
        },
        {
            "name": "Mentor/Guide New Members",
            "description": "Actively mentor at least 2-3 new members as part of leadership development",
            "task_type": "count",
            "target_value": 3,
            "unit": "mentees",
            "priority": "medium",
            "order": 5
        }
    ]
    
    for gt_data in goal_tasks:
        gt = LifeGoalTask(
            goal_id=dtm_goal.id,
            **gt_data
        )
        db.add(gt)
    
    print(f"✓ Created {len(goal_tasks)} goal tasks")
    print()
    
    return dtm_goal


def create_kubernetes_certifications_goal(db: Session):
    """
    Create Kubernetes Certifications goal
    - KCNA (Kubernetes and Cloud Native Associate) in 15 days
    - CKA (Certified Kubernetes Administrator) in next 15 days
    Total: 30 days
    """
    today = date.today()
    kcna_date = today + timedelta(days=15)
    cka_date = today + timedelta(days=30)
    
    print("Creating Kubernetes Certifications Goal...")
    
    # Create the main goal
    k8s_goal = LifeGoal(
        name="Achieve Kubernetes Certifications (KCNA + CKA)",
        description=(
            "Earn two prestigious Kubernetes certifications: "
            "KCNA (Kubernetes and Cloud Native Associate) within 15 days, "
            "followed by CKA (Certified Kubernetes Administrator) in the next 15 days. "
            "Total timeline: 30 days of intensive learning and practice."
        ),
        start_date=today,
        target_date=cka_date,
        status='in_progress',
        category='learning',
        priority='high',
        why_statements=[
            "Become proficient in cloud-native technologies and container orchestration",
            "Enhance career prospects with industry-recognized certifications",
            "Gain hands-on expertise in Kubernetes administration",
            "Stay competitive in the DevOps and cloud engineering field",
            "Build confidence in managing production Kubernetes clusters"
        ],
        progress_percentage=0.0,
        time_allocated_hours=100.0  # ~3-4 hours per day for 30 days
    )
    db.add(k8s_goal)
    db.flush()
    
    print(f"✓ Created goal: {k8s_goal.name} (ID: {k8s_goal.id})")
    
    # Create milestones
    milestones = [
        {
            "name": "Complete KCNA Study Material",
            "description": "Finish all KCNA learning modules: Cloud Native Architecture, Container Orchestration, Kubernetes Fundamentals",
            "target_date": today + timedelta(days=10),
            "metric": "100% material covered",
            "order": 1
        },
        {
            "name": "Pass KCNA Practice Exams",
            "description": "Score consistently above 85% on KCNA practice exams",
            "target_date": today + timedelta(days=13),
            "metric": "3 practice exams passed",
            "order": 2
        },
        {
            "name": "Pass KCNA Certification Exam",
            "description": "Successfully pass the KCNA certification exam",
            "target_date": kcna_date,
            "metric": "KCNA certified",
            "order": 3
        },
        {
            "name": "Complete CKA Study Material",
            "description": "Finish all CKA learning modules: Cluster Architecture, Workloads, Services, Storage, Troubleshooting",
            "target_date": today + timedelta(days=23),
            "metric": "100% material covered",
            "order": 4
        },
        {
            "name": "Complete CKA Hands-on Labs",
            "description": "Finish all practical labs: cluster setup, deployments, troubleshooting scenarios",
            "target_date": today + timedelta(days=26),
            "metric": "25+ labs completed",
            "order": 5
        },
        {
            "name": "Pass CKA Practice Exams",
            "description": "Score consistently above 75% on CKA practice exams (performance-based)",
            "target_date": today + timedelta(days=28),
            "metric": "3 practice exams passed",
            "order": 6
        },
        {
            "name": "Pass CKA Certification Exam",
            "description": "Successfully pass the CKA certification exam",
            "target_date": cka_date,
            "metric": "CKA certified",
            "order": 7
        }
    ]
    
    for m_data in milestones:
        milestone = LifeGoalMilestone(
            goal_id=k8s_goal.id,
            **m_data
        )
        db.add(milestone)
    
    print(f"✓ Created {len(milestones)} milestones")
    
    # Create KCNA project
    kcna_project = Project(
        name="KCNA Certification Preparation",
        description="15-day intensive preparation for Kubernetes and Cloud Native Associate (KCNA) certification",
        goal_id=k8s_goal.id,
        start_date=today,
        target_completion_date=kcna_date,
        status='in_progress',
        is_active=True
    )
    db.add(kcna_project)
    db.flush()
    
    print(f"✓ Created project: {kcna_project.name} (ID: {kcna_project.id})")
    
    # KCNA project tasks
    kcna_tasks = [
        {"name": "Study Kubernetes Fundamentals", "description": "Pods, Deployments, Services, ConfigMaps, Secrets", "due_date": today + timedelta(days=3), "priority": "high", "order": 1},
        {"name": "Study Cloud Native Architecture", "description": "Microservices, 12-factor apps, cloud native patterns", "due_date": today + timedelta(days=5), "priority": "high", "order": 2},
        {"name": "Study Container Orchestration", "description": "Docker, containerd, container runtimes, orchestration concepts", "due_date": today + timedelta(days=7), "priority": "high", "order": 3},
        {"name": "Study Observability & Security", "description": "Monitoring, logging, RBAC, network policies", "due_date": today + timedelta(days=9), "priority": "high", "order": 4},
        {"name": "Complete KCNA Practice Labs", "description": "Hands-on labs for all KCNA topics", "due_date": today + timedelta(days=11), "priority": "high", "order": 5},
        {"name": "Take KCNA Practice Exam #1", "description": "First full practice exam to identify weak areas", "due_date": today + timedelta(days=12), "priority": "high", "order": 6},
        {"name": "Review Weak Areas", "description": "Deep dive into topics where practice exam showed gaps", "due_date": today + timedelta(days=13), "priority": "high", "order": 7},
        {"name": "Take KCNA Practice Exam #2", "description": "Second practice exam for validation", "due_date": today + timedelta(days=14), "priority": "high", "order": 8},
        {"name": "Schedule KCNA Exam", "description": "Book exam slot for day 15", "due_date": today + timedelta(days=2), "priority": "high", "order": 9},
        {"name": "Take KCNA Certification Exam", "description": "Final certification exam", "due_date": kcna_date, "priority": "high", "order": 10},
    ]
    
    for task_data in kcna_tasks:
        task = ProjectTask(
            project_id=kcna_project.id,
            **task_data
        )
        db.add(task)
    
    print(f"✓ Created {len(kcna_tasks)} KCNA project tasks")
    
    # KCNA project milestones
    kcna_milestones = [
        {"name": "Day 5: Core Concepts Complete", "target_date": today + timedelta(days=5), "order": 1},
        {"name": "Day 10: All Theory Complete", "target_date": today + timedelta(days=10), "order": 2},
        {"name": "Day 13: Practice Exams Passed", "target_date": today + timedelta(days=13), "order": 3},
        {"name": "Day 15: KCNA Certified", "target_date": kcna_date, "order": 4},
    ]
    
    for pm_data in kcna_milestones:
        pm = ProjectMilestone(
            project_id=kcna_project.id,
            **pm_data
        )
        db.add(pm)
    
    print(f"✓ Created {len(kcna_milestones)} KCNA project milestones")
    
    # Create CKA project
    cka_project = Project(
        name="CKA Certification Preparation",
        description="15-day intensive preparation for Certified Kubernetes Administrator (CKA) certification - performance-based exam",
        goal_id=k8s_goal.id,
        start_date=kcna_date + timedelta(days=1),
        target_completion_date=cka_date,
        status='not_started',
        is_active=True
    )
    db.add(cka_project)
    db.flush()
    
    print(f"✓ Created project: {cka_project.name} (ID: {cka_project.id})")
    
    # CKA project tasks
    cka_tasks = [
        {"name": "Study Cluster Architecture", "description": "Control plane components, etcd, API server, scheduler, controller manager", "due_date": kcna_date + timedelta(days=2), "priority": "high", "order": 1},
        {"name": "Study Workloads & Scheduling", "description": "Deployments, StatefulSets, DaemonSets, Jobs, resource limits, node affinity", "due_date": kcna_date + timedelta(days=4), "priority": "high", "order": 2},
        {"name": "Study Services & Networking", "description": "Services, Ingress, NetworkPolicies, DNS, CNI plugins", "due_date": kcna_date + timedelta(days=6), "priority": "high", "order": 3},
        {"name": "Study Storage", "description": "PersistentVolumes, PersistentVolumeClaims, StorageClasses, volume types", "due_date": kcna_date + timedelta(days=7), "priority": "high", "order": 4},
        {"name": "Study Troubleshooting", "description": "Debug pods, services, networking issues, application issues", "due_date": kcna_date + timedelta(days=8), "priority": "high", "order": 5},
        {"name": "Practice Cluster Setup", "description": "Practice creating clusters from scratch using kubeadm", "due_date": kcna_date + timedelta(days=9), "priority": "high", "order": 6},
        {"name": "Complete CKA Practice Labs (20+)", "description": "Killer.sh, KodeKloud, or Linux Foundation labs", "due_date": kcna_date + timedelta(days=11), "priority": "high", "order": 7},
        {"name": "Take CKA Practice Exam #1", "description": "Full 2-hour performance-based practice exam", "due_date": kcna_date + timedelta(days=12), "priority": "high", "order": 8},
        {"name": "Review and Practice Weak Areas", "description": "Focus on areas with low scores in practice exam", "due_date": kcna_date + timedelta(days=13), "priority": "high", "order": 9},
        {"name": "Take CKA Practice Exam #2", "description": "Second full practice exam for validation", "due_date": kcna_date + timedelta(days=14), "priority": "high", "order": 10},
        {"name": "Schedule CKA Exam", "description": "Book exam slot for day 30", "due_date": kcna_date + timedelta(days=3), "priority": "high", "order": 11},
        {"name": "Take CKA Certification Exam", "description": "Final certification exam (2 hours, performance-based)", "due_date": cka_date, "priority": "high", "order": 12},
    ]
    
    for task_data in cka_tasks:
        task = ProjectTask(
            project_id=cka_project.id,
            **task_data
        )
        db.add(task)
    
    print(f"✓ Created {len(cka_tasks)} CKA project tasks")
    
    # CKA project milestones
    cka_milestones = [
        {"name": "Day 20: Core Admin Concepts Complete", "target_date": kcna_date + timedelta(days=5), "order": 1},
        {"name": "Day 23: All Theory Complete", "target_date": kcna_date + timedelta(days=8), "order": 2},
        {"name": "Day 26: Practice Labs Complete", "target_date": kcna_date + timedelta(days=11), "order": 3},
        {"name": "Day 28: Practice Exams Passed", "target_date": kcna_date + timedelta(days=13), "order": 4},
        {"name": "Day 30: CKA Certified", "target_date": cka_date, "order": 5},
    ]
    
    for pm_data in cka_milestones:
        pm = ProjectMilestone(
            project_id=cka_project.id,
            **pm_data
        )
        db.add(pm)
    
    print(f"✓ Created {len(cka_milestones)} CKA project milestones")
    
    # Create goal-level tasks for daily tracking
    goal_tasks = [
        {
            "name": "Daily Study Hours (KCNA Phase)",
            "description": "Dedicate focused study time each day during KCNA preparation",
            "task_type": "time",
            "allocated_minutes": 45 * 60,  # 45 hours total for 15 days (~3 hrs/day)
            "priority": "high",
            "due_date": kcna_date,
            "order": 1
        },
        {
            "name": "Daily Study Hours (CKA Phase)",
            "description": "Dedicate focused study time each day during CKA preparation",
            "task_type": "time",
            "allocated_minutes": 60 * 60,  # 60 hours total for 15 days (~4 hrs/day)
            "priority": "high",
            "due_date": cka_date,
            "order": 2
        },
        {
            "name": "Complete Practice Labs",
            "description": "Hands-on Kubernetes labs for both KCNA and CKA",
            "task_type": "count",
            "target_value": 30,
            "unit": "labs",
            "priority": "high",
            "order": 3
        },
        {
            "name": "Pass Practice Exams",
            "description": "Successfully pass all practice exams with good scores",
            "task_type": "count",
            "target_value": 6,  # 3 for KCNA, 3 for CKA
            "unit": "practice exams",
            "priority": "high",
            "order": 4
        }
    ]
    
    for gt_data in goal_tasks:
        gt = LifeGoalTask(
            goal_id=k8s_goal.id,
            **gt_data
        )
        db.add(gt)
    
    print(f"✓ Created {len(goal_tasks)} goal tasks")
    print()
    
    return k8s_goal


def main():
    """Main execution"""
    print("=" * 80)
    print("GOAL SETUP: Toastmaster DTM & Kubernetes Certifications")
    print("=" * 80)
    print()
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Create Toastmaster DTM goal
        dtm_goal = create_toastmaster_dtm_goal(db)
        
        # Create Kubernetes certifications goal
        k8s_goal = create_kubernetes_certifications_goal(db)
        
        # Commit all changes
        db.commit()
        
        print("=" * 80)
        print("SUCCESS! All goals, projects, milestones, and tasks created.")
        print("=" * 80)
        print()
        print("Summary:")
        print(f"1. {dtm_goal.name}")
        print(f"   - Target Date: {dtm_goal.target_date}")
        print(f"   - Status: {dtm_goal.status}")
        print(f"   - Milestones: 7")
        print(f"   - Projects: 1 (Pathways Completion Tracker)")
        print(f"   - Tasks: 5")
        print()
        print(f"2. {k8s_goal.name}")
        print(f"   - Target Date: {k8s_goal.target_date}")
        print(f"   - Status: {k8s_goal.status}")
        print(f"   - Milestones: 7")
        print(f"   - Projects: 2 (KCNA Prep + CKA Prep)")
        print(f"   - Tasks: 4")
        print()
        print("You can now view and manage these goals in your application!")
        print()
        
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
