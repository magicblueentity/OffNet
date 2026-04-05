const axios = require('axios');
const db = require('./db');
const logger = require('./logger');
const connection = require('./connection');
const sync = require('./sync');

class ProxyLayer {
    constructor() {
        this.baseUrl = 'https://jsonplaceholder.typicode.com';
        this.cacheEnabled = true;
        this.mockDataEnabled = true;
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    async init() {
        logger.info('Proxy layer initialized');
    }

    async handleRequest(req, res) {
        const { method, url: endpoint, body, headers } = req;
        
        try {
            // Log request interception
            logger.requestIntercepted(method, endpoint, body);
            
            // Apply request interceptors
            const processedRequest = await this.applyRequestInterceptors({
                method,
                endpoint,
                body,
                headers
            });

            // Check connection status
            const isOnline = await connection.isOnline();
            
            if (isOnline) {
                // Online mode: forward to real API
                const response = await this.forwardRequest(processedRequest);
                
                // Cache the response aggressively for all methods
                if (this.shouldCache(method, endpoint)) {
                    await db.cacheResponse(
                        endpoint, 
                        method, 
                        response.data, 
                        response.headers, 
                        response.status
                    );
                    logger.info('Response cached aggressively', { method, endpoint, status: response.status });
                }
                
                // Apply response interceptors
                const processedResponse = await this.applyResponseInterceptors(response);
                
                return this.sendResponse(res, processedResponse);
                
            } else {
                // Offline mode
                return await this.handleOfflineRequest(processedRequest, res);
            }
            
        } catch (error) {
            logger.error('Proxy request failed', {
                method,
                endpoint,
                error: error.message
            });
            
            return this.sendErrorResponse(res, error);
        }
    }

    async forwardRequest(request) {
        const { method, endpoint, body, headers } = request;
        const url = `${this.baseUrl}${endpoint}`;
        const startTime = Date.now();

        try {
            let response;
            const config = {
                headers: this.sanitizeHeaders(headers),
                timeout: 10000
            };

            switch (method.toUpperCase()) {
                case 'GET':
                    response = await axios.get(url, config);
                    break;
                case 'POST':
                    response = await axios.post(url, body, config);
                    break;
                case 'PUT':
                    response = await axios.put(url, body, config);
                    break;
                case 'PATCH':
                    response = await axios.patch(url, body, config);
                    break;
                case 'DELETE':
                    response = await axios.delete(url, config);
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
            
            // If it's a network error, we might be going offline
            if (this.isNetworkError(error)) {
                await connection.setOnlineStatus(false);
            }
            
            throw error;
        }
    }

    async handleOfflineRequest(request, res) {
        const { method, endpoint, body } = request;

        switch (method.toUpperCase()) {
            case 'GET':
                return await this.handleOfflineGet(endpoint, res);
                
            case 'POST':
            case 'PUT':
            case 'PATCH':
                return await this.handleOfflinePost(method, endpoint, body, res);
                
            case 'DELETE':
                return await this.handleOfflineDelete(endpoint, res);
                
            default:
                return this.sendErrorResponse(res, new Error(`Unsupported method: ${method}`));
        }
    }

    async handleOfflineGet(endpoint, res) {
        // Try to serve from cache
        const cached = await db.getCachedResponse(endpoint, 'GET');
        
        if (cached) {
            const age = Date.now() - cached.timestamp;
            logger.cacheHit(endpoint, 'GET', age);
            
            // Return cached response
            return res.status(cached.status_code || 200).json(cached.response);
        }

        // No cache available, generate mock data
        logger.cacheMiss(endpoint, 'GET');
        
        if (this.mockDataEnabled) {
            const mockResponse = this.generateMockResponse(endpoint, 'GET');
            logger.info('Mock response generated', { endpoint, method: 'GET' });
            
            return res.status(200).json(mockResponse);
        }

        // Return empty response
        return res.status(200).json([]);
    }

    async handleOfflinePost(method, endpoint, body, res) {
        // Generate temporary ID
        const tempId = this.generateTempId();
        
        // Queue the request for later sync
        const queueId = await db.queueRequest(method, endpoint, body, tempId);
        
        logger.requestQueued(method, endpoint, tempId);
        
        // Create simulated response
        const simulatedResponse = this.generateMockResponse(endpoint, method, body, tempId);
        
        logger.simulatedResponse(method, endpoint, tempId);
        
        // Return simulated response with pending status
        return res.status(201).json({
            ...simulatedResponse,
            _offline: {
                queued: true,
                tempId,
                queueId,
                status: 'pending'
            }
        });
    }

    async handleOfflineDelete(endpoint, res) {
        // Queue the delete request
        const queueId = await db.queueRequest('DELETE', endpoint, null, null);
        
        logger.requestQueued('DELETE', endpoint, null);
        
        // Return simulated success response
        return res.status(200).json({
            success: true,
            _offline: {
                queued: true,
                queueId,
                status: 'pending'
            }
        });
    }

    generateTempId() {
        return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateMockResponse(endpoint, method, body = null, tempId = null) {
        // Parse endpoint to determine resource type
        const resourceType = this.getResourceType(endpoint);
        const resourceId = this.getResourceId(endpoint);
        
        switch (resourceType) {
            case 'posts':
                return this.generatePostResponse(method, resourceId, body, tempId);
                
            case 'users':
                return this.generateUserResponse(method, resourceId, body, tempId);
                
            case 'comments':
                return this.generateCommentResponse(method, resourceId, body, tempId);
                
            case 'albums':
                return this.generateAlbumResponse(method, resourceId, body, tempId);
                
            case 'photos':
                return this.generatePhotoResponse(method, resourceId, body, tempId);
                
            case 'todos':
                return this.generateTodoResponse(method, resourceId, body, tempId);
                
            default:
                return this.generateGenericResponse(method, resourceId, body, tempId);
        }
    }

    getResourceType(endpoint) {
        const match = endpoint.match(/^\/([^\/]+)/);
        return match ? match[1] : 'unknown';
    }

    getResourceId(endpoint) {
        const match = endpoint.match(/^\/[^\/]+\/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    generatePostResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            if (resourceId) {
                return {
                    id: resourceId,
                    userId: 1,
                    title: 'Offline Post Title',
                    body: 'This is a mock post body generated while offline.',
                    _offline: true
                };
            } else {
                return [
                    {
                        id: 1,
                        userId: 1,
                        title: 'Offline Post 1',
                        body: 'This is the first mock post.',
                        _offline: true
                    },
                    {
                        id: 2,
                        userId: 1,
                        title: 'Offline Post 2',
                        body: 'This is the second mock post.',
                        _offline: true
                    }
                ];
            }
        } else if (method === 'POST') {
            return {
                id: tempId || 101,
                userId: body?.userId || 1,
                title: body?.title || 'New Offline Post',
                body: body?.body || 'This post was created while offline.',
                _offline: true
            };
        }
        
        return {};
    }

    generateUserResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            if (resourceId) {
                return {
                    id: resourceId,
                    name: 'Offline User',
                    username: 'offline_user',
                    email: 'offline@example.com',
                    address: {
                        street: 'Offline Street',
                        suite: 'Suite 123',
                        city: 'Offline City',
                        zipcode: '12345'
                    },
                    phone: '1-555-OFFLINE',
                    website: 'offline.example.com',
                    company: {
                        name: 'Offline Company',
                        catchPhrase: 'Working offline',
                        bs: 'offline solutions'
                    },
                    _offline: true
                };
            } else {
                return [
                    {
                        id: 1,
                        name: 'Offline User 1',
                        username: 'offline_user1',
                        email: 'user1@offline.example.com',
                        _offline: true
                    },
                    {
                        id: 2,
                        name: 'Offline User 2',
                        username: 'offline_user2',
                        email: 'user2@offline.example.com',
                        _offline: true
                    }
                ];
            }
        }
        
        return {};
    }

    generateCommentResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            return [
                {
                    id: 1,
                    postId: resourceId || 1,
                    name: 'Offline Commenter',
                    email: 'commenter@offline.example.com',
                    body: 'This is a mock comment generated while offline.',
                    _offline: true
                }
            ];
        } else if (method === 'POST') {
            return {
                id: tempId || 101,
                postId: body?.postId || 1,
                name: body?.name || 'Offline Commenter',
                email: body?.email || 'commenter@offline.example.com',
                body: body?.body || 'This comment was created while offline.',
                _offline: true
            };
        }
        
