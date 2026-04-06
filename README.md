# OffNet - Advanced Offline-First Middleware System

🌐 **OffNet** is a sophisticated offline-first middleware system that provides seamless online/offline functionality for web applications. Now with a **native desktop application** for easy server management!

## ✨ Key Features

### 🖥️ **Desktop Application (NEW!)**
- **Native desktop app** built with Electron, insanely easy to use
- **One-click server management** - start/stop/restart with GUI
- **Automatic server monitoring** with real-time status
- **Beautiful loading screen** with animations
- **Keyboard shortcuts** for power users
- **Cross-platform** - Windows, macOS, Linux

### 🚀 **Aggressive Caching & Sync**
- **Proactive data fetching** - caches everything when online
- **3-second sync cycles** for maximum responsiveness
- **14 endpoints aggressively cached** (posts, users, comments, albums, photos, todos)
- **30-second cache refresh** when online
- **Queue management** for offline operations

### 🎯 **Simplified Interface**
- **Clean, modern dashboard** focused on essential features
- **Real-time updates** every 3-5 seconds
- **Connection control** with manual override
- **Status monitoring** with live indicators
- **Request queue** visualization

### ⚡ **Performance Optimized**
- **2-second connection checks** (was 5 seconds)
- **Enhanced proxy layer** with comprehensive caching
- **WebSocket real-time updates**
- **SQLite storage** for reliability
- **Graceful error handling** with fallbacks

## 🚀 Quick Start

### Option 1: Desktop App (Recommended)
```bash
# Install and run desktop app
npm run install-desktop
npm run desktop
```

### Option 2: Web Only
```bash
# Start server only
npm start
```

### Option 3: Development
```bash
# Desktop app with dev tools
npm run desktop-dev

# Web server only
npm run dev
```

## 🖥️ Desktop Application

### Installation
```bash
# Automatic installation (Windows)
npm run install-desktop

# Manual installation
cd desktop-app
npm install
npm start
```

### Features
- **Server Management**: Start/stop/restart with one click
- **Status Panel**: Real-time server status and version info
- **Window Controls**: Native minimize/maximize/close
- **Keyboard Shortcuts**: 
  - `Ctrl+S` - Start server
  - `Ctrl+Shift+S` - Stop server  
  - `Ctrl+R` - Restart server
  - `F12` - Developer tools

### Building for Distribution
```bash
# Windows installer
npm run build-desktop-win

# macOS app
npm run build-desktop-mac

# Linux AppImage
npm run build-desktop-linux
```

## 🌐 Web Dashboard

Access the dashboard at **http://localhost:3000** when the server is running.

### Sections
- **Connection Control**: Manual online/offline switching
- **System Status**: Pending requests, cached items, synced count
- **Request Queue**: Real-time view of queued operations

## 🏗️ Architecture

### Desktop App Components
```
desktop-app/
├── main.js          # Electron main process
├── preload.js       # Security bridge
├── loading.html     # Loading screen
├── desktop.css      # Desktop-specific styles
├── desktop.js       # Desktop enhancements
└── package.json     # Desktop dependencies
```

### Core System
```
├── server.js        # Express server & WebSocket
├── sync.js          # Aggressive sync engine
├── proxy.js         # Request interception & caching
├── connection.js    # Connection management
├── db.js           # SQLite database layer
├── logger.js       # Structured logging
└── public/         # Web dashboard
    ├── index.html  # Main dashboard
    ├── styles.css  # Modern styling
    └── app.js      # Frontend logic
```

## 📊 Aggressive Caching Strategy

### Endpoints Cached
- `/posts`, `/posts/1`, `/posts/2`
- `/users`, `/users/1`, `/users/2`
- `/comments`, `/comments/1`
- `/albums`, `/albums/1`
- `/photos`, `/photos/1`
- `/todos`, `/todos/1`

### Cache Behavior
- **ALL request methods** cached (GET, POST, PUT, PATCH)
- **Immediate caching** when online
- **Periodic refresh** every 30 seconds
- **Connection restoration** triggers immediate cache population

## 🔧 Configuration

### Server Settings
- **Port**: 3000 (configurable)
- **Database**: SQLite (`offnet.db`)
- **Sync Frequency**: 3 seconds
- **Cache Refresh**: 30 seconds
- **Connection Check**: 2 seconds

### Desktop Settings
- **Window Size**: 1200x800 (minimum 800x600)
- **Auto-start Server**: Enabled
- **Theme**: System preference (light/dark)

## � API Endpoints

### Connection Management
- `POST /api/offline/connection/online` - Go online
- `POST /api/offline/connection/offline` - Go offline
- `GET /api/offline/connection/status` - Get status

### Sync Operations
- `POST /api/offline/sync/start` - Start sync
- `GET /api/offline/queue` - Get queued requests
- `GET /api/offline/cache` - Get cached responses

### Statistics
- `GET /api/offline/stats` - System statistics
- `GET /api/offline/logs` - System logs

## 🧪 Testing

### Manual Testing
1. **Start desktop app**: `npm run desktop`
2. **Go offline**: Click "Go Offline" button
3. **Test offline**: Make API requests - should serve from cache
4. **Go online**: Click "Go Online" button
5. **Verify sync**: Queued requests should sync automatically

### Automated Testing
```bash
# Run tests (when implemented)
npm test
```

## 🔍 Troubleshooting

### Common Issues

1. **Port 3000 in use**
   ```bash
   # Kill existing process
   taskkill /F /IM node.exe
   # Or change port in server.js
   ```

2. **Desktop app won't start**
   ```bash
   # Reinstall dependencies
   cd desktop-app
   npm install
   npm start
   ```

3. **Server not responding**
   - Check server logs in desktop app
   - Verify Node.js installation
   - Check database file permissions

### Getting Help
- Check console logs for errors
- Verify all dependencies are installed
- Ensure Node.js 16+ is installed

## � Development

### Adding Features
1. **Desktop features**: Edit `desktop-app/desktop.js`
2. **Server features**: Edit core files in root
3. **UI features**: Edit `public/app.js` and `public/styles.css`
4. **New endpoints**: Add to `server.js`

### Code Style
- Use async/await for asynchronous operations
- Follow existing naming conventions
- Add proper error handling
- Include logging for important operations

## � License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**OffNet** - Bringing advanced offline-first middleware to your desktop! 🌐

*Built with ❤️ using Node.js, Express, Electron, and modern web technologies by ANCORATE*
