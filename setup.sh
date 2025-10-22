#!/bin/bash

# MyTimeManager - Project Setup Script
# This script creates the complete folder structure and initializes the project

echo "🚀 Setting up MyTimeManager Project..."
echo "======================================"

# Create main directory structure
echo "📁 Creating folder structure..."

# Backend structure
mkdir -p backend/app/models
mkdir -p backend/app/routes
mkdir -p backend/app/services
mkdir -p backend/app/utils
mkdir -p backend/app/database
mkdir -p backend/tests

# Frontend structure
mkdir -p frontend/public
mkdir -p frontend/src/components/dashboard
mkdir -p frontend/src/components/tasks
mkdir -p frontend/src/components/goals
mkdir -p frontend/src/components/pillars
mkdir -p frontend/src/components/common
mkdir -p frontend/src/pages
mkdir -p frontend/src/services
mkdir -p frontend/src/utils
mkdir -p frontend/src/styles
mkdir -p frontend/src/assets/images
mkdir -p frontend/src/hooks

# Database directory
mkdir -p database

# Documentation
mkdir -p docs

echo "✅ Folder structure created!"

# Create .gitignore
echo "📝 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Environment variables
.env
.env.local
.env.development
.env.production

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST
venv/
env/
ENV/
env.bak/
venv.bak/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnp/
.pnp.js

# Testing
.coverage
.pytest_cache/
htmlcov/
.tox/
coverage/

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Database
*.db
*.sqlite
*.sqlite3
database/*.db
database/*.sqlite

# Logs
*.log
logs/

# Build files
frontend/build/
frontend/dist/
*.min.js
*.min.css

# Temporary files
tmp/
temp/
*.tmp

# OS
Thumbs.db
.DS_Store
EOF

echo "✅ .gitignore created!"

# Create .env.example
echo "📝 Creating .env.example..."
cat > .env.example << 'EOF'
# Application Settings
APP_NAME=MyTimeManager
APP_ENV=development
DEBUG=True

# Database Configuration
DATABASE_URL=sqlite:///./database/mytimemanager.db
# For future PostgreSQL migration:
# DATABASE_URL=postgresql://user:password@localhost:5432/mytimemanager

# Backend Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
SECRET_KEY=your-secret-key-change-this-in-production

# Frontend Configuration
FRONTEND_PORT=3000
REACT_APP_API_URL=http://localhost:8000

# Time Management Settings
DEFAULT_PILLAR_HOURS=8
TOTAL_DAY_HOURS=24
TIME_SLOT_MINUTES=30

# CANI Concept Settings
CANI_ENABLED=True
CANI_IMPROVEMENT_PERCENTAGE=1

# Features
ENABLE_ANALYTICS=True
ENABLE_GOALS=True
ENABLE_MOTIVATIONAL_QUOTES=True
EOF

echo "✅ .env.example created!"

# Create actual .env from example
cp .env.example .env
echo "✅ .env created from template!"

# Create README.md
echo "📝 Creating README.md..."
cat > README.md << 'EOF'
# MyTimeManager 🎯

A comprehensive time and task management application based on Tim Robbins' CANI (Constant And Never-ending Improvement) concept, NLP principles, and proven time management methodologies.

## 🌟 Core Philosophy

### Three Pillars of Life
- **Hard Work** (8 hours): Professional development and career growth
- **Calmness** (8 hours): Rest, meditation, and self-care
- **Family** (8 hours): Relationships and personal connections

## ✨ Features

- 📊 Three-pillar time allocation system
- 🎯 Goal and task management
- 📈 Progress tracking with visual dashboards
- 📅 Calendar heatmap for completion tracking
- 🎨 Inspirational UI with motivational quotes
- ⏱️ 30-minute time slot tracking
- 📉 Detailed analytics and reports

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/biswalmanoj310/mytimemanager.git
cd mytimemanager
```

2. Set up the backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize the database:
```bash
cd backend
python -m app.database.init_db
```

### Running the Application

1. Start the backend:
```bash
cd backend
uvicorn app.main:app --reload
```

2. Start the frontend:
```bash
cd frontend
npm start
```

3. Open your browser to `http://localhost:3000`

## 📁 Project Structure

```
mytimemanager/
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── models/   # Database models
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── utils/    # Helper functions
│   └── tests/        # Backend tests
├── frontend/         # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── styles/
├── database/         # SQLite database files
└── docs/            # Documentation
```

## 🎯 Development Milestones

- [ ] Milestone 1: Project setup and basic structure
- [ ] Milestone 2: Database and models
- [ ] Milestone 3: Three pillars system
- [ ] Milestone 4: Task management
- [ ] Milestone 5: Goal management
- [ ] Milestone 6: Dashboards and analytics
- [ ] Milestone 7: UI/UX enhancements

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

Manoj Biswal - @biswalmanoj310
EOF

echo "✅ README.md created!"

# Initialize git repository
echo "🔧 Initializing Git repository..."
if [ -d .git ]; then
    echo "⚠️  Git repository already exists. Skipping git init."
else
    git init
    echo "✅ Git repository initialized!"
fi

# Create initial commit
echo "📦 Creating initial commit..."
git add .
git commit -m "Initial commit: Project structure and configuration setup

- Created folder structure for backend and frontend
- Added .gitignore for Python and Node.js
- Added .env.example with configuration template
- Added comprehensive README.md
- Implemented three-pillar time management structure
- Based on Tim Robbins CANI concept"

echo "✅ Initial commit created!"

# Add remote origin (optional - user will need to update URL)
echo ""
echo "🔗 To connect to your GitHub repository, run:"
echo "git remote add origin https://github.com/biswalmanoj310/mytimemanager.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""

echo "======================================"
echo "✨ Setup Complete! ✨"
echo "======================================"
echo ""
echo "📋 Next Steps:"
echo "1. Review and update .env file with your settings"
echo "2. Connect to GitHub repository (commands shown above)"
echo "3. Run 'cd backend && python -m venv venv' to create Python virtual environment"
echo "4. Run 'source backend/venv/bin/activate' to activate virtual environment"
echo "5. Ready for Requirement 02: Database setup"
echo ""
echo "🎯 Happy Time Managing!"
