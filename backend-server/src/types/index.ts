// src/types/index.ts

// 1. Dữ liệu địa lý
export interface GeoPoint {
    latitude: number;
    longitude: number;
}

// 2. Dữ liệu Tài xế (Driver)
export interface Driver {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    busy: boolean;
    accessibilityFriendly: boolean; 
    rating: number;
}

// 3. Dữ liệu Cuốc xe (Booking)
export interface Booking {
    id?: string;
    riderId: string;
    driverId?: string;
    pickupLocation: GeoPoint;
    destinationLocation: GeoPoint;
    accessibilityMode: boolean; // Flag để hệ thống lọc tài xế
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    createdAt: Date;
}

// 4. Dữ liệu phản hồi API
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
}