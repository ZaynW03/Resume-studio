@echo off
echo =======================================
echo     Starting Resume Studio...
echo =======================================

echo.
echo [1/2] Starting Backend...
cd backend
if not exist .venv (
    echo Creating Python virtual environment...
    python -m venv .venv
    echo Installing backend dependencies...
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
)
if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env
)
start "Resume Studio Backend" cmd /k ".\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo.
echo [2/2] Starting Frontend...
cd ..\frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
start "Resume Studio Frontend" cmd /k "npm run dev"

echo.
echo Done! Frontend and Backend are running in separate windows.
pause
