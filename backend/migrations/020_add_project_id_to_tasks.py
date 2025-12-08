"""
Migration 020: Add project_id to tasks table
Adds optional project_id foreign key to allow tasks to be associated with projects
"""

import sqlite3
import os

def run_migration():
    # Get database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Starting migration 020: Add project_id to tasks...")
        
        # Add project_id column to tasks table
        cursor.execute("""
            ALTER TABLE tasks 
            ADD COLUMN project_id INTEGER 
            REFERENCES projects(id) ON DELETE SET NULL
        """)
        
        conn.commit()
        print("✓ Migration completed successfully!")
        print("  - Added project_id column (INTEGER, nullable, references projects.id)")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠ Column 'project_id' already exists. Skipping migration.")
        else:
            print(f"✗ Migration failed: {e}")
            conn.rollback()
            raise
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
