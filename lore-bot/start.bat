@echo off
title Pax Dei Lore Keeper Bot
echo.
echo ============================================================
echo   Pax Dei Archives - Lore Keeper Bot
echo ============================================================
echo.

REM Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

REM Check if venv exists, create if not
if not exist "venv" (
    echo [SETUP] Creating virtual environment...
    python -m venv venv
    echo [SETUP] Installing dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    echo.
    echo [SETUP] Setup complete!
    echo.
) else (
    call venv\Scripts\activate.bat
)

REM Check if Ollama is running
curl -s http://localhost:11434/api/tags >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] Ollama doesn't appear to be running.
    echo [WARN] Start it with: ollama serve
    echo [WARN] Then pull the model: ollama pull phi3.5
    echo.
)

echo [INFO] Starting Lore Keeper server...
echo.
python server.py

pause
