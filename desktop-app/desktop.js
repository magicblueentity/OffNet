// Enhanced Desktop App JavaScript
// Professional desktop application with advanced window management

class DesktopApp {
    constructor() {
        this.isElectron = typeof window.electronAPI !== 'undefined';
        this.serverStatus = null;
        this.settings = null;
        this.windowState = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.windowStartX = 0;
        this.windowStartY = 0;
        
        if (this.isElectron) {
            this.init();
        }
    }

    async init() {
        // Request notification permission
        if (window.windowAPI) {
            window.windowAPI.requestNotificationPermission();
        }

        // Load settings
        await this.loadSettings();
        
        // Setup enhanced UI
        this.createEnhancedUI();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start monitoring
        this.startServerMonitoring();
        this.startWindowStateMonitoring();
    }

    async loadSettings() {
        try {
            this.settings = await window.electronAPI.getSettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = {
                autoStart: true,
                minimizeToTray: false,
                startMinimized: false,
                enableNotifications: true
            };
        }
    }

    createEnhancedUI() {
        // Create enhanced title bar
        this.createTitleBar();
        
        // Create sidebar
        this.createSidebar();
        
        // Create floating panel
        this.createFloatingPanel();
        
        // Add window controls
        this.addWindowControls();
        
        // Add resize handles
        this.addResizeHandles();
        
        // Update container class
        const container = document.querySelector('.container');
        if (container) {
            container.classList.add('desktop-app');
        }
    }

