#!/bin/bash
# Deployment script for QPrint Drop on server 20.65.116.196

set -e

echo "🚀 Deploying QPrint Drop on 20.65.116.196..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Node.js not found. Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies
echo "📥 Installing npm dependencies..."
npm ci

# Build client and server
echo "🔨 Building project..."
npm run build

echo "✅ Build complete!"
echo "To run with PM2:"
echo "  sudo npm install -g pm2"
echo "  pm2 start dist/server.cjs --name qprint-drop"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo "Or run directly:"
echo "  npm start"
