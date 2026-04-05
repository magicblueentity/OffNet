const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// Import modules
const db = require('./db');
const connection = require('./connection');
const logger = require('./logger');
const sync = require('./sync');
const proxy = require('./proxy');

class OffNetServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.port = process.env.PORT || 3000;
        this.isInitialized = false;
    }

    async init() {
        try {
            console.log('🚀 Initializing OffNet Server...');
            
            // Initialize database
            await db.init();
            console.log('✅ Database initialized');
            
            // Initialize connection manager
            await connection.init();
            console.log('✅ Connection manager initialized');
            
            // Initialize sync engine
            await sync.init();
            console.log('✅ Sync engine initialized');
            
            // Initialize proxy layer
            await proxy.init();
            console.log('✅ Proxy layer initialized');
            
            // Setup Express app
            this.setupExpress();
            console.log('✅ Express app configured');
            
            // Setup WebSocket server
            this.setupWebSocket();
            console.log('✅ WebSocket server configured');
            
            // Setup event listeners
            this.setupEventListeners();
            console.log('✅ Event listeners configured');
            
            this.isInitialized = true;
            console.log('🎉 OffNet Server initialization complete!');
            
        } catch (error) {
            console.error('❌ Failed to initialize OffNet Server:', error);
            throw error;
        }
    }

    setupExpress() {
        // Middleware
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                logger.info('HTTP Request', {
                    method: req.method,
                    url: req.url,
                    status: res.statusCode,
                    duration,
                    ip: req.ip
                });
            });
            
            next();
        });

        // Static files
        this.app.use(express.static(path.join(__dirname, 'public')));

        // API Routes
        this.setupApiRoutes();

        // Proxy route - catch all API requests
        this.app.all('/api/*', async (req, res) => {
            const endpoint = req.url.replace('/api', '');
            await proxy.handleRequest(req, res);
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                version: '1.0.0'
            });
        });

        // Serve main page for any other route
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Error handling
        this.app.use((error, req, res, next) => {
            logger.error('Express error', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method
            });
            
            res.status(500).json({
                error: 'Internal Server Error',
                timestamp: Date.now()
            });
        });
    }

    setupApiRoutes() {
        // Connection management
        this.app.post('/api/offline/connection/online', async (req, res) => {
            try {
                await connection.goOnline();
                this.broadcastEvent('connection_changed', { online: true, source: 'manual' });
                res.json({ success: true, online: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/offline/connection/offline', async (req, res) => {
            try {
                await connection.goOffline();
                this.broadcastEvent('connection_changed', { online: false, source: 'manual' });
                res.json({ success: true, online: false });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/offline/connection/status', async (req, res) => {
            try {
                const status = connection.getStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Sync management
        this.app.post('/api/offline/sync/start', async (req, res) => {
            try {
                await sync.startSync();
                res.json({ success: true, message: 'Sync started' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/offline/sync/status', async (req, res) => {
            try {
                const stats = await sync.getStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/offline/sync/retry', async (req, res) => {
            try {
                const results = await sync.retryFailedRequests();
                res.json({ success: true, results });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Queue management
        this.app.get('/api/offline/queue', async (req, res) => {
            try {
                const queue = await db.getQueuedRequests();
                res.json(queue);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/offline/queue/:id', async (req, res) => {
            try {
                await db.removeFromQueue(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Cache management
        this.app.get('/api/offline/cache', async (req, res) => {
            try {
                const cacheInfo = await proxy.getCacheInfo();
                res.json(cacheInfo);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/offline/cache', async (req, res) => {
            try {
                await proxy.clearCache();
                res.json({ success: true, message: 'Cache cleared' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Logs
        this.app.get('/api/offline/logs', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 100;
                const level = req.query.level || null;
                const logs = await logger.getRecentLogs(limit, level);
                res.json(logs);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/offline/logs/stats', async (req, res) => {
            try {
                const stats = await logger.getLogStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Conflicts
        this.app.get('/api/offline/conflicts', async (req, res) => {
            try {
                const conflicts = await sync.getConflicts();
                res.json(conflicts);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/offline/conflicts/:id/resolve', async (req, res) => {
            try {
                const { resolution, newData } = req.body;
                const result = await sync.resolveConflict(req.params.id, resolution, newData);
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Statistics
        this.app.get('/api/offline/stats', async (req, res) => {
            try {
                const dbStats = await db.getStats();
                const connectionStats = await connection.getStats();
                const syncStats = await sync.getStats();
                const proxyStats = await proxy.getStats();
                
                res.json({
                    database: dbStats,
                    connection: connectionStats,
                    sync: syncStats,
                    proxy: proxyStats,
                    timestamp: Date.now()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Configuration
        this.app.post('/api/offline/config', async (req, res) => {
            try {
                const { syncFrequency, maxRetries, conflictStrategy, logLevel } = req.body;
                
                if (syncFrequency) {
                    sync.setSyncFrequency(syncFrequency);
                }
                
                if (maxRetries !== undefined) {
                    sync.setMaxRetries(maxRetries);
                }
                
                if (conflictStrategy) {
                    sync.setConflictStrategy(conflictStrategy);
                }
                
                if (logLevel) {
                    logger.setLevel(logLevel);
                }
                
                res.json({ success: true, message: 'Configuration updated' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    setupWebSocket() {
        // Create HTTP server for WebSocket
        this.server = http.createServer(this.app);
        
        // Create WebSocket server
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            logger.info('WebSocket client connected');
            
            // Send initial status
            this.sendInitialStatus(ws);
            
            // Handle messages
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    logger.error('WebSocket message error', { error: error.message });
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
                }
            });
            
            // Handle disconnection
            ws.on('close', () => {
                logger.info('WebSocket client disconnected');
            });
            
            // Handle errors
            ws.on('error', (error) => {
                logger.error('WebSocket error', { error: error.message });
            });
        });
    }

    setupEventListeners() {
        // Connection events
        connection.addListener(async (isOnline, previousStatus) => {
            this.broadcastEvent('connection_changed', { 
                online: isOnline, 
                previousStatus,
                timestamp: Date.now() 
            });
        });

        // Sync events
        sync.addListener((event, data) => {
            this.broadcastEvent('sync_event', { event, data, timestamp: Date.now() });
        });

        // Global event emitter for logger events
        global.eventEmitter = {
            emit: (event, data) => {
                this.broadcastEvent('log_event', { event, data, timestamp: Date.now() });
            }
        };
    }

    async handleWebSocketMessage(ws, data) {
        const { type, payload } = data;
        
        switch (type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
                
            case 'subscribe_logs':
                ws.logSubscription = payload?.level || 'info';
                ws.send(JSON.stringify({ type: 'subscribed', subscription: 'logs' }));
                break;
                
            case 'subscribe_stats':
                ws.statsSubscription = true;
                ws.send(JSON.stringify({ type: 'subscribed', subscription: 'stats' }));
                break;
                
            case 'get_status':
                await this.sendInitialStatus(ws);
                break;
                
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
    }

    async sendInitialStatus(ws) {
        try {
            const status = connection.getStatus();
            const stats = await db.getStats();
            const queue = await db.getQueuedRequests();
            
            ws.send(JSON.stringify({
                type: 'initial_status',
                data: {
                    connection: status,
                    stats,
                    queueSize: queue.length,
                    timestamp: Date.now()
                }
            }));
        } catch (error) {
            logger.error('Failed to send initial status', { error: error.message });
        }
    }

    broadcastEvent(type, data) {
        const message = JSON.stringify({ type, data });
        
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    logger.error('Failed to send WebSocket message', { error: error.message });
                }
            }
        });
    }

    async start() {
        if (!this.isInitialized) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (error) => {
                if (error) {
                    console.error('❌ Failed to start server:', error);
                    reject(error);
                } else {
                    console.log(`🌐 OffNet Server running on http://localhost:${this.port}`);
                    console.log(`📊 Dashboard available at http://localhost:${this.port}`);
                    console.log(`🔗 API endpoints available at http://localhost:${this.port}/api/offline/*`);
                    resolve();
                }
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('🛑 OffNet Server stopped');
                    
                    // Cleanup modules
                    if (sync) sync.destroy();
                    if (connection) connection.destroy();
                    if (db) db.close();
                    
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Graceful shutdown
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }
}

// Create and start server
const server = new OffNetServer();

// Setup graceful shutdown
server.setupGracefulShutdown();

// Start the server
if (require.main === module) {
    server.start().catch((error) => {
        console.error('💥 Failed to start OffNet Server:', error);
        process.exit(1);
    });
}

module.exports = server;
