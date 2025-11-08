echo off

REM Fix AICIN Cloud Run Authentication (Windows)

REM Run this from Command Prompt or PowerShell where gcloud is configured

 

setlocal enabledelayedexpansion

 

echo ================================================================

echo    AICIN Cloud Run Authentication Fix (Windows)

echo ================================================================

echo.

 

REM Configuration

set PROJECT_ID=aicin-477004

set REGION=us-west1

 

REM Check gcloud is installed

echo Step 1: Checking gcloud CLI installation...

where gcloud >nul 2>&1

if %errorlevel% neq 0 (

    echo [ERROR] gcloud CLI is not installed

    echo.

    echo Please install gcloud CLI:

    echo   Download from: https://cloud.google.com/sdk/docs/install#windows

    echo.

    pause

    exit /b 1

)

echo [OK] gcloud CLI is installed

echo.

 

REM Check authentication

echo Step 2: Checking gcloud authentication...

for /f "tokens=*" %%a in ('gcloud auth list --filter^=status:ACTIVE --format^="value(account)" 2^>nul') do set ACTIVE_ACCOUNT=%%a

if "%ACTIVE_ACCOUNT%"=="" (

    echo [ERROR] Not authenticated with gcloud

    echo.

    echo Please run: gcloud auth login

    echo.

    pause

    exit /b 1

)

echo [OK] Authenticated as: %ACTIVE_ACCOUNT%

echo.

 

REM Set project

echo Step 3: Setting active project...

gcloud config set project %PROJECT_ID% >nul 2>&1

echo [OK] Active project set to: %PROJECT_ID%

echo.

 

REM Check current status

echo Step 4: Checking current orchestrator status...

curl -s https://orchestrator-239116109469.us-west1.run.app/health > temp_response.txt 2>&1

set /p CURRENT_RESPONSE=<temp_response.txt

del temp_response.txt

 

if "%CURRENT_RESPONSE%"=="Access denied" (

    echo [EXPECTED] Orchestrator requires authentication - will fix now

) else (

    echo [UNEXPECTED] Got response: %CURRENT_RESPONSE%

    echo Service might already be accessible or have different issue

)

echo.

 

echo ================================================================

echo    Fixing Orchestrator Authentication

echo ================================================================

echo.

echo Running: gcloud run services add-iam-policy-binding orchestrator

echo          --member="allUsers" --role="roles/run.invoker"

echo.

 

gcloud run services add-iam-policy-binding orchestrator --member="allUsers" --role="roles/run.invoker" --region=%REGION% --project=%PROJECT_ID% >nul 2>&1

 

if %errorlevel% equ 0 (

    echo [OK] Orchestrator authentication policy updated

) else (

    echo [ERROR] Failed to update orchestrator

    echo You may need 'run.services.setIamPolicy' permission

    pause

    exit /b 1

)

echo.

 

REM Wait for propagation

echo Waiting 10 seconds for IAM policy to propagate...

timeout /t 10 /nobreak >nul

echo.

 

REM Test orchestrator

echo Step 5: Testing orchestrator endpoint...

curl -s https://orchestrator-239116109469.us-west1.run.app/health

echo.

echo.

 

set /p CONTINUE="Does the response above show JSON (not 'Access denied')? (Y/N): "

if /i "%CONTINUE%"=="Y" (

    echo.

    echo [SUCCESS] Orchestrator is now accessible!

    echo.

    echo ================================================================

    echo    Authentication Fix Complete

    echo ================================================================

    echo.

    echo Next steps:

    echo   1. [DONE] Cloud Run authentication fixed

    echo   2. Continue with CUTOVER_CHECKLIST.md - Phase 2

    echo   3. Update Vercel environment variables

    echo   4. Deploy to production

    echo.

) else (

    echo.

    echo [WARNING] If still seeing "Access denied", wait 1-2 minutes

    echo           for IAM changes to fully propagate, then re-run this script.

    echo.

)

 

pause