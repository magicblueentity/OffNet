const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

class OffNetBackgroundService {
    constructor() {
        this.syncProcess = null;
        this.settings = null;
        this.logs = [];
        this.setupService();
    }

    setupService() {
        console.log('Starting OffNet Background Service...');
        
        // Handle shutdown gracefully
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        
        // Load settings and start services
        this.loadSettings();
        this.startBackgroundServices();
    }

    loadSettings() {
        const settingsFile = path.join(__dirname, 'background-settings.json');
        try {
            if (fs.existsSync(settingsFile)) {
                this.settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            } else {
                this.settings = {
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
                this.saveSettings();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = {
                backgroundCaching: true,
                syncInterval: 30000,
                cacheEndpoints: ['/posts', '/users', '/comments']
            };
        }
    }

    saveSettings() {
        const settingsFile = path.join(__dirname, 'background-settings.json');
        try {
            fs.writeFileSync(settingsFile, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async startBackgroundServices() {
        if (this.settings.backgroundCaching) {
            await this.startBackgroundCaching();
        }
        
        console.log('OffNet Background Service started successfully');
    }

    async startBackgroundCaching() {
        if (this.syncProcess) {
            console.log('Background caching already running');
            return;
        }

        try {
            const syncScript = path.join(__dirname, 'background-sync.js');
            this.syncProcess = spawn('node', [syncScript], {
                cwd: path.join(__dirname, '..'),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    OFFNET_SETTINGS: JSON.stringify(this.settings)
                }
            });

            this.syncProcess.stdout.on('data', (data) => {
                const message = data.toString().trim();
                console.log(`[SYNC] ${message}`);
            });

            this.syncProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                console.error(`[SYNC ERROR] ${message}`);
            });

            this.syncProcess.on('error', (error) => {
                console.error(`Background sync error: ${error.message}`);
            });

            this.syncProcess.on('close', (code) => {
                console.log(`Background sync process exited with code ${code}`);
                this.syncProcess = null;
                
                // Restart if it wasn't intentionally stopped
                if (this.settings.backgroundCaching && code !== 0) {
                    setTimeout(() => {
                        this.startBackgroundCaching();
                    }, 5000);
                }
            });

            console.log('Background caching started');
            
        } catch (error) {
            console.error(`Failed to start background caching: ${error.message}`);
        }
    }

    stopBackgroundCaching() {
        if (this.syncProcess) {
            this.syncProcess.kill('SIGTERM');
            this.syncProcess = null;
            console.log('Background caching stopped');
        }
    }

    shutdown() {
        console.log('Shutting down background service...');
        
        this.stopBackgroundCaching();
        this.saveSettings();
        
        process.exit(0);
    }
}

// Create and start the background service
new OffNetBackgroundService();
