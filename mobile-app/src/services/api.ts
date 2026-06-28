import axios from 'axios';

import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
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
