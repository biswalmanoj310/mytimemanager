#!/bin/bash

# Time Manager Application Startup Script
# Starts both backend and frontend servers

echo "=========================================="
echo "  Time Manager Application Startup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Please run this script from the mytimemanager directory${NC}"
    exit 1
fi

# Optional: Run backup before starting
read -p "Create database backup before starting? (y/n): " BACKUP
if [ "$BACKUP" = "y" ] || [ "$BACKUP" = "Y" ]; then
    if [ -f "./backup_database.sh" ]; then
        echo -e "${BLUE}Creating backup...${NC}"
        ./backup_database.sh
        echo ""
    fi
fi

# Start backend
echo -e "${BLUE}Starting Backend Server...${NC}"
cd backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
    echo "  URL: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    exit 1
fi

# Start frontend
echo ""
echo -e "${BLUE}Starting Frontend Server...${NC}"
cd frontend
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# Check if frontend started successfully
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
    echo "  URL: http://localhost:3003"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    kill $BACKEND_PID
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Application Started Successfully!${NC}"
echo "=========================================="
echo ""
echo "Access the application at:"
echo "  → Frontend: http://localhost:3003"
echo "  → Backend API: http://localhost:8000"
echo "  → API Documentation: http://localhost:8000/docs"
echo ""
echo "Process IDs:"
echo "  Backend PID: $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop the application:"
echo "  Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo "=========================================="

# Keep script running and handle Ctrl+C
trap "echo '' && echo 'Stopping servers...' && kill $BACKEND_PID $FRONTEND_PID 2>/dev/null && echo 'Servers stopped.' && exit 0" INT

# Wait for both processes
wait
