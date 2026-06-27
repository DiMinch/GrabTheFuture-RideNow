import { Platform } from 'react-native';

// In Expo, EXPO_PUBLIC_ prefix is loaded automatically from .env in development and production.
// We fallback to standard localhost URLs if not configured.
const fallbackBackendUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
const fallbackGatewayWsUrl = Platform.OS === 'android' ? 'ws://10.0.2.2:8000/api/ai/stream' : 'ws://localhost:8000/api/ai/stream';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || fallbackBackendUrl;
export const AI_GATEWAY_WS_URL = process.env.EXPO_PUBLIC_AI_GATEWAY_WS_URL || fallbackGatewayWsUrl;

// Base API URL including the '/api' prefix
export const API_BASE_URL = `${BACKEND_URL.replace(/\/$/, '')}/api`;

// Mocks configuration
export const MOCK_BLE_BEACON = process.env.EXPO_PUBLIC_MOCK_BLE_BEACON !== 'false';
export const MOCK_GPS_MOVEMENT = process.env.EXPO_PUBLIC_MOCK_GPS_MOVEMENT !== 'false';
