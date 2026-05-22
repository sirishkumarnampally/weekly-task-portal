#!/bin/bash
# Start both backend and frontend dev servers

echo "🚀 Starting Weekly Task Portal..."
echo ""

# Start backend
echo "📡 Starting backend on http://localhost:5000"
cd "$(dirname "$0")/backend" && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend on http://localhost:5173"
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:5000"
echo ""
echo "Demo credentials:"
echo "   Manager: manager@demo.com / manager123"
echo "   Member:  bob@demo.com / member123"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servers stopped.'" INT TERM
wait
