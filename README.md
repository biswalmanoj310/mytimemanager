# MyTimeManager 🎯

A comprehensive time and task management application based on the CANI (Constant And Never-ending Improvement) philosophy. Designed for families, professionals, and students with flexible time block configurations.

## 🌟 Core Philosophy

### Three Pillars of Life (Customizable)
- **Hard Work** (8 hours): Professional development and career growth
- **Calmness** (8 hours): Rest, meditation, and self-care
- **Family** (8 hours): Relationships and personal connections

## ✨ Key Features

### 🎯 Time Management
- **Flexible Time Blocks**: Switch between 24-hour professional view and kid-friendly blocks (School Day, Work Day, etc.)
- **Multi-Profile Support**: Separate configurations for family members
- **Smart Task Tracking**: Daily, Weekly, Monthly, Yearly, and One-Time tasks
- **NA (Not Applicable) Days**: Mark tasks as not applicable when needed

### 📊 Organization & Planning
- **Life Goals**: 1-10 year goals with milestones and progress tracking
- **Goal Projects**: Structured projects with dependencies and phase management
- **Habit Tracker**: 4 tracking modes (daily streak, occurrences, with values, aggregate total)
- **Challenges**: 7-30 day experiments with auto-sync from habits
- **Wishes**: Dream parking lot that can graduate to goals

### 📈 Analytics & Insights
- **Dynamic Dashboards**: Real-time visualization of time allocation
- **Calendar Heatmaps**: Visual completion tracking
- **Comparative Analytics**: Week-over-week and month-over-month comparisons
- **Progress Reports**: Detailed insights across all pillars

### 🎨 User Experience
- **Kid-Friendly Mode**: AM/PM time format, simple blocks (6-8 AM "Morning", 8-3 PM "School")
- **Professional Mode**: 24-hour format with hourly precision
- **Color-Coded Pillars**: Visual organization with emojis (💼🧘👨‍👩‍👦)
- **Responsive Design**: Works on desktop, tablet, and mobile

## 🚀 Quick Start (Docker - Recommended)

### For End Users (Your Daughter's Laptop)

**See [QUICK_SETUP.md](QUICK_SETUP.md) for step-by-step instructions.**

1. **Install Docker Desktop** (one-time):
   - Windows: https://www.docker.com/products/docker-desktop
   - Mac: https://www.docker.com/products/docker-desktop

2. **Get the code**:
   - Download ZIP from GitHub or `git clone`

3. **Start the app**:
   - Windows: Double-click `start-docker.bat`
   - Mac/Linux: Run `./start-docker.sh`

4. **Open browser**: http://localhost:3000

5. **Stop the app**:
   - Windows: Double-click `stop-docker.bat`
   - Mac/Linux: Run `./stop-docker.sh`

**That's it!** No Python, Node.js, or dependencies to install manually.

---

## 💻 Development Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/biswalmanoj310/mytimemanager.git
cd mytimemanager
```

2. Set up the backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

4. Initialize the database (migrations run automatically):
```bash
cd backend
source venv/bin/activate
python migrations/024_add_time_blocks.py  # Run latest migration
```

### Running the Application (Development)

**Option 1: Use convenience scripts**
```bash
# Start both backend and frontend
./start_app.sh

