export type AiStreamLanguage = 'vi' | 'en';

export type AiStreamConnectionParams = {
  sessionId: string;
  lat?: number;
  lng?: number;
  userId?: string;
  lang?: AiStreamLanguage;
};

export type AiStreamSessionContextMessage = {
  type: 'session_context';
  latitude?: number;
  longitude?: number;
  lang?: AiStreamLanguage;
  mimeType?: string;
};

export type AiStreamAudioChunkMessage = {
  type: 'audio_chunk';
  data: string;
};

export type AiStreamAudioEndMessage = {
  type: 'audio_end';
};

export type AiStreamOutgoingMessage =
  | AiStreamSessionContextMessage
  | AiStreamAudioChunkMessage
  | AiStreamAudioEndMessage;

export type AiStreamAudioMessage = {
  type: 'audio';
  data: string;
  text?: string;
};

export type AiStreamTextMessage = {
  type: 'text';
  text: string;
};

export type AiStreamActionResultMessage = {
  type: 'action_result';
  tool?: string;
  result?: {
    bookingId?: string;
    status?: string;
    driverEta?: number;
    [key: string]: unknown;
  };
  text_response?: string;
};

export type AiStreamFallbackResponseMessage = {
  type: 'fallback_response';
  text_response?: string;
  audio_base64?: string;
};

export type AiStreamErrorMessage = {
  type: 'error';
  message?: string;
};

export type AiStreamIncomingMessage =
  | AiStreamAudioMessage
  | AiStreamTextMessage
  | AiStreamActionResultMessage
  | AiStreamFallbackResponseMessage
  | AiStreamErrorMessage
  | {
      type?: string;
      [key: string]: unknown;
    };

export type AiStreamCallbacks = {
  onOpen?: () => void;
  onMessage?: (message: AiStreamIncomingMessage) => void;
  onError?: (error: Event) => void;
  onClose?: (event: WebSocketCloseEvent) => void;
};

const appendQueryParam = (queryParams: string[], key: string, value: string | number | undefined): void => {
  if (value === undefined) {
    return;
  }

  queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
};

export const buildAiStreamUrl = (
  baseWsUrl: string,
  { sessionId, lat, lng, userId, lang }: AiStreamConnectionParams,
): string => {
  const normalizedBaseUrl = baseWsUrl.replace(/\/$/, '');
  const queryParams: string[] = [];

  appendQueryParam(queryParams, 'lat', lat);
  appendQueryParam(queryParams, 'lng', lng);
  appendQueryParam(queryParams, 'userId', userId);
  appendQueryParam(queryParams, 'lang', lang);

  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

  return `${normalizedBaseUrl}/${encodeURIComponent(sessionId)}${queryString}`;
};

export class AiStreamClient {
  private socket: WebSocket | null = null;

  private readonly url: string;

  private readonly callbacks: AiStreamCallbacks;

  constructor(baseWsUrl: string, params: AiStreamConnectionParams, callbacks: AiStreamCallbacks = {}) {
    this.url = buildAiStreamUrl(baseWsUrl, params);
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.callbacks.onOpen?.();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      try {
        this.callbacks.onMessage?.(JSON.parse(event.data) as AiStreamIncomingMessage);
      } catch {
        this.callbacks.onMessage?.({
          type: 'error',
          message: 'Received invalid JSON from AI stream',
        });
      }
    };

    socket.onerror = (error) => {
      this.callbacks.onError?.(error);
    };

    socket.onclose = (event) => {
      this.callbacks.onClose?.(event);
    };
  }

  send(message: AiStreamOutgoingMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify(message));
    return true;
  }

  sendSessionContext(context: Omit<AiStreamSessionContextMessage, 'type'>): boolean {
    return this.send({
      type: 'session_context',
      ...context,
    });
  }

  sendAudioChunk(base64Pcm16k: string): boolean {
    return this.send({
      type: 'audio_chunk',
      data: base64Pcm16k,
    });
  }

  sendAudioEnd(): boolean {
    return this.send({
      type: 'audio_end',
    });
  }

  close(): void {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = null;
  }
}
