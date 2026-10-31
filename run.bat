@echo off
echo ============================================
echo  70MM AI -- Group 2: Script Intelligence
echo ============================================
echo.

cd /d "%~dp0"

IF NOT EXIST "venv\Scripts\activate.bat" (
    echo [ERROR] venv not found. Run setup first:
    echo   python -m venv venv
    echo   venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/2] Activating virtual environment...
call venv\Scripts\activate.bat

echo [2/2] Starting Flask server on http://localhost:5000
echo.
echo  Open your browser at: http://localhost:5000
echo  Press Ctrl+C to stop the server.
echo.

python app.py

pause
