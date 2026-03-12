#!/bin/bash

# 🚀 Quick Start Script for Backend
# This script helps you start the blockchain-integrated backend

echo "🔗 Starting TouristRegistry Backend..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure your credentials:"
    echo "  cp .env.example .env"
    echo ""
    exit 1
fi

# Check if blockchain credentials are set
if grep -q "your_wallet_private_key_here" .env; then
    echo "⚠️  ERROR: Please configure your .env file with actual credentials"
    echo "You need to set:"
    echo "  - PRIVATE_KEY (your MetaMask wallet private key)"
    echo "  - CONTRACT_ADDRESS (deployed contract address)"
    echo "  - RPC_URL (Alchemy or public RPC URL)"
    echo ""
    exit 1
fi

# Display configuration
echo "✅ Configuration loaded from .env"
echo ""

# Start the backend
echo "🚀 Starting backend server..."
echo "📍 Server will run at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node index.js
