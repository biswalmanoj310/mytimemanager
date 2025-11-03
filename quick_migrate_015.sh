#!/bin/bash
# Quick migration script to apply migration 015
# Run this from the project root: ./quick_migrate_015.sh

DB_PATH="backend/database/mytimemanager.db"

echo "============================================================"
echo "  Applying Migration 015: Add Dream Links"
echo "============================================================"
echo ""

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

echo "📝 Applying migration SQL..."
sqlite3 "$DB_PATH" <<EOF
-- Add related_wish_id to projects table
ALTER TABLE projects ADD COLUMN related_wish_id INTEGER REFERENCES wishes(id) ON DELETE SET NULL;

-- Add related_wish_id to tasks table
ALTER TABLE tasks ADD COLUMN related_wish_id INTEGER REFERENCES wishes(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_related_wish ON projects(related_wish_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_wish ON tasks(related_wish_id);

-- Verify
.schema projects
.schema tasks
EOF

echo ""
echo "✅ Migration applied!"
echo ""
echo "Next steps:"
echo "1. Restart your backend server"
echo "2. Refresh your frontend"
echo "3. Tasks page should now load!"
echo ""
echo "============================================================"
