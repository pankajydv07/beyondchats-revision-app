@echo off
echo 🚀 BeyondChats Revision App - Bootstrap Script
echo ==============================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

echo ✅ Node.js detected

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your actual API keys before running the app!
) else (
    echo ✅ .env file already exists
)

REM Install client dependencies
echo 📦 Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install client dependencies
    exit /b 1
)
echo ✅ Client dependencies installed successfully

REM Install server dependencies
echo 📦 Installing server dependencies...
cd ..\server
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install server dependencies
    exit /b 1
)
echo ✅ Server dependencies installed successfully

REM Go back to root directory
cd ..

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Edit .env file with your API keys
echo 2. Run the application:
echo.
echo    # Option 1: Manual start (recommended for development)
echo    # Terminal 1:
echo    cd server ^&^& npm run dev
echo.
echo    # Terminal 2:
echo    cd client ^&^& npm run dev
echo.
echo    # Option 2: Docker (all-in-one)
echo    docker-compose up --build
echo.
echo 🌐 Access URLs:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:5000
echo.
echo 📚 For more information, check README.md

pause