        return {};
    }

    generateAlbumResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            return [
                {
                    id: 1,
                    userId: 1,
                    title: 'Offline Album',
                    _offline: true
                }
            ];
        }
        
        return {};
    }

    generatePhotoResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            return [
                {
                    id: 1,
                    albumId: 1,
                    title: 'Offline Photo',
                    url: 'https://via.placeholder.com/600/92c952',
                    thumbnailUrl: 'https://via.placeholder.com/150/92c952',
                    _offline: true
                }
            ];
        }
        
        return {};
    }

    generateTodoResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            return [
                {
                    id: 1,
                    userId: 1,
                    title: 'Offline Todo',
                    completed: false,
                    _offline: true
                }
            ];
        } else if (method === 'POST') {
            return {
                id: tempId || 101,
                userId: body?.userId || 1,
                title: body?.title || 'New Offline Todo',
                completed: body?.completed || false,
                _offline: true
            };
        }
        
        return {};
    }

    generateGenericResponse(method, resourceId, body, tempId) {
        if (method === 'GET') {
            return resourceId ? { id: resourceId, _offline: true } : [{ id: 1, _offline: true }];
        } else if (method === 'POST') {
            return {
                id: tempId || 101,
                ...body,
                _offline: true
            };
        }
        
        return {};
    }

    shouldCache(method, endpoint) {
        // Cache ALL requests aggressively for better offline performance
        const cacheableMethods = ['GET', 'POST', 'PUT', 'PATCH'];
        const cacheableEndpoints = [
            '/posts', '/users', '/comments', '/albums', '/photos', '/todos',
            '/posts/', '/users/', '/comments/', '/albums/', '/photos/', '/todos/'
        ];
        
        return cacheableMethods.includes(method.toUpperCase()) &&
               cacheableEndpoints.some(ep => endpoint.startsWith(ep) || endpoint.includes(ep));
    }

    sanitizeHeaders(headers) {
        // Remove problematic headers
        const sanitized = { ...headers };
        delete sanitized['host'];
        delete sanitized['content-length'];
        delete sanitized['connection'];
        return sanitized;
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

    async applyRequestInterceptors(request) {
        let processed = { ...request };
        
        for (const interceptor of this.requestInterceptors) {
            try {
                processed = await interceptor(processed);
            } catch (error) {
                logger.error('Request interceptor failed', { error: error.message });
            }
        }
        
        return processed;
    }

    async applyResponseInterceptors(response) {
        let processed = response;
        
        for (const interceptor of this.responseInterceptors) {
            try {
                processed = await interceptor(processed);
            } catch (error) {
                logger.error('Response interceptor failed', { error: error.message });
            }
        }
        
        return processed;
    }

    sendResponse(res, response) {
        return res
            .status(response.status || 200)
            .set(response.headers || {})
            .json(response.data);
    }

    sendErrorResponse(res, error) {
        const status = error.response?.status || 500;
        const message = error.message || 'Internal Server Error';
        
        return res.status(status).json({
            error: message,
            _offline: !connection.isOnline,
            timestamp: Date.now()
        });
    }

    // Configuration methods
    enableCache(enabled) {
        this.cacheEnabled = enabled;
        logger.info('Proxy cache updated', { enabled });
    }

    enableMockData(enabled) {
        this.mockDataEnabled = enabled;
        logger.info('Mock data updated', { enabled });
    }

    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    // Statistics
    async getStats() {
        const stats = await db.getStats();
        
        return {
            ...stats,
            cacheEnabled: this.cacheEnabled,
            mockDataEnabled: this.mockDataEnabled,
            requestInterceptors: this.requestInterceptors.length,
            responseInterceptors: this.responseInterceptors.length
        };
    }

    // Cache management
    async clearCache() {
        await db.clearCache();
        logger.info('Proxy cache cleared');
    }

    async getCacheInfo() {
        const cache = await db.all('SELECT * FROM cache ORDER BY timestamp DESC');
        
        return cache.map(item => ({
            endpoint: item.endpoint,
            method: item.method,
            timestamp: item.timestamp,
            age: Date.now() - item.timestamp,
            status: item.status_code
        }));
    }
}

module.exports = new ProxyLayer();
