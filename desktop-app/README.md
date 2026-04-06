# OffNet Desktop Application

A professional desktop application for the OffNet offline-first middleware system with continuous background caching.

## Features

### 🖥️ Desktop Application
- **Modern UI** with professional window controls and resizing
- **System integration** with tray support and auto-start
- **Window state persistence** - remembers position and size
- **Keyboard shortcuts** for power users

### 🔄 Background Service
- **Continuous caching** runs 24/7 even when app is closed
- **14 endpoints** aggressively cached every 30 seconds
- **Automatic restart** on failures
- **Minimal resource usage**

## Quick Start

### Install Dependencies
```bash
cd desktop-app
npm install
```

### Start Applications

#### Main Desktop App
```bash
npm start
```

#### Background Service (separate)
```bash
npm run background
```

## Usage

### Main Application
1. **Start the app** with `npm start`
2. **Manage server** with one-click start/stop controls
3. **Monitor status** through the dashboard
4. **Use keyboard shortcuts**:
   - `Ctrl+S` - Start server
   - `Ctrl+Shift+S` - Stop server
   - `Ctrl+R` - Restart server

### Background Service
1. **Run separately** with `npm run background`
2. **Automatic caching** of all endpoints
3. **Console monitoring** of sync status
4. **Persistent operation** - runs continuously

## Architecture

### Desktop App Components
- `main.js` - Electron main process with window management
- `preload.js` - Security bridge between processes
- `desktop.js` - Desktop enhancements and UI
- `desktop.css` - Modern styling and animations

### Background Service Components
- `background-service.js` - Service manager and process control
- `background-sync.js` - Continuous data caching worker
- `background-settings.json` - Configuration file

## Configuration

### Main App Settings
- **Auto-start server** - Start web server when app launches
- **Minimize to tray** - Keep app running in system tray
- **Window state** - Remember position and size

### Background Service Settings
```json
{
  "backgroundCaching": true,
  "syncInterval": 30000,
  "cacheEndpoints": [
    "/posts", "/posts/1", "/posts/2",
    "/users", "/users/1", "/users/2",
    "/comments", "/comments/1",
    "/albums", "/albums/1",
    "/photos", "/photos/1",
    "/todos", "/todos/1"
  ]
}
```

## Building

### Windows
```bash
npm run build-win
```

### macOS
```bash
npm run build-mac
```

### Linux
```bash
npm run build-linux
```

## Troubleshooting

### Common Issues

#### Installation Problems
- **Node.js version**: Ensure Node.js 16+ is installed
- **Dependencies**: Run `npm install` in desktop-app directory
- **Permissions**: Ensure write access to project directory

#### Background Service Issues
- **Database errors**: Ensure `offnet.db` is accessible
- **Network issues**: Check internet connectivity for API access
- **Process conflicts**: Stop other instances before starting

#### Desktop App Issues
- **Port conflicts**: Ensure port 3000 is available
- **Window positioning**: Delete window-state.json to reset position
- **Electron issues**: Rebuild with `npm run build`

## Development

### Project Structure
```
desktop-app/
├── main.js              # Electron main process
├── preload.js           # Security bridge
├── desktop.js           # Desktop enhancements
├── desktop.css          # Desktop styling
├── background-service.js # Background service manager
├── background-sync.js   # Background sync worker
├── loading.html         # Loading screen
└── package.json         # Dependencies and scripts
```

### Adding Features
1. **Main app**: Edit `main.js`, `desktop.js`, or `desktop.css`
2. **Background service**: Edit `background-service.js` or `background-sync.js`
3. **Build configuration**: Update `package.json`

## Performance

### Resource Usage
- **Main app**: ~100-200MB RAM
- **Background service**: ~50-100MB RAM
- **Database**: ~5-10MB (grows with cached data)
- **Network**: ~1-5MB per sync cycle

### Optimization Tips
- **Increase sync interval** in background-settings.json
- **Limit cached endpoints** to reduce data size
- **Clear old cache** periodically

## License

MIT License

---

**OffNet Desktop** - Professional offline-first middleware with continuous background caching! 🌐
