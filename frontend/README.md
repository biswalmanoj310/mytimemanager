# MyTimeManager Frontend

Modern, responsive React + TypeScript frontend for the MyTimeManager application.

## 🚀 Features

- **Three Pillars System**: Visual representation of Hard Work (💼), Calmness (🧘), and Family (👨‍👩‍👦)
- **Dashboard**: Overview of goals, tasks, and time tracking statistics
- **Calendar Integration**: Daily, weekly, and monthly views
- **Task Management**: Create, track, and manage tasks with time allocation
- **Goal Tracking**: Set and monitor goals across different time periods
- **Time Tracking**: Log time entries with 30-minute slot validation
- **Analytics**: Visual charts and insights for productivity analysis
- **Responsive Design**: Mobile-friendly interface with sidebar navigation
- **Color Coding**: Each pillar has distinct colors for easy identification
- **Drag-and-Drop**: (Coming Soon) Intuitive time entry management

## 🛠️ Tech Stack

- **React 18.2** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Axios** - API communication
- **Lucide React** - Modern icon library
- **Recharts** - Data visualization (Coming Soon)
- **React Beautiful DnD** - Drag and drop functionality (Coming Soon)

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)
- Backend API running on `http://localhost:8000`

### Setup Steps

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file** (optional):
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` if needed:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Navigate to `http://localhost:3000`

## 🏗️ Project Structure

```
frontend/
├── public/               # Static assets
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Layout.tsx   # Main layout with sidebar
│   │   └── Layout.css
│   ├── pages/           # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Calendar.tsx
│   │   ├── Tasks.tsx
│   │   ├── Goals.tsx
│   │   ├── TimeTracking.tsx
│   │   └── Analytics.tsx
│   ├── services/        # API services
│   │   └── api.ts      # Axios configuration
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts
│   ├── styles/         # Global styles
│   │   └── global.css
│   ├── hooks/          # Custom React hooks (Coming Soon)
│   ├── utils/          # Utility functions (Coming Soon)
│   ├── App.tsx         # Root component
│   └── main.tsx        # Application entry point
├── index.html          # HTML template
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── README.md          # This file
```

## 🎨 Design System

### Color Palette

- **Hard Work Pillar**: `#FF6B6B` (Red)
- **Calmness Pillar**: `#4ECDC4` (Teal)
- **Family Pillar**: `#95E1D3` (Mint)
- **Primary**: `#4A90E2` (Blue)
- **Success**: `#51CF66` (Green)
- **Warning**: `#FFB366` (Orange)
- **Danger**: `#FF6B6B` (Red)

### Typography

- Font Family: System fonts (Apple, Segoe UI, Roboto)
- Base Size: 16px
- Scale: 0.75rem, 0.875rem, 1rem, 1.125rem, 1.25rem, 1.5rem, 1.875rem, 2.25rem

## 📝 Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## 🔌 API Integration

The frontend connects to the backend API at `http://localhost:8000`. All API calls are proxied through Vite's dev server.

### API Endpoints Used

- `GET /api/dashboard/goals-overview` - Dashboard statistics
- `GET /api/calendar/daily` - Daily calendar view
- `GET /api/calendar/weekly` - Weekly calendar view
- `GET /api/calendar/monthly` - Monthly calendar view
- `GET /api/tasks` - List tasks
- `GET /api/goals` - List goals
- `GET /api/time-entries` - Time entries
- `GET /api/analytics/*` - Analytics data

## 🚧 Development Status

### ✅ Completed (Requirement 11 - Phase 1)

- [x] Project structure and configuration
- [x] React + TypeScript + Vite setup
- [x] Responsive layout with sidebar navigation
- [x] Global styles and design system
- [x] Type definitions for all API models
- [x] API service layer with Axios
- [x] Dashboard page with statistics
- [x] Routing setup for all pages
- [x] Mobile-responsive design
- [x] Color-coded pillar system

### 🔄 In Progress (Requirement 11 - Phase 2)

- [ ] Complete Calendar page implementation
- [ ] Task management UI with CRUD operations
- [ ] Goal management UI
- [ ] Time tracking interface with time grid
- [ ] Analytics charts and visualizations
- [ ] Drag-and-drop time entry management
- [ ] Form validation and error handling
- [ ] Loading states and animations

### 📋 Upcoming

- [ ] Real-time updates (WebSocket)
- [ ] Dark mode support
- [ ] Keyboard shortcuts
- [ ] Export/import functionality
- [ ] Notifications system
- [ ] User preferences
- [ ] Advanced filtering and search

## 🎯 Usage

### Starting the Application

1. Make sure the backend is running:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser

### Navigation

- **Dashboard**: Overview of all pillars, goals, and tasks
- **Calendar**: Daily, weekly, and monthly calendar views
- **Tasks**: Manage and track all tasks
- **Goals**: Create and monitor goals
- **Time Tracking**: Log time entries in 30-minute slots
- **Analytics**: View charts and productivity insights

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 is taken:
```bash
# Vite will automatically use the next available port
# Or specify a different port in vite.config.ts
```

### API Connection Issues

If the frontend can't connect to the backend:
1. Check backend is running on port 8000
2. Verify `VITE_API_BASE_URL` in `.env`
3. Check browser console for CORS errors

### Build Errors

If you encounter build errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

Part of the MyTimeManager project - MIT License

## 🤝 Contributing

This is the frontend component of the MyTimeManager application. For backend API development, see `../backend/README.md`.

---

**MyTimeManager** - CANI: Constant And Never-ending Improvement 🚀
