@echo off
REM 🚀 Quick Start Script for Backend (Windows)
REM This script helps you start the blockchain-integrated backend

echo 🔗 Starting TouristRegistry Backend...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  ERROR: .env file not found!
    echo Please copy .env.example to .env and configure your credentials:
    echo   copy .env.example .env
    echo.
    pause
    exit /b 1
)

REM Check if blockchain credentials are set
findstr /C:"your_wallet_private_key_here" .env >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  ERROR: Please configure your .env file with actual credentials
    echo You need to set:
    echo   - PRIVATE_KEY (your MetaMask wallet private key)
    echo   - CONTRACT_ADDRESS (deployed contract address)
    echo   - RPC_URL (Alchemy or public RPC URL)
    echo.
    pause
    exit /b 1
)

REM Display configuration
echo ✅ Configuration loaded from .env
echo.

REM Start the backend
echo 🚀 Starting backend server...
echo 📍 Server will run at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

node index.js
