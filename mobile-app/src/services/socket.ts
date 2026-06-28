class SocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.url = process.env.EXPO_PUBLIC_AI_GATEWAY_WS_URL || 'ws://localhost:8000/api/ai/stream';
  }

  connect() {
    if (this.ws) return;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket Connected');
      this.emit('connected', null);
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const event = data.event || 'message';
        this.emit(event, data.data || data);
      } catch (err) {
        console.warn('Socket message parse error:', err);
      }
    };

    this.ws.onerror = (e: any) => {
      console.error('WebSocket Error:', e.message);
    };

    this.ws.onclose = () => {
      console.log('WebSocket Disconnected');
      this.ws = null;
      this.emit('disconnected', null);
      // Optional: implement reconnect logic
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(
        event,
        callbacks.filter((cb) => cb !== callback)
      );
    }
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  send(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }
}

const socketService = new SocketService();
export default socketService;
