"""
Migration: Change target_value from INTEGER to FLOAT to support decimal values like 0.3

This allows count-based tasks to have fractional target values.
"""

import sqlite3
import os

def run_migration():
    """Change target_value column from INTEGER to FLOAT"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🔄 Starting migration: Change target_value to FLOAT...")
        
        # SQLite doesn't support ALTER COLUMN TYPE directly
        # We need to:
        # 1. Create a new column
        # 2. Copy data
        # 3. Drop old column
        # 4. Rename new column
        
        # Step 1: Add new column with REAL type (SQLite's float)
        cursor.execute("ALTER TABLE tasks ADD COLUMN target_value_new REAL")
        print("✓ Added target_value_new column")
        
        # Step 2: Copy data from old column to new (INTEGER values will be converted to REAL)
        cursor.execute("UPDATE tasks SET target_value_new = CAST(target_value AS REAL)")
        print("✓ Copied data to new column")
        
        # Step 3: Drop old column
        # SQLite doesn't support DROP COLUMN in older versions
        # We'll need to recreate the table
        
        # Get the current schema
        cursor.execute("PRAGMA table_info(tasks)")
        columns = cursor.fetchall()
        
        # Create column definitions excluding target_value but including target_value_new as target_value
        col_defs = []
        for col in columns:
            col_name = col[1]
            col_type = col[2]
            not_null = col[3]
            default_val = col[4]
            is_pk = col[5]
            
            if col_name == 'target_value':
                continue  # Skip old column
            elif col_name == 'target_value_new':
                # Rename to target_value
                col_def = "target_value REAL"
            else:
                col_def = f"{col_name} {col_type}"
                if not_null:
                    col_def += " NOT NULL"
                if default_val is not None:
                    col_def += f" DEFAULT {default_val}"
                if is_pk:
                    col_def += " PRIMARY KEY"
            
            col_defs.append(col_def)
        
        # Get all data
        cursor.execute("SELECT * FROM tasks")
        all_data = cursor.fetchall()
        
        # Get column names for INSERT
        col_names = [col[1] for col in columns]
        col_names_str = ', '.join([name if name != 'target_value_new' else 'target_value' for name in col_names if name != 'target_value'])
        
        # Drop and recreate table
        cursor.execute("DROP TABLE IF EXISTS tasks_backup")
        cursor.execute(f"ALTER TABLE tasks RENAME TO tasks_backup")
        
        # Create new table (we'll use a simplified approach - let SQLAlchemy handle constraints)
        cursor.execute("""
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                pillar_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                sub_category_id INTEGER,
                task_type VARCHAR(20) NOT NULL DEFAULT 'time',
                allocated_minutes INTEGER NOT NULL,
                target_value REAL,
                unit VARCHAR(50),
                spent_minutes INTEGER DEFAULT 0,
                follow_up_frequency VARCHAR(20) NOT NULL,
                separately_followed BOOLEAN DEFAULT 0,
                is_daily_one_time BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                is_completed BOOLEAN DEFAULT 0,
                completed_at DATETIME,
                na_marked_at DATETIME,
                goal_id INTEGER,
                is_part_of_goal BOOLEAN DEFAULT 0,
                related_wish_id INTEGER,
                project_id INTEGER,
                parent_task_id INTEGER,
                why_reason TEXT,
                additional_whys TEXT,
                due_date DATETIME,
                priority INTEGER DEFAULT 10,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME,
                FOREIGN KEY (pillar_id) REFERENCES pillars (id),
                FOREIGN KEY (category_id) REFERENCES categories (id),
                FOREIGN KEY (sub_category_id) REFERENCES sub_categories (id),
                FOREIGN KEY (goal_id) REFERENCES life_goals (id),
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (parent_task_id) REFERENCES tasks (id)
            )
        """)
        print("✓ Created new tasks table with REAL target_value")
        
        # Copy data back
        cursor.execute("""
            INSERT INTO tasks
            SELECT id, name, description, pillar_id, category_id, sub_category_id,
                   task_type, allocated_minutes, target_value_new, unit, spent_minutes,
                   follow_up_frequency, separately_followed, is_daily_one_time,
                   is_active, is_completed, completed_at, na_marked_at,
                   goal_id, is_part_of_goal, related_wish_id, project_id, parent_task_id,
                   why_reason, additional_whys, due_date, priority, created_at, updated_at
            FROM tasks_backup
        """)
        print("✓ Copied data back to new table")
        
        # Drop backup
        cursor.execute("DROP TABLE tasks_backup")
        print("✓ Dropped backup table")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        print("   target_value now accepts decimal values like 0.3, 0.5, etc.")
        
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower() or "no such column" in str(e).lower():
            print("⚠️  Migration may have already been applied or column doesn't exist")
            print(f"   Error: {e}")
        else:
            print(f"❌ Migration failed: {e}")
            conn.rollback()
            raise
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
