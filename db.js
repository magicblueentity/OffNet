const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'offnet.db');
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            // Cache table for storing API responses
            `CREATE TABLE IF NOT EXISTS cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                headers TEXT,
                status_code INTEGER,
                UNIQUE(endpoint, method)
            )`,
            
            // Queue table for storing offline requests
            `CREATE TABLE IF NOT EXISTS queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                method TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                payload TEXT,
                temp_id TEXT,
                status TEXT DEFAULT 'pending',
                created_at INTEGER NOT NULL,
                retry_count INTEGER DEFAULT 0,
                response TEXT,
                synced_at INTEGER
            )`,
            
            // State table for connection status
            `CREATE TABLE IF NOT EXISTS state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )`,
            
            // Logs table for debugging
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                metadata TEXT
            )`,
            
            // Conflicts table for tracking data conflicts
            `CREATE TABLE IF NOT EXISTS conflicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL,
                local_data TEXT NOT NULL,
                server_data TEXT NOT NULL,
                resolution TEXT,
                created_at INTEGER NOT NULL,
                resolved_at INTEGER
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        // Initialize default state
        await this.setState('online', 'true');
        await this.setState('last_sync', '0');
        
        console.log('Database tables created successfully');
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Cache operations
    async cacheResponse(endpoint, method, response, headers, statusCode) {
        const sql = `INSERT OR REPLACE INTO cache 
                    (endpoint, method, response, timestamp, headers, status_code) 
                    VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [
            endpoint, 
            method, 
            JSON.stringify(response), 
            Date.now(), 
            JSON.stringify(headers || {}), 
            statusCode
        ];
        return this.run(sql, params);
    }

    async getCachedResponse(endpoint, method) {
        const sql = 'SELECT * FROM cache WHERE endpoint = ? AND method = ?';
        const row = await this.get(sql, [endpoint, method]);
        if (row) {
            return {
                ...row,
                response: JSON.parse(row.response),
                headers: JSON.parse(row.headers || '{}')
            };
        }
        return null;
    }

    async clearCache() {
        return this.run('DELETE FROM cache');
    }

    // Queue operations
    async queueRequest(method, endpoint, payload, tempId = null) {
        const sql = `INSERT INTO queue 
                    (method, endpoint, payload, temp_id, created_at) 
                    VALUES (?, ?, ?, ?, ?)`;
        const params = [method, endpoint, JSON.stringify(payload || {}), tempId, Date.now()];
        const result = await this.run(sql, params);
        return result.id;
    }

    async getQueuedRequests(status = 'pending') {
        const sql = 'SELECT * FROM queue WHERE status = ? ORDER BY created_at ASC';
        const rows = await this.all(sql, [status]);
        return rows.map(row => ({
            ...row,
            payload: JSON.parse(row.payload || '{}'),
            response: row.response ? JSON.parse(row.response) : null
        }));
    }

    async updateQueueStatus(id, status, response = null, syncedAt = null) {
        const sql = `UPDATE queue SET 
                    status = ?, 
                    response = ?, 
                    synced_at = ? 
                    WHERE id = ?`;
        const params = [
            status, 
            response ? JSON.stringify(response) : null, 
            syncedAt || Date.now(), 
            id
        ];
        return this.run(sql, params);
    }

    async incrementRetryCount(id) {
        const sql = 'UPDATE queue SET retry_count = retry_count + 1 WHERE id = ?';
        return this.run(sql, [id]);
    }

    async removeFromQueue(id) {
        return this.run('DELETE FROM queue WHERE id = ?', [id]);
    }

    // State operations
    async setState(key, value) {
        const sql = `INSERT OR REPLACE INTO state (key, value, updated_at) 
                    VALUES (?, ?, ?)`;
        return this.run(sql, [key, value, Date.now()]);
    }

    async getState(key) {
        const sql = 'SELECT value FROM state WHERE key = ?';
        const row = await this.get(sql, [key]);
        return row ? row.value : null;
    }

    async isOnline() {
        const online = await this.getState('online');
        return online === 'true';
    }

    async setOnlineStatus(isOnline) {
        return this.setState('online', isOnline.toString());
    }

    // Log operations
    async log(level, message, metadata = null) {
        const sql = `INSERT INTO logs (level, message, timestamp, metadata) 
                    VALUES (?, ?, ?, ?)`;
        const params = [level, message, Date.now(), JSON.stringify(metadata || {})];
        return this.run(sql, params);
    }

    async getLogs(limit = 100) {
        const sql = 'SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?';
        const rows = await this.all(sql, [limit]);
        return rows.map(row => ({
            ...row,
            metadata: JSON.parse(row.metadata || '{}')
        }));
    }

    // Conflict operations
    async addConflict(endpoint, localData, serverData) {
        const sql = `INSERT INTO conflicts 
                    (endpoint, local_data, server_data, created_at) 
                    VALUES (?, ?, ?, ?)`;
        const params = [
            endpoint, 
            JSON.stringify(localData), 
            JSON.stringify(serverData), 
            Date.now()
        ];
        return this.run(sql, params);
    }

    async getConflicts() {
        const sql = 'SELECT * FROM conflicts ORDER BY created_at DESC';
        const rows = await this.all(sql);
        return rows.map(row => ({
            ...row,
            local_data: JSON.parse(row.local_data),
            server_data: JSON.parse(row.server_data)
        }));
    }

    async resolveConflict(id, resolution) {
        const sql = 'UPDATE conflicts SET resolution = ?, resolved_at = ? WHERE id = ?';
        return this.run(sql, [resolution, Date.now(), id]);
    }

    // Statistics
    async getStats() {
        const cacheCount = await this.get('SELECT COUNT(*) as count FROM cache');
        const queueCount = await this.get('SELECT COUNT(*) as count FROM queue WHERE status = "pending"');
        const syncedCount = await this.get('SELECT COUNT(*) as count FROM queue WHERE status = "synced"');
        const conflictCount = await this.get('SELECT COUNT(*) as count FROM conflicts WHERE resolution IS NULL');
        const lastSync = await this.getState('last_sync');
        
        return {
            cached_responses: cacheCount.count,
            pending_requests: queueCount.count,
            synced_requests: syncedCount.count,
            unresolved_conflicts: conflictCount.count,
            last_sync: parseInt(lastSync) || 0
        };
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = new Database();
