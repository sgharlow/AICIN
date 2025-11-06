@echo off
REM Start all AICIN agents locally for testing
echo Starting AICIN agents locally for testing...
echo.

REM Create logs directory
if not exist logs mkdir logs

REM Kill existing node processes on agent ports (Windows)
echo Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8082') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8083') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8084') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /F /PID %%a 2>nul

timeout /t 2 /nobreak >nul

REM Start agents in separate windows
echo Starting Profile Analyzer (port 8081)...
start "Profile Analyzer" cmd /c "cd agents\profile-analyzer && npm start > ..\..\logs\profile-analyzer.log 2>&1"

timeout /t 2 /nobreak >nul

echo Starting Content Matcher (port 8082)...
start "Content Matcher" cmd /c "cd agents\content-matcher && npm start > ..\..\logs\content-matcher.log 2>&1"

timeout /t 2 /nobreak >nul

echo Starting Path Optimizer (port 8083)...
start "Path Optimizer" cmd /c "cd agents\path-optimizer && npm start > ..\..\logs\path-optimizer.log 2>&1"

timeout /t 2 /nobreak >nul

echo Starting Recommendation Builder (port 8084)...
start "Recommendation Builder" cmd /c "cd agents\recommendation-builder && npm start > ..\..\logs\recommendation-builder.log 2>&1"

timeout /t 3 /nobreak >nul

REM Start orchestrator with local agent URLs
echo Starting Orchestrator (port 8080)...
start "Orchestrator" cmd /c "cd agents\orchestrator && set PORT=8080 && set PROFILE_ANALYZER_URL=http://localhost:8081/invoke && set CONTENT_MATCHER_URL=http://localhost:8082/invoke && set PATH_OPTIMIZER_URL=http://localhost:8083/invoke && set RECOMMENDATION_BUILDER_URL=http://localhost:8084/invoke && npm start > ..\..\logs\orchestrator.log 2>&1"

timeout /t 3 /nobreak >nul

echo.
echo All agents started in separate windows!
echo.
echo Logs available in: logs\
echo.
echo Health checks:
echo   curl http://localhost:8081/health
echo   curl http://localhost:8082/health
echo   curl http://localhost:8083/health
echo   curl http://localhost:8084/health
echo   curl http://localhost:8080/health
echo.
echo Demo URL: http://localhost:3001
echo.
echo To view logs: type logs\*.log
echo To stop: Close the agent windows or use Task Manager
