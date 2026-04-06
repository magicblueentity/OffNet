const axios = require('axios');
const sqlite3 = require('sqlite3');
const path = require('path');

class BackgroundSyncService {
    constructor() {
        this.settings = this.loadSettings();
        this.baseUrl = 'https://jsonplaceholder.typicode.com';
        this.dbPath = path.join(__dirname, '..', 'offnet.db');
        this.isRunning = true;
        this.lastSync = null;
        this.syncCount = 0;
        this.errorCount = 0;
        
        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        
        // Start the sync service
        this.start();
    }

    loadSettings() {
        try {
            const settings = process.env.OFFNET_SETTINGS;
            if (settings) {
                return JSON.parse(settings);
            }
        } catch (error) {
            console.error('Failed to parse settings from environment:', error);
        }
        
        return {
            backgroundCaching: true,
            syncInterval: 30000,
            cacheEndpoints: [
                '/posts', '/posts/1', '/posts/2',
                '/users', '/users/1', '/users/2',
                '/comments', '/comments/1',
                '/albums', '/albums/1',
                '/photos', '/photos/1',
                '/todos', '/todos/1'
            ]
        };
    }

    async start() {
        console.log('Background Sync Service starting...');
        
        // Initialize database connection
        await this.initDatabase();
        
        // Start periodic sync
        this.startPeriodicSync();
        
        // Perform initial sync
        await this.performSync();
        
        console.log('Background Sync Service started successfully');
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Failed to open database:', err);
                    reject(err);
                    return;
                }
                
                // Create cache table if it doesn't exist
                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        endpoint TEXT NOT NULL,
                        method TEXT NOT NULL,
                        response TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        headers TEXT,
                        status_code INTEGER,
                        UNIQUE(endpoint, method)
                    );
                `, (err) => {
                    if (err) {
                        console.error('Failed to create table:', err);
                        reject(err);
                    } else {
                        console.log('Database initialized successfully');
                        resolve();
                    }
                });
            });
        });
    }

    startPeriodicSync() {
        if (!this.settings.backgroundCaching) {
            console.log('Background caching is disabled');
            return;
        }

        this.syncInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.performSync();
            }
        }, this.settings.syncInterval);
        
        console.log(`Periodic sync started with ${this.settings.syncInterval}ms interval`);
    }

    async performSync() {
        try {
            console.log(`Starting sync cycle #${this.syncCount + 1}`);
            const startTime = Date.now();
            
            // Fetch all endpoints
            const promises = this.settings.cacheEndpoints.map(endpoint => 
                this.fetchAndCacheEndpoint(endpoint)
            );
            
            const results = await Promise.allSettled(promises);
            
            // Count successful and failed requests
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            const duration = Date.now() - startTime;
            
            this.syncCount++;
            this.lastSync = new Date();
            
            console.log(`Sync completed in ${duration}ms: ${successful} successful, ${failed} failed`);
            
            // Log errors if any
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to cache ${this.settings.cacheEndpoints[index]}:`, result.reason);
                    this.errorCount++;
                }
            });
            
        } catch (error) {
            console.error('Sync failed:', error);
            this.errorCount++;
        }
    }

    async fetchAndCacheEndpoint(endpoint) {
        try {
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                timeout: 10000,
                validateStatus: (status) => status < 500
            });
            
            // Cache the response
            await this.cacheResponse(
                endpoint,
                'GET',
                response.data,
                response.headers,
                response.status
            );
            
            console.log(`Cached endpoint: ${endpoint} (${response.status})`);
            
        } catch (error) {
            console.error(`Failed to fetch ${endpoint}:`, error.message);
            throw error;
        }
    }

    async cacheResponse(endpoint, method, data, headers, status) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`
                    INSERT OR REPLACE INTO cache 
                    (endpoint, method, response, headers, status_code, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                stmt.run(
                    endpoint,
                    method,
                    JSON.stringify(data),
                    JSON.stringify(headers),
                    status,
                    Date.now(),
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        });
    }

    stop() {
        this.isRunning = false;
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        console.log('Background sync service stopped');
    }

    shutdown() {
        console.log('Shutting down background sync service...');
        
        this.stop();
        
        // Close database connection
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                }
                this.db = null;
            });
        }
        
        // Final stats
        console.log(`Final stats: ${this.syncCount} sync cycles, ${this.errorCount} errors`);
        
        process.exit(0);
    }
}

// Start the background sync service
new BackgroundSyncService();
