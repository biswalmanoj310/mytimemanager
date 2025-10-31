"""
Migration script to create misc task groups and items tables
Run this from the backend directory: python3 migrate_create_misc_tasks.py
"""
import sqlite3
import os

def migrate():
    # Get database path
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'mytimemanager.db')
    
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Creating misc_task_groups table...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS misc_task_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                pillar_id INTEGER,
                category_id INTEGER,
                goal_id INTEGER,
                due_date TIMESTAMP,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                is_completed BOOLEAN NOT NULL DEFAULT 0,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (pillar_id) REFERENCES pillars(id) ON DELETE SET NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                FOREIGN KEY (goal_id) REFERENCES life_goals(id) ON DELETE SET NULL
            )
        ''')
        print("✅ misc_task_groups table created")
        
        print("Creating indexes for misc_task_groups...")
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_groups_id ON misc_task_groups(id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_groups_name ON misc_task_groups(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_groups_due_date ON misc_task_groups(due_date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_groups_is_completed ON misc_task_groups(is_completed)')
        print("✅ Indexes for misc_task_groups created")
        
        print("Creating misc_task_items table...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS misc_task_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                parent_task_id INTEGER,
                name VARCHAR(300) NOT NULL,
                description TEXT,
                due_date TIMESTAMP,
                priority VARCHAR(10) NOT NULL DEFAULT 'medium',
                is_completed BOOLEAN NOT NULL DEFAULT 0,
                completed_at TIMESTAMP,
                "order" INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES misc_task_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_task_id) REFERENCES misc_task_items(id) ON DELETE CASCADE
            )
        ''')
        print("✅ misc_task_items table created")
        
        print("Creating indexes for misc_task_items...")
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_items_id ON misc_task_items(id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_items_group_id ON misc_task_items(group_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_items_parent_task_id ON misc_task_items(parent_task_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_items_due_date ON misc_task_items(due_date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_misc_task_items_is_completed ON misc_task_items(is_completed)')
        print("✅ Indexes for misc_task_items created")
        
        conn.commit()
        print("\n🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