    createTitleBar() {
        // Remove existing title bar if any
        const existingTitleBar = document.querySelector('.title-bar');
        if (existingTitleBar) {
            existingTitleBar.remove();
        }

        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar';
        titleBar.innerHTML = `
            <div class="title-bar-left">
                <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>" 
                     alt="OffNet" class="title-bar-icon">
                <span class="title-bar-text">OffNet - Advanced Offline-First Middleware</span>
            </div>
            <div class="title-bar-center">
                <span class="title-bar-text" id="windowTitle">OffNet</span>
            </div>
            <div class="title-bar-right">
                <div class="server-status-indicator">
                    <div class="server-status-dot" id="serverStatusDot"></div>
                    <span class="server-status-text" id="serverStatusText">Checking...</span>
                </div>
                <div class="window-actions">
                    <button class="window-action-btn" onclick="window.electronAPI.minimizeWindow()" title="Minimize">−</button>
                    <button class="window-action-btn" onclick="window.electronAPI.maximizeWindow()" title="Maximize">□</button>
                    <button class="window-action-btn" onclick="window.electronAPI.closeWindow()" title="Close">×</button>
                </div>
                <div class="window-controls">
                    <div class="window-btn minimize" onclick="window.electronAPI.minimizeWindow()" title="Minimize"></div>
                    <div class="window-btn maximize" onclick="window.electronAPI.maximizeWindow()" title="Maximize"></div>
                    <div class="window-btn close" onclick="window.electronAPI.closeWindow()" title="Close"></div>
                </div>
            </div>
        `;
        
        document.body.insertBefore(titleBar, document.body.firstChild);
        
        // Setup dragging for title bar
        this.setupTitleBarDragging(titleBar);
    }

    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-item active" data-section="dashboard" title="Dashboard">
                🏠
                <span class="sidebar-tooltip">Dashboard</span>
            </div>
            <div class="sidebar-item" data-section="server" title="Server">
                🖥️
                <span class="sidebar-tooltip">Server</span>
            </div>
            <div class="sidebar-item" data-section="settings" title="Settings">
                ⚙️
                <span class="sidebar-tooltip">Settings</span>
            </div>
            <div class="sidebar-item" data-section="logs" title="Logs">
                📋
                <span class="sidebar-tooltip">Logs</span>
            </div>
            <div class="sidebar-item" data-section="about" title="About">
                ℹ️
                <span class="sidebar-tooltip">About</span>
            </div>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(sidebar, container.firstChild);
        }
        
        // Setup sidebar interactions
        this.setupSidebarInteractions(sidebar);
    }

    createFloatingPanel() {
        const existingPanel = document.querySelector('.floating-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.className = 'floating-panel';
        panel.innerHTML = `
            <div class="floating-panel-title">
                <span>⚡</span>
                System Status
            </div>
            <div class="floating-panel-content">
                <div class="floating-panel-row">
                    <span class="floating-panel-label">Server:</span>
                    <span class="floating-panel-value" id="panelServerStatus">Checking...</span>
                </div>
                <div class="floating-panel-row">
                    <span class="floating-panel-label">Port:</span>
                    <span class="floating-panel-value">3000</span>
                </div>
                <div class="floating-panel-row">
                    <span class="floating-panel-label">Version:</span>
                    <span class="floating-panel-value" id="panelAppVersion">Loading...</span>
                </div>
                <div class="floating-panel-row">
                    <span class="floating-panel-label">Uptime:</span>
                    <span class="floating-panel-value" id="panelUptime">0s</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    setupTitleBarDragging(titleBar) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        titleBar.addEventListener('mousedown', async (e) => {
            if (e.target.closest('.window-controls') || e.target.closest('.window-actions') || e.target.closest('.server-status-indicator')) {
                return;
            }
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const windowBounds = window.electronAPI ? await window.electronAPI.getWindowState() : { x: 0, y: 0 };
            initialX = windowBounds.x || 0;
            initialY = windowBounds.y || 0;
            
            titleBar.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Send move command to main process
            if (window.electronAPI) {
                // This would require additional IPC setup for window movement
                // For now, we'll use CSS positioning as a fallback
                const container = document.querySelector('.container');
                if (container) {
                    container.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                titleBar.style.cursor = 'grab';
                
                // Reset transform
                const container = document.querySelector('.container');
                if (container) {
                    container.style.transform = '';
                }
            }
        });
    }

    setupSidebarInteractions(sidebar) {
        const items = sidebar.querySelectorAll('.sidebar-item');
        
        items.forEach(item => {
            item.addEventListener('click', () => {
                // Remove active class from all items
                items.forEach(i => i.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Handle section switching
                const section = item.dataset.section;
                this.switchToSection(section);
            });
        });
    }

    switchToSection(section) {
        // This would handle switching between different sections
        // For now, we'll just show a notification
        this.showNotification(`Switched to ${section}`, 'info');
        
        // You can implement actual section switching here
        switch(section) {
            case 'dashboard':
                // Already on dashboard
                break;
            case 'server':
                this.showServerDialog();
                break;
            case 'settings':
                this.showSettingsDialog();
                break;
            case 'logs':
                this.showLogsDialog();
                break;
            case 'about':
                this.showAboutDialog();
                break;
        }
    }

    addWindowControls() {
        // Window controls are now part of the title bar
        // Additional controls can be added here if needed
    }

    addResizeHandles() {
        // Add resize handles for window resizing
        const container = document.querySelector('.container');
        if (!container) return;

        const resizeHandles = [
            { position: 'top', cursor: 'ns-resize' },
            { position: 'right', cursor: 'ew-resize' },
            { position: 'bottom', cursor: 'ns-resize' },
            { position: 'left', cursor: 'ew-resize' },
            { position: 'top-right', cursor: 'nesw-resize' },
            { position: 'top-left', cursor: 'nwse-resize' },
            { position: 'bottom-right', cursor: 'nwse-resize' },
            { position: 'bottom-left', cursor: 'nesw-resize' }
        ];

        resizeHandles.forEach(handle => {
            const handleElement = document.createElement('div');
            handleElement.className = `resize-handle ${handle.position}`;
            handleElement.style.cssText = `
                position: absolute;
                ${handle.position}: 0;
                ${handle.position.includes('top') ? 'top: 0;' : ''}
                ${handle.position.includes('bottom') ? 'bottom: 0;' : ''}
                ${handle.position.includes('left') ? 'left: 0;' : ''}
                ${handle.position.includes('right') ? 'right: 0;' : ''}
                width: ${handle.position.includes('left') || handle.position.includes('right') ? '8px' : '100%'};
                height: ${handle.position.includes('top') || handle.position.includes('bottom') ? '8px' : '100%'};
                cursor: ${handle.cursor};
                z-index: 10001;
                -webkit-app-region: no-drag;
            `;
            
            container.appendChild(handleElement);
            
            // Add resize functionality
            this.setupResizeHandle(handleElement, handle.position);
        });
    }

    setupResizeHandle(handle, position) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const container = document.querySelector('.container');
            if (container) {
                startWidth = container.offsetWidth;
                startHeight = container.offsetHeight;
                startLeft = container.offsetLeft;
                startTop = container.offsetTop;
            }
            
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const container = document.querySelector('.container');
            if (container) {
                // Handle different resize directions
                if (position.includes('right')) {
                    container.style.width = `${Math.max(800, startWidth + deltaX)}px`;
                }
                if (position.includes('bottom')) {
                    container.style.height = `${Math.max(600, startHeight + deltaY)}px`;
                }
                if (position.includes('left')) {
                    const newWidth = Math.max(800, startWidth - deltaX);
                    container.style.width = `${newWidth}px`;
                    container.style.left = `${startLeft + (startWidth - newWidth)}px`;
                }
                if (position.includes('top')) {
                    const newHeight = Math.max(600, startHeight - deltaY);
                    container.style.height = `${newHeight}px`;
                    container.style.top = `${startTop + (startHeight - newHeight)}px`;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.restartServer();
                        break;
                    case 's':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.stopServer();
                        } else {
                            this.startServer();
                        }
                        break;
                    case 'm':
                        e.preventDefault();
                        window.electronAPI?.minimizeWindow();
                        break;
                    case 'w':
                        e.preventDefault();
                        window.electronAPI?.closeWindow();
                        break;
                    case ',':
                        e.preventDefault();
                        this.showSettingsDialog();
                        break;
                }
            }
        });

        // Window state changes
        if (window.electronAPI && window.electronAPI.onWindowStateChanged) {
            window.electronAPI.onWindowStateChanged((event, state) => {
                this.updateWindowState(state);
            });
        }

        // Server status updates
        if (window.electronAPI && window.electronAPI.onServerStatus) {
            window.electronAPI.onServerStatus((event, status) => {
                this.updateServerStatus(status);
            });
        }

        // Show notifications
        if (window.electronAPI && window.electronAPI.onShowNotification) {
            window.electronAPI.onShowNotification((event, notification) => {
                this.showNotification(notification.body, notification.title.toLowerCase());
            });
        }
    }

    async startServerMonitoring() {
        // Get initial server status
        try {
            const status = await window.electronAPI.getServerStatus();
            this.updateServerStatus(status);
        } catch (error) {
            console.error('Failed to get server status:', error);
        }

        // Get app version
        try {
            const version = await window.electronAPI.getAppVersion();
            const versionEl = document.getElementById('panelAppVersion');
            if (versionEl) versionEl.textContent = version;
        } catch (error) {
            console.error('Failed to get app version:', error);
        }

        // Monitor server status periodically
        setInterval(async () => {
            try {
                const status = await window.electronAPI.getServerStatus();
                this.updateServerStatus(status);
            } catch (error) {
                console.error('Failed to check server status:', error);
            }
        }, 3000);

        // Update uptime
        this.startTime = Date.now();
        setInterval(() => {
            this.updateUptime();
        }, 1000);
    }

    updateUptime() {
        if (!this.startTime) return;
        
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const uptimeEl = document.getElementById('panelUptime');
        if (uptimeEl) {
            if (uptime < 60) {
                uptimeEl.textContent = `${uptime}s`;
            } else if (uptime < 3600) {
                uptimeEl.textContent = `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
            } else {
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                uptimeEl.textContent = `${hours}h ${minutes}m`;
            }
        }
    }

    startWindowStateMonitoring() {
        // Get initial window state
        this.updateWindowState();
    }

    updateWindowState(state) {
        if (state) {
            this.windowState = state;
        } else {
            // Get current state from DOM
            this.windowState = {
                maximized: document.body.classList.contains('maximized'),
                focused: document.body.classList.contains('focused')
            };
        }

        // Update DOM classes
        document.body.classList.toggle('maximized', this.windowState.maximized);
        document.body.classList.toggle('focused', this.windowState.focused);
    }

    updateServerStatus(status) {
        this.serverStatus = status;
        
        // Update title bar status
        const statusDot = document.getElementById('serverStatusDot');
        const statusText = document.getElementById('serverStatusText');
        
        if (statusDot && statusText) {
            if (status.running) {
                statusDot.classList.add('online');
                statusDot.classList.remove('offline');
                statusText.textContent = 'Online';
            } else {
                statusDot.classList.add('offline');
                statusDot.classList.remove('online');
                statusText.textContent = 'Offline';
            }
        }

        // Update floating panel
        const panelStatus = document.getElementById('panelServerStatus');
        if (panelStatus) {
            panelStatus.textContent = status.running ? 'Running' : 'Stopped';
            panelStatus.style.color = status.running ? '#48bb78' : '#f56565';
        }

        // Update connection status in main content
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            const statusIndicator = connectionStatus.querySelector('.status-indicator');
            const statusTextElement = connectionStatus.querySelector('.status-text');
            
            if (statusIndicator && statusTextElement) {
                if (status.running) {
                    statusIndicator.classList.add('online');
                    statusIndicator.classList.remove('offline');
                    statusTextElement.textContent = 'Online';
                } else {
                    statusIndicator.classList.add('offline');
                    statusIndicator.classList.remove('online');
                    statusTextElement.textContent = 'Server Offline';
                }
            }
        }
    }

    async startServer() {
        try {
            const result = await window.electronAPI.startServer();
            this.showNotification(result.message, result.success ? 'success' : 'error');
        } catch (error) {
            this.showNotification('Failed to start server: ' + error.message, 'error');
        }
    }

    async stopServer() {
        try {
            const result = await window.electronAPI.stopServer();
            this.showNotification(result.message, result.success ? 'success' : 'error');
        } catch (error) {
            this.showNotification('Failed to stop server: ' + error.message, 'error');
        }
    }

    async restartServer() {
        try {
            const result = await window.electronAPI.restartServer();
            this.showNotification('Restarting server...', 'info');
        } catch (error) {
            this.showNotification('Failed to restart server: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast desktop ${type}`;
        toast.innerHTML = `
            <div class="toast-message">${message}</div>
        `;
        
        // Add to container or create one
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);

        // Show system notification if enabled
        if (this.settings.enableNotifications && window.windowAPI) {
            window.windowAPI.showNotification('OffNet', message);
        }
    }

    showServerDialog() {
        // This would open a detailed server status dialog
        this.showNotification('Server dialog coming soon!', 'info');
    }

    showSettingsDialog() {
        // This would open a settings dialog
        this.showNotification('Settings dialog coming soon!', 'info');
    }

    showLogsDialog() {
        // This would open a logs viewer dialog
        this.showNotification('Logs viewer coming soon!', 'info');
    }

    showAboutDialog() {
        // This would open an about dialog
        this.showNotification('About dialog coming soon!', 'info');
    }
}

// Initialize desktop app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DesktopApp();
});

// Export for global access
window.DesktopApp = DesktopApp;
