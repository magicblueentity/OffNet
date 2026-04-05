// OffNet Frontend Application
class OffNetApp {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.currentConflict = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.connectWebSocket();
        await this.loadInitialData();
        this.startPeriodicUpdates();
    }

    setupEventListeners() {
        // Connection controls
        document.getElementById('goOnline').addEventListener('click', () => this.goOnline());
        document.getElementById('goOffline').addEventListener('click', () => this.goOffline());
        document.getElementById('clearCache').addEventListener('click', () => this.clearCache());
        document.getElementById('startSync').addEventListener('click', () => this.startSync());

        // API demo controls
        document.getElementById('fetchPosts').addEventListener('click', () => this.fetchPosts());
        document.getElementById('createPost').addEventListener('click', () => this.createPost());
        document.getElementById('fetchUsers').addEventListener('click', () => this.fetchUsers());
        document.getElementById('createUser').addEventListener('click', () => this.createUser());

        // Queue controls
        document.getElementById('refreshQueue').addEventListener('click', () => this.refreshQueue());
        document.getElementById('retryFailed').addEventListener('click', () => this.retryFailed());

        // Cache controls
        document.getElementById('refreshCache').addEventListener('click', () => this.refreshCache());
        document.getElementById('clearCacheBtn').addEventListener('click', () => this.clearCache());

        // Logs controls
        document.getElementById('refreshLogs').addEventListener('click', () => this.refreshLogs());
        document.getElementById('clearLogs').addEventListener('click', () => this.clearLogs());
        document.getElementById('logLevel').addEventListener('change', () => this.refreshLogs());

        // Conflicts controls
        document.getElementById('refreshConflicts').addEventListener('click', () => this.refreshConflicts());

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('conflictModal').addEventListener('click', (e) => {
            if (e.target.id === 'conflictModal') {
                this.closeModal();
            }
        });

        // Conflict resolution buttons
        document.querySelectorAll('[data-resolution]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.resolveConflict(e.target.dataset.resolution);
            });
        });
    }

    async connectWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.showToast('Connected to OffNet server', 'success');
                
                // Subscribe to updates
                this.ws.send(JSON.stringify({ type: 'subscribe_logs' }));
                this.ws.send(JSON.stringify({ type: 'subscribe_stats' }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.showToast('Disconnected from OffNet server', 'warning');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showToast('WebSocket connection error', 'error');
            };

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.showToast('Failed to connect to OffNet server', 'error');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay);
        } else {
            this.showToast('Failed to reconnect to OffNet server', 'error');
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'initial_status':
                this.updateConnectionStatus(data.data.connection);
                this.updateStats(data.data.stats);
                break;
                
            case 'connection_changed':
                this.updateConnectionStatus(data.data);
                this.showToast(`Connection changed: ${data.data.online ? 'Online' : 'Offline'}`, 'info');
                break;
                
            case 'sync_event':
                this.handleSyncEvent(data.event, data.data);
                break;
                
            case 'log_event':
                // Handle real-time log events if needed
                break;
                
            case 'pong':
                // WebSocket ping/pong response
                break;
                
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    handleSyncEvent(event, data) {
        switch (event) {
            case 'sync_started':
                this.showToast('Sync process started', 'info');
                this.showLoading(true);
                break;
                
            case 'sync_completed':
                this.showToast(`Sync completed: ${data.syncedCount} synced, ${data.failedCount} failed`, 'success');
                this.showLoading(false);
                this.refreshQueue();
                this.refreshStats();
                break;
                
            case 'sync_failed':
                this.showToast('Sync process failed', 'error');
                this.showLoading(false);
                break;
                
            case 'conflict_resolved':
                this.showToast('Conflict resolved', 'success');
                this.refreshConflicts();
                break;
                
            default:
                console.log('Unknown sync event:', event);
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.refreshConnectionStatus(),
                this.refreshStats(),
                this.refreshQueue(),
                this.refreshCache(),
                this.refreshLogs(),
                this.refreshConflicts()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load initial data', 'error');
        }
    }

    async refreshConnectionStatus() {
        try {
            const response = await fetch('/api/offline/connection/status');
            const status = await response.json();
            this.updateConnectionStatus(status);
        } catch (error) {
            console.error('Failed to refresh connection status:', error);
        }
    }

    updateConnectionStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        if (status.online) {
            indicator.classList.add('online');
            indicator.classList.remove('offline');
            text.textContent = 'Online';
        } else {
            indicator.classList.add('offline');
            indicator.classList.remove('online');
            text.textContent = 'Offline';
        }
    }

    async refreshStats() {
        try {
            const response = await fetch('/api/offline/stats');
            const stats = await response.json();
            this.updateStats(stats);
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('queueSize').textContent = stats.database.pending_requests || 0;
        document.getElementById('cacheSize').textContent = stats.database.cached_responses || 0;
        document.getElementById('syncedCount').textContent = stats.database.synced_requests || 0;
        document.getElementById('conflictCount').textContent = stats.database.unresolved_conflicts || 0;
        
        const lastSync = stats.database.last_sync || 0;
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSync > 0) {
            lastSyncElement.textContent = new Date(lastSync).toLocaleString();
        } else {
            lastSyncElement.textContent = 'Never';
        }
    }

    async refreshQueue() {
        try {
            const response = await fetch('/api/offline/queue');
            const queue = await response.json();
            this.displayQueue(queue);
        } catch (error) {
            console.error('Failed to refresh queue:', error);
        }
    }

    displayQueue(queue) {
        const queueList = document.getElementById('queueList');
        
        if (queue.length === 0) {
            queueList.innerHTML = '<p class="text-muted">No queued requests</p>';
            return;
        }

        queueList.innerHTML = queue.map(item => `
            <div class="queue-item ${item.status}">
                <div class="queue-item-info">
                    <span class="queue-item-method">${item.method}</span>
                    <span class="queue-item-endpoint">${item.endpoint}</span>
                    <div class="text-muted mt-1">
                        Created: ${new Date(item.created_at).toLocaleString()}
                        ${item.retry_count > 0 ? ` | Retries: ${item.retry_count}` : ''}
                        ${item.temp_id ? ` | Temp ID: ${item.temp_id}` : ''}
                    </div>
                </div>
                <span class="queue-item-status ${item.status}">${item.status}</span>
            </div>
        `).join('');
    }

    async refreshCache() {
        try {
            const response = await fetch('/api/offline/cache');
            const cache = await response.json();
            this.displayCache(cache);
        } catch (error) {
            console.error('Failed to refresh cache:', error);
        }
    }

    displayCache(cache) {
        const cacheList = document.getElementById('cacheList');
        
        if (cache.length === 0) {
            cacheList.innerHTML = '<p class="text-muted">No cached responses</p>';
            return;
        }

        cacheList.innerHTML = cache.map(item => `
            <div class="cache-item">
                <div class="cache-item-header">
                    <span class="cache-item-endpoint">${item.method} ${item.endpoint}</span>
                    <span class="cache-item-age">${this.formatAge(item.age)}</span>
                </div>
                <div class="cache-item-details">
                    <span>Status: ${item.status}</span>
                    <span>Cached: ${new Date(item.timestamp).toLocaleString()}</span>
                </div>
            </div>
        `).join('');
    }

    async refreshLogs() {
        try {
            const level = document.getElementById('logLevel').value;
            const response = await fetch(`/api/offline/logs?limit=50${level ? `&level=${level}` : ''}`);
            const logs = await response.json();
            this.displayLogs(logs);
        } catch (error) {
            console.error('Failed to refresh logs:', error);
        }
    }

    displayLogs(logs) {
        const logsList = document.getElementById('logsList');
        
        if (logs.length === 0) {
            logsList.innerHTML = '<p class="text-muted">No logs available</p>';
            return;
        }

        logsList.innerHTML = logs.map(log => `
            <div class="log-item ${log.level}">
                <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="log-level ${log.level}">${log.level}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    async refreshConflicts() {
        try {
            const response = await fetch('/api/offline/conflicts');
            const conflicts = await response.json();
            this.displayConflicts(conflicts);
        } catch (error) {
            console.error('Failed to refresh conflicts:', error);
        }
    }

    displayConflicts(conflicts) {
        const conflictsList = document.getElementById('conflictsList');
        
        if (conflicts.length === 0) {
            conflictsList.innerHTML = '<p class="text-muted">No conflicts</p>';
            return;
        }

        conflictsList.innerHTML = conflicts.map(conflict => `
            <div class="conflict-item">
                <div class="conflict-item-header">
                    <span class="conflict-endpoint">${conflict.endpoint}</span>
                    <div class="conflict-actions">
                        <button class="btn btn-primary" onclick="app.openConflictModal(${conflict.id})">Resolve</button>
                    </div>
                </div>
                <div class="text-muted">
                    Created: ${new Date(conflict.created_at).toLocaleString()}
                    ${conflict.resolution ? ` | Resolved: ${conflict.resolution}` : ''}
                </div>
            </div>
        `).join('');
    }

    // Connection control methods
    async goOnline() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/offline/connection/online', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Switched to online mode', 'success');
            } else {
                this.showToast('Failed to go online', 'error');
            }
        } catch (error) {
            console.error('Failed to go online:', error);
            this.showToast('Failed to go online', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async goOffline() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/offline/connection/offline', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Switched to offline mode', 'info');
            } else {
                this.showToast('Failed to go offline', 'error');
            }
        } catch (error) {
            console.error('Failed to go offline:', error);
            this.showToast('Failed to go offline', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async clearCache() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/offline/cache', { method: 'DELETE' });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Cache cleared successfully', 'success');
                this.refreshCache();
                this.refreshStats();
            } else {
                this.showToast('Failed to clear cache', 'error');
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
            this.showToast('Failed to clear cache', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async startSync() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/offline/sync/start', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Sync started', 'info');
            } else {
                this.showToast('Failed to start sync', 'error');
            }
        } catch (error) {
            console.error('Failed to start sync:', error);
            this.showToast('Failed to start sync', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async retryFailed() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/offline/sync/retry', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Retrying failed requests', 'info');
                this.refreshQueue();
            } else {
                this.showToast('Failed to retry requests', 'error');
            }
        } catch (error) {
            console.error('Failed to retry requests:', error);
            this.showToast('Failed to retry requests', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async clearLogs() {
        // This would require a backend endpoint to clear logs
        this.showToast('Log clearing not implemented yet', 'warning');
    }

    // API demo methods
    async fetchPosts() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/posts');
            const posts = await response.json();
            this.displayApiResults(posts);
            this.showToast('Posts fetched successfully', 'success');
        } catch (error) {
            console.error('Failed to fetch posts:', error);
            this.displayApiResults({ error: error.message });
            this.showToast('Failed to fetch posts', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async createPost() {
        const title = document.getElementById('postTitle').value.trim();
        const body = document.getElementById('postBody').value.trim();
        
        if (!title || !body) {
            this.showToast('Please fill in both title and body', 'warning');
            return;
        }

        try {
            this.showLoading(true);
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, body, userId: 1 })
            });
            const post = await response.json();
            this.displayApiResults(post);
            this.showToast('Post created successfully', 'success');
            
            // Clear form
            document.getElementById('postTitle').value = '';
            document.getElementById('postBody').value = '';
            
            // Refresh queue to show new queued item if offline
            this.refreshQueue();
        } catch (error) {
            console.error('Failed to create post:', error);
            this.displayApiResults({ error: error.message });
            this.showToast('Failed to create post', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchUsers() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/users');
            const users = await response.json();
            this.displayApiResults(users);
            this.showToast('Users fetched successfully', 'success');
        } catch (error) {
            console.error('Failed to fetch users:', error);
            this.displayApiResults({ error: error.message });
            this.showToast('Failed to fetch users', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async createUser() {
        try {
            this.showLoading(true);
            const userData = {
                name: 'Test User',
                username: 'testuser_' + Date.now(),
                email: `test${Date.now()}@example.com`,
                address: {
                    street: '123 Test St',
                    suite: 'Apt 1',
                    city: 'Test City',
                    zipcode: '12345'
                },
                phone: '1-555-TEST',
                website: 'test.example.com',
                company: {
                    name: 'Test Company',
                    catchPhrase: 'Testing offline functionality',
                    bs: 'offline solutions'
                }
            };

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            const user = await response.json();
            this.displayApiResults(user);
            this.showToast('User created successfully', 'success');
            
            // Refresh queue to show new queued item if offline
            this.refreshQueue();
        } catch (error) {
            console.error('Failed to create user:', error);
            this.displayApiResults({ error: error.message });
            this.showToast('Failed to create user', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayApiResults(data) {
        const resultsContainer = document.getElementById('apiResults');
        resultsContainer.textContent = JSON.stringify(data, null, 2);
    }

    // Conflict resolution methods
    async openConflictModal(conflictId) {
        try {
            const response = await fetch('/api/offline/conflicts');
            const conflicts = await response.json();
            const conflict = conflicts.find(c => c.id === conflictId);
            
            if (!conflict) {
                this.showToast('Conflict not found', 'error');
                return;
            }

            this.currentConflict = conflict;
            
            document.getElementById('localData').textContent = JSON.stringify(conflict.local_data, null, 2);
            document.getElementById('serverData').textContent = JSON.stringify(conflict.server_data, null, 2);
            
            document.getElementById('conflictModal').classList.add('show');
        } catch (error) {
            console.error('Failed to open conflict modal:', error);
            this.showToast('Failed to open conflict resolution', 'error');
        }
    }

    closeModal() {
        document.getElementById('conflictModal').classList.remove('show');
        this.currentConflict = null;
    }

    async resolveConflict(resolution) {
        if (!this.currentConflict) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await fetch(`/api/offline/conflicts/${this.currentConflict.id}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resolution })
            });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Conflict resolved successfully', 'success');
                this.closeModal();
                this.refreshConflicts();
                this.refreshStats();
            } else {
                this.showToast('Failed to resolve conflict', 'error');
            }
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            this.showToast('Failed to resolve conflict', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Utility methods
    formatAge(age) {
        if (age < 1000) {
            return 'Just now';
        } else if (age < 60000) {
            return `${Math.floor(age / 1000)}s ago`;
        } else if (age < 3600000) {
            return `${Math.floor(age / 60000)}m ago`;
        } else if (age < 86400000) {
            return `${Math.floor(age / 3600000)}h ago`;
        } else {
            return `${Math.floor(age / 86400000)}d ago`;
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showToast(message, type = 'info', details = null) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let content = `<div class="toast-message">${message}</div>`;
        if (details) {
            content += `<div class="toast-details">${details}</div>`;
        }
        
        toast.innerHTML = content;
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    startPeriodicUpdates() {
        // Update stats every 10 seconds
        setInterval(() => {
            this.refreshStats();
        }, 10000);

        // Update queue every 15 seconds
        setInterval(() => {
            this.refreshQueue();
        }, 15000);

        // Send WebSocket ping every 30 seconds
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new OffNetApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.app) {
        // Refresh data when page becomes visible again
        window.app.loadInitialData();
    }
});

// Handle connection errors
window.addEventListener('online', () => {
    if (window.app) {
        window.app.showToast('Browser connection restored', 'success');
        window.app.refreshConnectionStatus();
    }
});

window.addEventListener('offline', () => {
    if (window.app) {
        window.app.showToast('Browser connection lost', 'warning');
        window.app.refreshConnectionStatus();
    }
});
