"""
Migration: Add goal_id and project_id to challenges table
Allows linking challenges to goals and projects for better organization
"""
import sqlite3
import os

def run_migration():
    """Add goal_id and project_id columns to challenges table"""
    
    # Get database path - using the correct mytimemanager.db location
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    print(f"📂 Using database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(challenges)")
        columns = [col[1] for col in cursor.fetchall()]
        
        changes_made = False
        
        if 'goal_id' not in columns:
            print("➕ Adding goal_id column to challenges table...")
            cursor.execute('''
                ALTER TABLE challenges 
                ADD COLUMN goal_id INTEGER 
                REFERENCES goals(id) ON DELETE SET NULL
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_challenges_goal_id ON challenges(goal_id)')
            changes_made = True
            print("✅ Added goal_id column")
        else:
            print("ℹ️  goal_id column already exists")
        
        if 'project_id' not in columns:
            print("➕ Adding project_id column to challenges table...")
            cursor.execute('''
                ALTER TABLE challenges 
                ADD COLUMN project_id INTEGER 
                REFERENCES projects(id) ON DELETE SET NULL
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_challenges_project_id ON challenges(project_id)')
            changes_made = True
            print("✅ Added project_id column")
        else:
            print("ℹ️  project_id column already exists")
        
        if changes_made:
            conn.commit()
            print("\n✅ Migration completed successfully!")
            print("📊 Challenges can now be linked to Goals and Projects")
        else:
            print("\n✅ No changes needed - migration already applied")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("🔄 Migration: Add Goal and Project Links to Challenges")
    print("=" * 60)
    success = run_migration()
    exit(0 if success else 1)
