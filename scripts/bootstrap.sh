#!/bin/bash

echo "🚀 BeyondChats Revision App - Bootstrap Script"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual API keys before running the app!"
else
    echo "✅ .env file already exists"
fi

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
if npm install; then
    echo "✅ Client dependencies installed successfully"
else
    echo "❌ Failed to install client dependencies"
    exit 1
fi

# Install server dependencies
echo "📦 Installing server dependencies..."
cd ../server
if npm install; then
    echo "✅ Server dependencies installed successfully"
else
    echo "❌ Failed to install server dependencies"
    exit 1
fi

# Go back to root directory
cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run the application:"
echo ""
echo "   # Option 1: Manual start (recommended for development)"
echo "   # Terminal 1:"
echo "   cd server && npm run dev"
echo ""
echo "   # Terminal 2:"
echo "   cd client && npm run dev"
echo ""
echo "   # Option 2: Docker (all-in-one)"
echo "   docker-compose up --build"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo ""
echo "📚 For more information, check README.md"