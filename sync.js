const axios = require('axios');
const db = require('./db');
const logger = require('./logger');
const connection = require('./connection');

class SyncEngine {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
        this.syncFrequency = 3000; // 3 seconds (more aggressive)
        this.maxRetries = 5; // Increased retries
        this.retryDelay = 2000; // 2 seconds (faster retry)
        this.baseUrl = 'https://jsonplaceholder.typicode.com';
        this.listeners = [];
        this.conflictStrategy = 'last_write_wins'; // Options: 'last_write_wins', 'manual', 'ignore'
    }

    async init() {
        // Start listening for connection changes
        connection.addListener(async (isOnline, previousStatus) => {
            if (isOnline && !previousStatus) {
                // Connection restored, start syncing and aggressive caching
                await this.startSync();
                await this.aggressiveCacheFetch();
            }
        });

        // Start periodic sync when online
        this.startPeriodicSync();
        
        // Start periodic aggressive caching
        this.startAggressiveCaching();
        
        logger.info('Sync engine initialized with aggressive caching');
    }

    startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (connection.isOnline && !this.isSyncing) {
                const queue = await db.getQueuedRequests();
                if (queue.length > 0) {
                    await this.syncQueuedRequests();
                }
            }
        }, this.syncFrequency);

        logger.info('Aggressive periodic sync started', { frequency: this.syncFrequency });
    }

    async aggressiveCacheFetch() {
        if (!connection.isOnline) {
            return;
        }

        logger.info('Starting aggressive cache fetch');
        
        try {
            // Fetch all common endpoints to populate cache
            const endpoints = [
                '/posts',
                '/posts/1',
                '/posts/2',
                '/users',
                '/users/1',
                '/users/2',
                '/comments',
                '/comments/1',
                '/albums',
                '/albums/1',
                '/photos',
                '/photos/1',
                '/todos',
                '/todos/1'
            ];

            const fetchPromises = endpoints.map(async (endpoint) => {
                try {
                    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                        timeout: 3000,
                        validateStatus: (status) => status < 500
                    });
                    
                    // Cache the response
                    await db.cacheResponse(
                        endpoint,
                        'GET',
                        response.data,
                        response.headers,
                        response.status
                    );
                    
                    logger.info('Aggressively cached endpoint', { endpoint, status: response.status });
                } catch (error) {
                    logger.warn('Failed to cache endpoint', { endpoint, error: error.message });
                }
            });

            await Promise.allSettled(fetchPromises);
            logger.info('Aggressive cache fetch completed');
            
        } catch (error) {
            logger.error('Aggressive cache fetch failed', { error: error.message });
        }
    }

    startAggressiveCaching() {
        if (this.cacheInterval) {
            clearInterval(this.cacheInterval);
        }

        // Fetch fresh data every 30 seconds when online
        this.cacheInterval = setInterval(async () => {
            if (connection.isOnline) {
                await this.aggressiveCacheFetch();
            }
        }, 30000);

        logger.info('Aggressive caching started', { interval: 30000 });
    }

    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            logger.info('Periodic sync stopped');
        }
    }

    stopAggressiveCaching() {
        if (this.cacheInterval) {
            clearInterval(this.cacheInterval);
            this.cacheInterval = null;
            logger.info('Aggressive caching stopped');
        }
    }

    async startSync() {
        if (this.isSyncing) {
            logger.warn('Sync already in progress');
            return;
        }

        const queue = await db.getQueuedRequests();
        if (queue.length === 0) {
            logger.info('No queued requests to sync');
            return;
        }

        logger.syncStarted(queue.length);
        this.notifyListeners('sync_started', { queueSize: queue.length });

        try {
            const results = await this.syncQueuedRequests();
            const syncedCount = results.filter(r => r.success).length;
            const failedCount = results.filter(r => !r.success).length;

            logger.syncCompleted(syncedCount, failedCount);
            this.notifyListeners('sync_completed', { syncedCount, failedCount, results });

            // Update last sync timestamp
            await db.setState('last_sync', Date.now().toString());

        } catch (error) {
            logger.error('Sync process failed', { error: error.message });
            this.notifyListeners('sync_failed', { error: error.message });
        }
    }

    async syncQueuedRequests() {
        this.isSyncing = true;
        const results = [];

        try {
            const queue = await db.getQueuedRequests();
            
            for (const request of queue) {
                try {
                    const result = await this.syncRequest(request);
                    results.push(result);
                } catch (error) {
                    logger.syncFailed(request.method, request.endpoint, error);
                    results.push({
                        id: request.id,
                        success: false,
                        error: error.message,
                        request
                    });
                }
            }

        } finally {
            this.isSyncing = false;
        }

        return results;
    }

    async syncRequest(request) {
        const { id, method, endpoint, payload, temp_id, retry_count } = request;

        // Check retry limit
        if (retry_count >= this.maxRetries) {
            await db.updateQueueStatus(id, 'failed', null, null);
            throw new Error(`Max retries (${this.maxRetries}) exceeded`);
        }

        try {
            const response = await this.makeRequest(method, endpoint, payload);
            
            // Handle successful sync
            await db.updateQueueStatus(id, 'synced', response.data, Date.now());
            
            // Cache the response
            await db.cacheResponse(endpoint, method, response.data, response.headers, response.status);
            
            // Handle temporary ID replacement
            if (temp_id && response.data && response.data.id) {
                await this.handleTempIdReplacement(temp_id, response.data.id, endpoint);
            }
            
            // Check for conflicts
            await this.checkForConflicts(endpoint, payload, response.data);
            
            logger.requestSynced(method, endpoint, temp_id, response.data.id);
            
            return {
                id,
                success: true,
                response: response.data,
                tempId: temp_id,
                realId: response.data.id
            };

        } catch (error) {
            // Increment retry count
            await db.incrementRetryCount(id);
            
            // If it's a network error, we'll retry later
            if (this.isNetworkError(error)) {
                logger.warn('Network error during sync, will retry', {
                    requestId: id,
                    retryCount: retry_count + 1,
                    error: error.message
                });
                throw error;
            }
            
            // For other errors, mark as failed
            await db.updateQueueStatus(id, 'failed', null, null);
            throw error;
        }
    }

    async makeRequest(method, endpoint, payload) {
        const url = `${this.baseUrl}${endpoint}`;
        const startTime = Date.now();

        try {
            let response;
            
            switch (method.toUpperCase()) {
                case 'GET':
                    response = await axios.get(url);
                    break;
                case 'POST':
                    response = await axios.post(url, payload);
                    break;
                case 'PUT':
                    response = await axios.put(url, payload);
                    break;
                case 'PATCH':
                    response = await axios.patch(url, payload);
                    break;
                case 'DELETE':
                    response = await axios.delete(url);
                    break;
                default:
                    throw new Error(`Unsupported method: ${method}`);
            }

            const responseTime = Date.now() - startTime;
            logger.apiRequest(method, endpoint, response.status, responseTime);
            
            return response;

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.apiRequestFailed(method, endpoint, error);
            
            // Add response time to error for logging
            error.responseTime = responseTime;
            throw error;
        }
    }

    async handleTempIdReplacement(tempId, realId, endpoint) {
        // This would typically update local references to the temporary ID
        // For now, we'll just log it and potentially update cached data
        
        logger.info('Temporary ID replaced', {
            tempId,
            realId,
            endpoint
        });

        // Update any cached data that might contain the temp ID
        try {
            const cachedResponse = await db.getCachedResponse(endpoint, 'POST');
            if (cachedResponse && cachedResponse.response.id === tempId) {
                const updatedResponse = { ...cachedResponse.response, id: realId };
                await db.cacheResponse(endpoint, 'POST', updatedResponse, cachedResponse.headers, cachedResponse.status_code);
            }
        } catch (error) {
            logger.warn('Failed to update cached data with real ID', {
                tempId,
                realId,
                endpoint,
                error: error.message
            });
        }
    }

    async checkForConflicts(endpoint, localData, serverData) {
        try {
            // Check if we have cached data for this endpoint
            const cached = await db.getCachedResponse(endpoint, 'GET');
            
            if (cached && cached.response) {
                // Simple conflict detection: compare data
                const localString = JSON.stringify(localData);
                const serverString = JSON.stringify(serverData);
                const cachedString = JSON.stringify(cached.response);
                
                if (localString !== cachedString && serverString !== cachedString) {
                    // Conflict detected
                    await this.handleConflict(endpoint, localData, serverData, cached.response);
                }
            }
        } catch (error) {
            logger.warn('Conflict check failed', {
                endpoint,
                error: error.message
            });
        }
    }

    async handleConflict(endpoint, localData, serverData, cachedData) {
        // Log the conflict
        await db.addConflict(endpoint, localData, serverData);
        logger.conflictDetected(endpoint, localData, serverData);

        let resolution;
        
        switch (this.conflictStrategy) {
            case 'last_write_wins':
                // Use server data (most recent)
                resolution = 'server_wins';
                await db.cacheResponse(endpoint, 'GET', serverData, {}, 200);
                break;
                
            case 'manual':
                // Keep conflict for manual resolution
                resolution = 'manual_review_required';
                break;
                
            case 'ignore':
                // Keep local data
                resolution = 'local_wins';
                break;
                
            default:
                resolution = 'server_wins';
                await db.cacheResponse(endpoint, 'GET', serverData, {}, 200);
        }

        logger.conflictResolved(endpoint, resolution);
        this.notifyListeners('conflict_resolved', { endpoint, resolution, strategy: this.conflictStrategy });
    }

    isNetworkError(error) {
        return (
            error.code === 'ECONNRESET' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            error.message.includes('Network Error') ||
            error.message.includes('timeout')
        );
    }

    // Conflict resolution methods
    async getConflicts() {
        return await db.getConflicts();
    }

    async resolveConflict(conflictId, resolution, newData = null) {
        const conflict = await db.get('SELECT * FROM conflicts WHERE id = ?', [conflictId]);
        
        if (!conflict) {
            throw new Error('Conflict not found');
        }

        let finalData;
        
        switch (resolution) {
            case 'use_local':
                finalData = JSON.parse(conflict.local_data);
                break;
            case 'use_server':
                finalData = JSON.parse(conflict.server_data);
                break;
            case 'use_custom':
                if (!newData) {
                    throw new Error('Custom data required for custom resolution');
                }
                finalData = newData;
                break;
            default:
                throw new Error('Invalid resolution strategy');
        }

        // Update cache with resolved data
        await db.cacheResponse(conflict.endpoint, 'GET', finalData, {}, 200);
        
        // Mark conflict as resolved
        await db.resolveConflict(conflictId, resolution);
        
        logger.conflictResolved(conflict.endpoint, resolution);
        this.notifyListeners('conflict_manually_resolved', { conflictId, resolution });
        
        return finalData;
    }

    // Event listener management
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                logger.error('Error in sync listener', { error: error.message });
            }
        });
    }

    // Configuration methods
    setConflictStrategy(strategy) {
        if (['last_write_wins', 'manual', 'ignore'].includes(strategy)) {
            this.conflictStrategy = strategy;
            logger.info('Conflict strategy updated', { strategy });
        } else {
            throw new Error('Invalid conflict strategy');
        }
    }

    setMaxRetries(maxRetries) {
        this.maxRetries = Math.max(0, maxRetries);
        logger.info('Max retries updated', { maxRetries: this.maxRetries });
    }

    setRetryDelay(delay) {
        this.retryDelay = Math.max(1000, delay);
        logger.info('Retry delay updated', { retryDelay: this.retryDelay });
    }

    setSyncFrequency(frequency) {
        this.syncFrequency = Math.max(5000, frequency);
        if (this.syncInterval) {
            this.startPeriodicSync();
        }
        logger.info('Sync frequency updated', { frequency: this.syncFrequency });
    }

    // Statistics
    async getStats() {
        const stats = await db.getStats();
        const conflicts = await this.getConflicts();
        
        return {
            ...stats,
            isSyncing: this.isSyncing,
            conflictStrategy: this.conflictStrategy,
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay,
            syncFrequency: this.syncFrequency,
            unresolvedConflicts: conflicts.filter(c => !c.resolution).length
        };
    }

    // Manual sync methods
    async syncSingleRequest(requestId) {
        const request = await db.get('SELECT * FROM queue WHERE id = ?', [requestId]);
        
        if (!request) {
            throw new Error('Request not found');
        }

        return await this.syncRequest(request);
    }

    async retryFailedRequests() {
        const failedRequests = await db.getQueuedRequests('failed');
        const results = [];

        for (const request of failedRequests) {
            // Reset status to pending
            await db.updateQueueStatus(request.id, 'pending', null, null);
            await db.run('UPDATE queue SET retry_count = 0 WHERE id = ?', [request.id]);
            
            try {
                const result = await this.syncRequest(request);
                results.push(result);
            } catch (error) {
                results.push({
                    id: request.id,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    // Cleanup
    destroy() {
        this.stopPeriodicSync();
        this.stopAggressiveCaching();
        this.listeners = [];
        logger.info('Sync engine destroyed');
    }
}

module.exports = new SyncEngine();
