# OffNet

A sophisticated middleware system that enables applications to continue functioning seamlessly without internet connectivity by intercepting, simulating, and synchronizing network requests.

## 🚀 Features

- **Request Interception** - All API requests go through a local proxy layer
- **Offline Mode** - Serve cached data and generate simulated responses
- **Online Mode** - Forward requests to real APIs and cache responses
- **Automatic Sync** - Queue offline requests and sync when connection is restored
- **Conflict Resolution** - Handle data conflicts with multiple strategies
- **Real-time Dashboard** - Monitor system status, queue, cache, and logs
- **WebSocket Updates** - Live status updates and notifications

## 🛠️ Installation

```bash
npm install
npm start
```

Then visit `http://localhost:3000`

## 🎯 Quick Start

### Online Mode
1. Ensure internet connection
2. Click "Fetch Posts" to retrieve real data
3. Create posts/users - data gets cached

### Offline Mode  
1. Click "Go Offline" (or disconnect internet)
2. Fetch data - served from cache or mock responses
3. Create data - requests are queued with temporary IDs
4. Check "Request Queue" to see pending requests

### Sync Process
1. Go offline and create several posts/users
2. Click "Go Online" 
3. Watch queued requests automatically sync
4. Temporary IDs replaced with real server IDs

## 📊 Key Components

- **Database Layer** (`db.js`) - SQLite storage for cache, queue, logs
- **Connection Manager** (`connection.js`) - Automatic/manual online/offline detection
- **Sync Engine** (`sync.js`) - Request queuing, sync, and conflict resolution
- **Proxy Layer** (`proxy.js`) - Request interception and mock data generation
- **Main Server** (`server.js`) - Express server with WebSocket support

## 🔧 API Endpoints

### Connection
- `POST /api/offline/connection/online` - Go online
- `POST /api/offline/connection/offline` - Go offline
- `GET /api/offline/connection/status` - Get status

### Sync
- `POST /api/offline/sync/start` - Start sync
- `GET /api/offline/sync/status` - Get sync stats
- `POST /api/offline/sync/retry` - Retry failed requests

### Management
- `GET /api/offline/queue` - View queued requests
- `GET /api/offline/cache` - View cache contents
- `GET /api/offline/logs` - View system logs
- `GET /api/offline/conflicts` - View conflicts
- `GET /api/offline/stats` - Get system statistics

## 🎨 Frontend Features

- **Dashboard** - Real-time status and statistics
- **API Demo** - Interactive post/user creation
- **Queue Viewer** - Monitor pending requests
- **Cache Browser** - View cached responses  
- **Logs Viewer** - System event monitoring
- **Conflict Resolution** - Interactive conflict management

## 🧪 Testing

The system uses `https://jsonplaceholder.typicode.com` as the external API for testing. All requests are routed through the OffNet proxy layer, which handles offline/online modes automatically.

## 🔍 Debugging

Enable debug logging:
```javascript
fetch('/api/offline/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logLevel: 'debug' })
});
```

Database file: `offnet.db` (SQLite)

## 📝 License

MIT License

---

**OffNet** - Building resilient, offline-first applications with seamless synchronization.
