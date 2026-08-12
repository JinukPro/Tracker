@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ============================================
echo  Tracker 로컬 실행
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치하세요.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [정보] node_modules가 없어 의존성을 설치합니다...
    call npm install
    if errorlevel 1 (
        echo [오류] npm install 실패
        pause
        exit /b 1
    )
)

if not exist ".env" (
    echo [안내] .env 파일이 없습니다. Firebase 없이 로컬 데이터(data/*.json, localStorage^)로 동작합니다.
    echo        Firebase를 쓰려면 .env.example을 복사해 .env를 만들고 값을 채우세요.
)

echo.
echo 개발 서버를 시작합니다. 종료하려면 Ctrl+C 를 누르세요.
echo.
call npm run dev -- --open

pause
