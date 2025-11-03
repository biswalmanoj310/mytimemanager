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
