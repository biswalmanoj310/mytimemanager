#!/bin/bash

echo "🚀 MyTimeManager - New Laptop Setup"
echo "===================================="

# Configuration
PROJECT_NAME="mytimemanager"
GITHUB_REPO="https://github.com/biswalmanoj310/mytimemanager.git"
INSTALL_DIR="$HOME/projects"
BACKUP_DB_PATH="$HOME/Desktop/mytimemanager_migration_backup/mytimemanager.db"

echo ""
echo "📋 Setup Configuration:"
echo "  Project: $PROJECT_NAME"
echo "  Location: $INSTALL_DIR/$PROJECT_NAME"
echo "  Database: $BACKUP_DB_PATH"
echo ""

read -p "Continue with setup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

# Create projects directory
echo ""
echo "📁 Step 1: Creating project directory..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone repository
echo ""
echo "📦 Step 2: Cloning repository..."
if [ -d "$PROJECT_NAME" ]; then
    echo "⚠️  Project directory already exists. Skipping clone."
    cd "$PROJECT_NAME"
else
    git clone "$GITHUB_REPO"
    cd "$PROJECT_NAME"
    echo "✅ Repository cloned"
fi

# Copy database
echo ""
echo "💾 Step 3: Copying database..."
if [ -f "$BACKUP_DB_PATH" ]; then
    cp "$BACKUP_DB_PATH" "./backend/database/mytimemanager.db"
    echo "✅ Database copied"
else
    echo "⚠️  Database not found at $BACKUP_DB_PATH"
    echo "   You'll need to copy it manually later to:"
    echo "   $INSTALL_DIR/$PROJECT_NAME/backend/database/mytimemanager.db"
fi

# Setup Backend
echo ""
echo "🐍 Step 4: Setting up Python backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

echo "   Activating virtual environment..."
source venv/bin/activate

echo "   Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Backend setup complete"

# Setup Frontend
echo ""
echo "⚛️  Step 5: Setting up React frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "   Installing Node dependencies..."
    npm install
else
    echo "   Dependencies already installed"
fi

echo "✅ Frontend setup complete"

# Verify database
echo ""
echo "🔍 Step 6: Verifying database..."
cd ..
python3 -c "
import sqlite3
import os

db_path = 'backend/database/mytimemanager.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print('✅ Database connected successfully!')
    print('')
    print('📊 Your data:')
    
    tables = [
        ('Tasks', 'tasks'),
        ('Daily Entries', 'daily_time_entries'),
        ('Life Goals', 'life_goals'),
        ('Habits', 'habits'),
        ('Projects', 'projects'),
        ('Wishes', 'wishes')
    ]
    
    for name, table in tables:
        try:
            count = cursor.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            print(f'   {name}: {count}')
        except:
            print(f'   {name}: Table not found')
    
    conn.close()
else:
    print('❌ Database not found!')
    print(f'   Expected location: {db_path}')
    print('   Please copy your database backup there.')
"

# Create start scripts
echo ""
echo "📝 Step 7: Creating start scripts..."

# Backend start script
cat > start_backend.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")/backend"
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
EOF
chmod +x start_backend.sh

# Frontend start script
cat > start_frontend.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")/frontend"
npm run dev
EOF
chmod +x start_frontend.sh

# Combined start script
cat > start_all.sh <<'EOF'
#!/bin/bash
echo "🚀 Starting MyTimeManager..."
echo ""

# Start backend in background
echo "Starting backend server..."
cd "$(dirname "$0")/backend"
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend in background
echo "Starting frontend server..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

cd ..

echo ""
echo "🎉 MyTimeManager is running!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3003"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📋 Process IDs:"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop watching (servers will keep running)"
echo ""

# Keep script running
wait
EOF
chmod +x start_all.sh

echo "✅ Start scripts created:"
echo "   ./start_backend.sh  - Start backend only"
echo "   ./start_frontend.sh - Start frontend only"
echo "   ./start_all.sh      - Start both servers"

# Final instructions
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📂 Project location: $INSTALL_DIR/$PROJECT_NAME"
echo ""
echo "🚀 To start development:"
echo ""
echo "   cd $INSTALL_DIR/$PROJECT_NAME"
echo "   ./start_all.sh"
echo ""
echo "   Then open: http://localhost:3003"
echo ""
echo "📖 Or start servers separately:"
echo ""
echo "   Terminal 1: ./start_backend.sh"
echo "   Terminal 2: ./start_frontend.sh"
echo ""
echo "Happy coding! 🎨"
echo ""
