"""
Migration 041: Add Wish Tasks table
Adds dream_tasks feature with parent-child hierarchy similar to project tasks
"""

import sqlite3
import os


def run_migration():
    """Create wish_tasks table with parent-child structure"""
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'database', 
        'mytimemanager.db'
    )
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='wish_tasks'
        """)
        if cursor.fetchone():
            print("⚠ wish_tasks table already exists, skipping...")
            return
        
        # Create wish_tasks table
        print("Creating wish_tasks table...")
        cursor.execute("""
            CREATE TABLE wish_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wish_id INTEGER NOT NULL,
                parent_task_id INTEGER,
                name VARCHAR(300) NOT NULL,
                description TEXT,
                due_date TIMESTAMP,
                priority VARCHAR(10) DEFAULT 'medium' NOT NULL,
                is_completed BOOLEAN DEFAULT 0 NOT NULL,
                completed_at TIMESTAMP,
                "order" INTEGER DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_task_id) REFERENCES wish_tasks(id) ON DELETE CASCADE
            )
        """)
        
        # Create indexes
        print("Creating indexes...")
        cursor.execute("CREATE INDEX idx_wish_tasks_wish_id ON wish_tasks(wish_id)")
        cursor.execute("CREATE INDEX idx_wish_tasks_parent_task_id ON wish_tasks(parent_task_id)")
        cursor.execute("CREATE INDEX idx_wish_tasks_is_completed ON wish_tasks(is_completed)")
        cursor.execute("CREATE INDEX idx_wish_tasks_due_date ON wish_tasks(due_date)")
        
        conn.commit()
        print("✓ Migration 041 completed successfully!")
        print("  - wish_tasks table created")
        print("  - Indexes added for performance")
        
    except sqlite3.OperationalError as e:
        if "already exists" in str(e).lower():
            print("⚠ Table or index already exists, skipping...")
        else:
            raise
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
