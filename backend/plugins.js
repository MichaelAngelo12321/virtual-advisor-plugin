/**
 * Plugin system for voice application hooks
 */

const EventEmitter = require('events');

class PluginManager extends EventEmitter {
    constructor() {
        super();
        this.plugins = new Map();
        this.eventQueue = [];
        this.isProcessingEvents = false;
    }

    /**
     * Register a plugin with event handlers
     * @param {Object} plugin - Plugin configuration
     * @param {string} plugin.name - Plugin name
     * @param {Function} plugin.onTranscript - Handler for final transcripts
     * @param {Function} plugin.onPartialTranscript - Handler for partial transcripts
     * @param {Function} plugin.onTTSStart - Handler for TTS start
     * @param {Function} plugin.onTTSStop - Handler for TTS stop
     * @param {Function} plugin.onUserStartedSpeaking - Handler for user speech detection
     * @param {Function} plugin.onError - Handler for errors
     */
    register(plugin) {
        if (!plugin.name) {
            throw new Error('Plugin must have a name');
        }

        if (this.plugins.has(plugin.name)) {
            console.log(`Plugin '${plugin.name}' is already registered, updating...`);
        }

        // Validate handlers
        const validHandlers = [
            'onTranscript',
            'onPartialTranscript', 
            'onTTSStart',
            'onTTSStop',
            'onUserStartedSpeaking',
            'onError'
        ];

        const pluginConfig = { name: plugin.name };
        
        validHandlers.forEach(handler => {
            if (plugin[handler] && typeof plugin[handler] === 'function') {
                pluginConfig[handler] = plugin[handler];
            }
        });

        this.plugins.set(plugin.name, pluginConfig);
        console.log(`Plugin '${plugin.name}' registered successfully`);

        return true;
    }

    /**
     * Unregister a plugin
     * @param {string} name - Plugin name
     */
    unregister(name) {
        if (this.plugins.has(name)) {
            this.plugins.delete(name);
            console.log(`Plugin '${name}' unregistered`);
            return true;
        }
        return false;
    }

    /**
     * Get list of registered plugins
     */
    getRegisteredPlugins() {
        return Array.from(this.plugins.keys());
    }

    /**
     * Emit event to all registered plugins
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     */
    async emit(eventType, data) {
        this.eventQueue.push({ eventType, data, timestamp: Date.now() });
        
        if (!this.isProcessingEvents) {
            this.processEventQueue();
        }
    }

    async processEventQueue() {
        this.isProcessingEvents = true;

        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            await this.processEvent(event);
        }

        this.isProcessingEvents = false;
    }

    async processEvent({ eventType, data, timestamp }) {
        const promises = [];

        for (const [name, plugin] of this.plugins) {
            const handler = plugin[eventType];
            
            if (handler) {
                try {
                    // Support both sync and async handlers
                    const result = handler(data, { pluginName: name, timestamp });
                    
                    if (result instanceof Promise) {
                        promises.push(
                            result.catch(error => {
                                console.error(`Error in plugin '${name}' handler '${eventType}':`, error);
                                return { error, pluginName: name };
                            })
                        );
                    }
                } catch (error) {
                    console.error(`Sync error in plugin '${name}' handler '${eventType}':`, error);
                }
            }
        }

        // Wait for all async handlers to complete
        if (promises.length > 0) {
            const results = await Promise.allSettled(promises);
            
            // Log any errors from async handlers
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Async handler error:`, result.reason);
                }
            });
        }
    }

    /**
     * Get plugin statistics
     */
    getStats() {
        return {
            totalPlugins: this.plugins.size,
            queueLength: this.eventQueue.length,
            isProcessing: this.isProcessingEvents,
            plugins: Array.from(this.plugins.entries()).map(([name, plugin]) => ({
                name,
                handlers: Object.keys(plugin).filter(key => key !== 'name' && typeof plugin[key] === 'function')
            }))
        };
    }

    /**
     * Create a simple plugin from handlers object
     * @param {string} name - Plugin name
     * @param {Object} handlers - Event handlers
     */
    createSimplePlugin(name, handlers) {
        return this.register({
            name,
            ...handlers
        });
    }

    /**
     * Destroy the plugin manager
     */
    destroy() {
        this.plugins.clear();
        this.eventQueue = [];
        this.isProcessingEvents = false;
        this.removeAllListeners();
    }
}

module.exports = PluginManager;