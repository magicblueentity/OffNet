const db = require('./db');

class Logger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLevel = this.levels.INFO;
        this.consoleEnabled = true;
        this.databaseEnabled = true;
    }

    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
        } else {
            this.currentLevel = level;
        }
    }

    enableConsole(enabled) {
        this.consoleEnabled = enabled;
    }

    enableDatabase(enabled) {
        this.databaseEnabled = enabled;
    }

    async log(level, message, metadata = null) {
        const levelNum = typeof level === 'string' ? 
            this.levels[level.toUpperCase()] || this.levels.INFO : level;
        
        const levelName = this.getLevelName(levelNum);
        const timestamp = new Date().toISOString();

        // Skip if level is below current threshold
        if (levelNum > this.currentLevel) {
            return;
        }

        // Console logging
        if (this.consoleEnabled) {
            const logMessage = `[${timestamp}] ${levelName}: ${message}`;
            
            switch (levelName) {
                case 'ERROR':
                    console.error(logMessage, metadata || '');
                    break;
                case 'WARN':
                    console.warn(logMessage, metadata || '');
                    break;
                case 'INFO':
                    console.info(logMessage, metadata || '');
                    break;
                case 'DEBUG':
                    console.debug(logMessage, metadata || '');
                    break;
                default:
                    console.log(logMessage, metadata || '');
            }
        }

        // Database logging
        if (this.databaseEnabled) {
            try {
                await db.log(levelName.toLowerCase(), message, metadata);
            } catch (error) {
                // Prevent infinite logging loops
                if (this.consoleEnabled) {
                    console.error('Failed to log to database:', error.message);
                }
            }
        }

        // Special handling for certain events
        this.handleSpecialEvents(levelName, message, metadata);
    }

    handleSpecialEvents(level, message, metadata) {
        // Track important system events
        if (level === 'INFO') {
            if (message.includes('Request served from cache')) {
                this.emitEvent('cache_hit', metadata);
            } else if (message.includes('Request queued')) {
                this.emitEvent('request_queued', metadata);
            } else if (message.includes('Simulated response returned')) {
                this.emitEvent('simulated_response', metadata);
            } else if (message.includes('Request synced successfully')) {
                this.emitEvent('request_synced', metadata);
            } else if (message.includes('Conflict detected')) {
                this.emitEvent('conflict_detected', metadata);
            } else if (message.includes('Connection restored')) {
                this.emitEvent('connection_restored', metadata);
            } else if (message.includes('Connection lost')) {
                this.emitEvent('connection_lost', metadata);
            }
        }
    }

    emitEvent(eventType, metadata) {
        // This could be extended to emit events to WebSocket clients
        if (global.eventEmitter) {
            global.eventEmitter.emit('log_event', { type: eventType, metadata, timestamp: Date.now() });
        }
    }

    getLevelName(level) {
        for (const [name, num] of Object.entries(this.levels)) {
            if (num === level) {
                return name;
            }
        }
        return 'INFO';
    }

    // Convenience methods
    async error(message, metadata = null) {
        await this.log('ERROR', message, metadata);
    }

    async warn(message, metadata = null) {
        await this.log('WARN', message, metadata);
    }

    async info(message, metadata = null) {
        await this.log('INFO', message, metadata);
    }

    async debug(message, metadata = null) {
        await this.log('DEBUG', message, metadata);
    }

    // Specialized logging methods for OffNet events
    async requestIntercepted(method, endpoint, payload) {
        await this.info('Request intercepted', {
            method,
            endpoint,
            payloadSize: payload ? JSON.stringify(payload).length : 0
        });
    }

    async cacheHit(endpoint, method, age) {
        await this.info('Request served from cache', {
            endpoint,
            method,
            cacheAge: age
        });
    }

    async cacheMiss(endpoint, method) {
        await this.info('Cache miss', { endpoint, method });
    }

    async requestQueued(method, endpoint, tempId) {
        await this.info('Request queued', {
            method,
            endpoint,
            tempId
        });
    }

    async simulatedResponse(method, endpoint, tempId) {
        await this.info('Simulated response returned', {
            method,
            endpoint,
            tempId
        });
    }

    async requestSynced(method, endpoint, tempId, realId) {
        await this.info('Request synced successfully', {
            method,
            endpoint,
            tempId,
            realId
        });
    }

    async syncFailed(method, endpoint, error) {
        await this.error('Sync failed', {
            method,
            endpoint,
            error: error.message
        });
    }

    async conflictDetected(endpoint, localData, serverData) {
        await this.warn('Conflict detected', {
            endpoint,
            localDataKeys: Object.keys(localData || {}),
            serverDataKeys: Object.keys(serverData || {})
        });
    }

    async conflictResolved(endpoint, resolution) {
        await this.info('Conflict resolved', {
            endpoint,
            resolution
        });
    }

    async apiRequest(method, endpoint, statusCode, responseTime) {
        await this.info('API request completed', {
            method,
            endpoint,
            statusCode,
            responseTime
        });
    }

    async apiRequestFailed(method, endpoint, error) {
        await this.error('API request failed', {
            method,
            endpoint,
            error: error.message
        });
    }

    async connectionStatusChanged(isOnline, source = 'auto') {
        await this.info(`Connection status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`, {
            source,
            timestamp: Date.now()
        });
    }

    async syncStarted(queueSize) {
        await this.info('Sync process started', {
            queueSize,
            timestamp: Date.now()
        });
    }

    async syncCompleted(syncedCount, failedCount) {
        await this.info('Sync process completed', {
            syncedCount,
            failedCount,
            timestamp: Date.now()
        });
    }

    // Query methods
    async getRecentLogs(limit = 50, level = null) {
        try {
            let sql = 'SELECT * FROM logs';
            let params = [];
            
            if (level) {
                sql += ' WHERE level = ?';
                params.push(level.toLowerCase());
            }
            
            sql += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);
            
            const logs = await db.all(sql, params);
            
            return logs.map(log => ({
                ...log,
                metadata: JSON.parse(log.metadata || '{}'),
                timestamp: new Date(log.timestamp).toISOString()
            }));
        } catch (error) {
            await this.error('Failed to retrieve logs', { error: error.message });
            return [];
        }
    }

    async getLogStats() {
        try {
            const stats = await db.all(`
                SELECT 
                    level,
                    COUNT(*) as count,
                    MIN(timestamp) as oldest,
                    MAX(timestamp) as newest
                FROM logs 
                GROUP BY level
                ORDER BY count DESC
            `);
            
            return stats.map(stat => ({
                ...stat,
                oldest: stat.oldest ? new Date(stat.oldest).toISOString() : null,
                newest: stat.newest ? new Date(stat.newest).toISOString() : null
            }));
        } catch (error) {
            await this.error('Failed to get log stats', { error: error.message });
            return [];
        }
    }

    async clearOldLogs(daysToKeep = 30) {
        try {
            const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            const result = await db.run(
                'DELETE FROM logs WHERE timestamp < ?',
                [cutoffTime]
            );
            
            await this.info('Old logs cleared', {
                deletedCount: result.changes,
                daysToKeep
            });
            
            return result.changes;
        } catch (error) {
            await this.error('Failed to clear old logs', { error: error.message });
            return 0;
        }
    }

    // Export logs
    async exportLogs(format = 'json', level = null, limit = 1000) {
        const logs = await this.getRecentLogs(limit, level);
        
        if (format === 'csv') {
            const headers = ['timestamp', 'level', 'message', 'metadata'];
            const csvRows = [headers.join(',')];
            
            logs.forEach(log => {
                const row = [
                    log.timestamp,
                    log.level,
                    `"${log.message.replace(/"/g, '""')}"`,
                    `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
                ];
                csvRows.push(row.join(','));
            });
            
            return csvRows.join('\n');
        }
        
        return JSON.stringify(logs, null, 2);
    }
}

module.exports = new Logger();
