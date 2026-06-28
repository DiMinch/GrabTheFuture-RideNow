import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const rideApi = {
  acceptRide: (rideId: string) => api.post(`/rides/${rideId}/accept`),
  rejectRide: (rideId: string) => api.post(`/rides/${rideId}/reject`),
  updateLocation: (lat: number, lng: number) => api.post(`/driver/location`, { lat, lng }),
};

export default api;