# Or start individually
./start_backend.sh  # Backend on port 8000
./start_frontend.sh # Frontend on port 3000
```

**Option 2: Manual start**
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

3. Open your browser to http://localhost:3000

---

## 📦 Production Deployment (Docker)

See [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) for complete instructions.

```bash
# Build and start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f
```

**Ports:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 🗂️ Project Structure

```
mytimemanager/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routes/         # API endpoints (30+ routers)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── services/       # Business logic (24+ services)
│   │   └── database/       # Database config
│   ├── migrations/         # Database migrations (024 migrations)
│   └── database/           # SQLite database
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # Global state management
│   │   └── services/      # API client
├── docker-compose.yml      # Docker orchestration
├── Dockerfile.backend      # Backend container
├── Dockerfile.frontend     # Frontend container
├── start-docker.bat        # Windows Docker launcher
├── start-docker.sh         # Mac/Linux Docker launcher
└── DOCKER_SETUP_GUIDE.md   # Deployment guide
```

---

## 🎯 Usage Scenarios

### For Engineering Professionals (You)
- Use **Standard 24-hour** time blocks (default)
- Hour-by-hour monitoring: 0-23 hours
- Track tasks with allocated vs spent minutes
- Analyze productivity patterns in Analytics

### For Students (Daughter)
1. Go to "My Day Design" → "Time Blocks"
2. Select "School Day" template
3. Activate it
4. Daily tab now shows:
   - 6-8 AM: Morning
   - 8-3 PM: School (can enter Math, Play, Lunch inside)
   - 3-5 PM: After School
   - 5-9 PM: Family Time
   - 9-6 AM: Sleep

### For Teachers (Wife)
- Use "Teaching Day" template
- 7-3 PM teaching hours with prep/grading blocks
- Track lesson planning, student meetings, grading

---

## 🔧 Configuration

### Database Profiles
- **Production Profile**: Your main data
- **Test Profiles**: Family member data (daughter, wife, etc.)
- Switch via "My Day Design" → "Database Profiles"

### Time Block Customization
1. Navigate to "My Day Design" → "Time Blocks"
2. Click "Create Custom Configuration"
3. Add blocks with start/end hours, labels, colors
4. Choose 24h or 12h (AM/PM) format
5. Activate your configuration

### Pillar Customization
1. Go to "My Day Design" → "Life Pillars"
2. Create/edit pillars (default: Hard Work, Calmness, Family)
3. Set allocated minutes per day (default: 480 = 8 hours)
4. Add categories under each pillar

---

## 📚 Documentation

- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete feature catalog (606 lines)
- [TASK_LIFECYCLE_DOCUMENTATION.md](TASK_LIFECYCLE_DOCUMENTATION.md) - Task system deep dive (513 lines)
- [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) - Deployment instructions
- [QUICK_SETUP.md](QUICK_SETUP.md) - End-user quick start
- [DATABASE_INFO.md](DATABASE_INFO.md) - Backup & restore procedures
- [QUICK_TEST_CHECKLIST.md](QUICK_TEST_CHECKLIST.md) - Testing guide

---

## 🛠️ Technology Stack

**Backend:**
- FastAPI 0.104.1 - Modern Python web framework
- SQLAlchemy 2.0.23 - ORM and database toolkit
- SQLite - Lightweight database (easily migrates to PostgreSQL/MySQL)
- Pydantic - Data validation

**Frontend:**
- React 18.2 - UI framework
- TypeScript 5.3.3 - Type-safe JavaScript
- Vite 5.0.8 - Build tool and dev server
- Recharts - Analytics visualizations

**Deployment:**
- Docker - Containerization
- Docker Compose - Multi-container orchestration

---

## 💾 Data Management

### Automatic Backups (Docker Only)

Docker deployments include automatic daily backups:
- **Schedule**: Daily at 2:00 AM
- **Retention**: 30 days
- **Location**: `backend/database/backups/`
- **Format**: Compressed `.db.gz` files

**Manual backup anytime:**
```bash
# Windows
backup-now.bat

# Mac/Linux
./backup-now.sh
```

**Restore from backup:**
```bash
# Windows
restore-backup.bat

# Mac/Linux
./restore-backup.sh
```

See [AUTOMATIC_BACKUP_GUIDE.md](AUTOMATIC_BACKUP_GUIDE.md) for complete details.

### Manual Backup (Development Mode)
```bash
# Automated backup script
./backup_database.sh

# Backups stored at: ~/mytimemanager_backups/
```

### Restore
```bash
# Interactive restore script
./restore_database.sh
```

### Database Location
```
backend/database/mytimemanager.db
```

### Sharing Between Computers
1. Backup on Computer A: `./backup_database.sh`
2. Copy `.db.gz` file to Computer B
3. On Computer B: `./restore_database.sh`

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# API testing
# Open http://localhost:8000/docs (Swagger UI)

# Manual testing checklist
# See QUICK_TEST_CHECKLIST.md
```

---

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is for personal use. All rights reserved.

---

## 🙏 Acknowledgments

- Based on CANI (Constant And Never-ending Improvement) philosophy
- Inspired by time management methodologies from productivity experts
- Built with ❤️ for family time management

---

## 📞 Support

For issues, questions, or feature requests:
1. Check existing documentation in the `docs/` folder
2. Review [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for feature details
3. Create an issue on GitHub
4. Contact: [your-email@example.com]

---

**Happy Time Tracking!** 🎯⏰👨‍👩‍👦

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
