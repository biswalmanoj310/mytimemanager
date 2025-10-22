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
