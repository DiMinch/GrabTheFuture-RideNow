// src/services/matching.ts
import { distanceMeters } from "./proximityEngine";

export interface Driver {
    id: string;
    busy: boolean;
    accessibilityFriendly: boolean;
    latitude: number;
    longitude: number;
}

export interface Location {
    latitude: number;
    longitude: number;
}

export const findBestDriver = (drivers: Driver[], pickup: Location): Driver | null => {
    // Lọc tài xế đang rảnh
    const candidates: Driver[] = drivers.filter((d) => !d.busy);
    
    if (candidates.length === 0) return null;

    // Sắp xếp theo logic ưu tiên: Accessibility Friendly -> Khoảng cách
    candidates.sort((a, b) => {
        // Ưu tiên tài xế thân thiện với người khiếm thị lên trước
        if (a.accessibilityFriendly !== b.accessibilityFriendly) {
            return a.accessibilityFriendly ? -1 : 1;
        }
        
        // Tính khoảng cách
        const distA = distanceMeters(pickup, a);
        const distB = distanceMeters(pickup, b);
        
        return distA - distB;
    });

    return candidates[0];
};