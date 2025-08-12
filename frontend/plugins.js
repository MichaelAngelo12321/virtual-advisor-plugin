// Plugin Manager Module - Client-side plugin system

export class PluginManagerClient {
    constructor() {
        this.plugins = [];
    }

    register(plugin) {
        this.plugins.push(plugin);
    }

    emit(event, data) {
        for (const plugin of this.plugins) {
            const handler = plugin[event];
            if (typeof handler === 'function') {
                try { handler(data); } catch (e) { console.error('Plugin handler error:', e); }
            }
        }
    }
}