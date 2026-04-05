const axios = require('axios');
const db = require('./db');
const logger = require('./logger');

class ConnectionManager {
    constructor() {
        this.isOnline = true;
        this.checkInterval = null;
        this.checkFrequency = 2000; // 2 seconds (more aggressive)
        this.testUrl = 'https://jsonplaceholder.typicode.com/posts/1';
        this.timeout = 2000; // 2 seconds timeout (faster detection)
        this.manualOverride = false;
        this.listeners = [];
    }

    async init() {
        // Load initial state from database
        const savedState = await db.isOnline();
        this.isOnline = savedState;
        
        // Start automatic connection checking
        this.startAutoCheck();
        
        logger.info('Connection manager initialized', { online: this.isOnline });
    }

    startAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(async () => {
            if (!this.manualOverride) {
                await this.checkConnection();
            }
        }, this.checkFrequency);

        logger.info('Automatic connection checking started', { frequency: this.checkFrequency });
    }

    stopAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Automatic connection checking stopped');
        }
    }

    async checkConnection() {
        try {
            const startTime = Date.now();
            
            // Make a simple HTTP request to test connectivity
            const response = await axios.get(this.testUrl, {
                timeout: this.timeout,
                validateStatus: (status) => status < 500 // Accept any response under 500
            });

            const responseTime = Date.now() - startTime;
            
            if (this.isOnline === false) {
                // We were offline, now we're back online
                await this.setOnlineStatus(true);
                logger.info('Connection restored', { 
                    responseTime,
                    status: response.status 
                });
            }

            return true;

        } catch (error) {
            if (this.isOnline === true) {
                // We were online, now we're offline
                await this.setOnlineStatus(false);
                logger.warn('Connection lost', { 
                    error: error.message,
                    code: error.code 
                });
            }

            return false;
        }
    }

    async setOnlineStatus(isOnline, isManual = false) {
        const previousStatus = this.isOnline;
        this.isOnline = isOnline;

        // Update database
        await db.setOnlineStatus(isOnline);

        // Log the status change
        if (previousStatus !== isOnline) {
            if (isOnline) {
                logger.info('Switched to ONLINE mode');
            } else {
                logger.info('Switched to OFFLINE mode');
            }
        }

        // Notify listeners
        this.notifyListeners(isOnline, previousStatus);

        // If this is a manual change, set the override flag
        if (isManual) {
            this.manualOverride = true;
            logger.info('Manual connection override set', { online: isOnline });
        } else if (this.manualOverride && !isManual) {
            // Clear manual override on automatic detection
            this.manualOverride = false;
            logger.info('Manual connection override cleared');
        }
    }

    async goOnline() {
        await this.setOnlineStatus(true, true);
        // Verify the connection
        const actuallyOnline = await this.checkConnection();
        if (!actuallyOnline) {
            logger.warn('Manual online mode activated but no actual connection');
        }
    }

    async goOffline() {
        await this.setOnlineStatus(false, true);
    }

    async clearManualOverride() {
        this.manualOverride = false;
        await this.checkConnection();
        logger.info('Manual override cleared, checking actual connection');
    }

    getStatus() {
        return {
            online: this.isOnline,
            manualOverride: this.manualOverride,
            autoCheckEnabled: this.checkInterval !== null,
            checkFrequency: this.checkFrequency
        };
    }

    // Event listener management
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    notifyListeners(isOnline, previousStatus) {
        this.listeners.forEach(callback => {
            try {
                callback(isOnline, previousStatus);
            } catch (error) {
                logger.error('Error in connection listener', { error: error.message });
            }
        });
    }

    // Advanced connection testing
    async testLatency() {
        const startTime = Date.now();
        try {
            await axios.get(this.testUrl, { timeout: this.timeout });
            return Date.now() - startTime;
        } catch (error) {
            return -1; // Indicates failure
        }
    }

    async testMultipleEndpoints() {
        const endpoints = [
            'https://jsonplaceholder.typicode.com/posts/1',
            'https://jsonplaceholder.typicode.com/users/1',
            'https://jsonplaceholder.typicode.com/comments/1'
        ];

        const results = [];
        
        for (const endpoint of endpoints) {
            try {
                const startTime = Date.now();
                await axios.get(endpoint, { timeout: this.timeout });
                results.push({
                    endpoint,
                    success: true,
                    latency: Date.now() - startTime
                });
            } catch (error) {
                results.push({
                    endpoint,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    // Configuration methods
    setCheckFrequency(frequency) {
        this.checkFrequency = Math.max(1000, frequency); // Minimum 1 second
        if (this.checkInterval) {
            this.startAutoCheck(); // Restart with new frequency
        }
        logger.info('Connection check frequency updated', { frequency: this.checkFrequency });
    }

    setTestUrl(url) {
        this.testUrl = url;
        logger.info('Test URL updated', { url });
    }

    setTimeout(timeout) {
        this.timeout = Math.max(1000, timeout); // Minimum 1 second
        logger.info('Connection timeout updated', { timeout: this.timeout });
    }

    // Statistics
    async getStats() {
        const latency = await this.testLatency();
        const multiTest = await this.testMultipleEndpoints();
        
        return {
            currentStatus: this.getStatus(),
            latency: latency,
            endpointTests: multiTest,
            timestamp: Date.now()
        };
    }

    // Cleanup
    destroy() {
        this.stopAutoCheck();
        this.listeners = [];
        logger.info('Connection manager destroyed');
    }
}

module.exports = new ConnectionManager();
