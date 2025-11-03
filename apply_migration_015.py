#!/usr/bin/env python3
"""
Apply migration 015 to add related_wish_id columns to projects and tasks tables.
Run this from the project root: python apply_migration_015.py
"""

import sqlite3
import os

# Database path
DB_PATH = "backend/database/mytimemanager.db"

def apply_migration():
    """Apply migration 015"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        return False
    
    try:
        # Connect to database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("🔍 Checking if migration is needed...")
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(projects)")
        projects_columns = [col[1] for col in cursor.fetchall()]
        
        cursor.execute("PRAGMA table_info(tasks)")
        tasks_columns = [col[1] for col in cursor.fetchall()]
        
        projects_needs_column = 'related_wish_id' not in projects_columns
        tasks_needs_column = 'related_wish_id' not in tasks_columns
        
        if not projects_needs_column and not tasks_needs_column:
            print("✅ Migration already applied! Columns exist.")
            return True
        
        print("\n📝 Applying Migration 015...")
        
        # Add column to projects if needed
        if projects_needs_column:
            print("  - Adding related_wish_id to projects table...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN related_wish_id INTEGER 
                REFERENCES wishes(id) ON DELETE SET NULL
            """)
            print("  ✅ Added related_wish_id to projects")
        else:
            print("  ⏭️  Projects table already has related_wish_id")
        
        # Add column to tasks if needed
        if tasks_needs_column:
            print("  - Adding related_wish_id to tasks table...")
            cursor.execute("""
                ALTER TABLE tasks 
                ADD COLUMN related_wish_id INTEGER 
                REFERENCES wishes(id) ON DELETE SET NULL
            """)
            print("  ✅ Added related_wish_id to tasks")
        else:
            print("  ⏭️  Tasks table already has related_wish_id")
        
        # Create indexes
        print("  - Creating indexes...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_projects_related_wish 
            ON projects(related_wish_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tasks_related_wish 
            ON tasks(related_wish_id)
        """)
        print("  ✅ Created indexes")
        
        # Commit changes
        conn.commit()
        print("\n✨ Migration 015 applied successfully!")
        print("\n📊 Verifying changes...")
        
        # Verify
        cursor.execute("PRAGMA table_info(projects)")
        projects_columns = [col[1] for col in cursor.fetchall()]
        
        cursor.execute("PRAGMA table_info(tasks)")
        tasks_columns = [col[1] for col in cursor.fetchall()]
        
        if 'related_wish_id' in projects_columns and 'related_wish_id' in tasks_columns:
            print("✅ Verification passed! Both columns exist.")
            return True
        else:
            print("⚠️  Verification failed. Please check manually.")
            return False
        
    except sqlite3.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False
    finally:
        if conn:
            conn.close()
            print("\n🔒 Database connection closed.")

if __name__ == "__main__":
    print("=" * 60)
    print("  Migration 015: Add Dream Links to Projects & Tasks")
    print("=" * 60)
    print()
    
    success = apply_migration()
    
    print()
    print("=" * 60)
    if success:
        print("✅ MIGRATION COMPLETED")
        print()
        print("Next steps:")
        print("1. Restart your backend server")
        print("2. Refresh your frontend")
        print("3. Tasks page should now load successfully!")
    else:
        print("❌ MIGRATION FAILED")
        print()
        print("Please check the error messages above and try again.")
    print("=" * 60)
