import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../config';
import { updateDriverLocation } from '../services/drivers';

export const PASSENGER_COORD = { latitude: 10.7600, longitude: 106.6600 };

interface DriverContextProps {
  isOnline: boolean;
  setIsOnline: (val: boolean) => void;
  driverLocation: { latitude: number; longitude: number } | null;
  currentRide: any;
  setCurrentRide: (ride: any) => void;
  distance: number;
  activeDriver: any;
  setActiveDriver: (driver: any) => void;
  driversList: any[];
  refreshDrivers: () => Promise<void>;
}

const DriverContext = createContext<DriverContextProps | undefined>(undefined);

export const DriverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [distance, setDistance] = useState(150);
  const [activeDriver, setActiveDriver] = useState<any>(null);
  const [driversList, setDriversList] = useState<any[]>([]);

  const refreshDrivers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/drivers`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setDriversList(result.data);
      }
    } catch (err) {
      console.warn('[DriverContext] Error refreshing drivers:', err);
    }
  };

  // 1. Fetch active driver session from Firestore on mount
  useEffect(() => {
    const initializeDriver = async () => {
      try {
        console.log('[DriverContext] Fetching drivers list from:', `${API_BASE_URL}/drivers`);
        const res = await fetch(`${API_BASE_URL}/drivers`);
        let driversData = await res.json();
        
        let drivers = driversData.data || [];
        if (drivers.length === 0) {
          // If no drivers, trigger seeding
          console.log('[DriverContext] No drivers found, seeding...');
          await fetch(`${API_BASE_URL}/drivers/seed`, { method: 'POST' });
          const retryRes = await fetch(`${API_BASE_URL}/drivers`);
          const retryData = await retryRes.json();
          drivers = retryData.data || [];
        }

        if (drivers.length > 0) {
          setDriversList(drivers);
          // Find first available driver or default to first driver
          const chosen = drivers.find((d: any) => !d.busy) || drivers[0];
          console.log('[DriverContext] Selected active driver:', chosen);
          setActiveDriver(chosen);
        }
      } catch (err) {
        console.error('[DriverContext] Error initializing driver:', err);
      }
    };

    initializeDriver();
  }, []);

  // 2. GPS tracking and syncing driver location to backend
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      try {
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 2 },
          (loc) => {
            const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setDriverLocation(coord);
            
            import('geolib').then(({ getDistance }) => {
               const dist = getDistance(coord, PASSENGER_COORD);
               setDistance(dist);
            });
            
            // Sync to backend via HTTP POST /drivers/location
            if (isOnline && activeDriver?.id) {
              updateDriverLocation(API_BASE_URL, {
                driverId: activeDriver.id,
                location: coord,
              }).catch((err) => {
                console.warn('[DriverContext] Sync location failed:', err.message);
              });
            }
          }
        );
      } catch (err) {
        console.warn(err);
      }
    })();
    
    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [isOnline, activeDriver?.id]);

  // 3. Poll for assigned rides (replacing WebSockets since backend is serverless)
  useEffect(() => {
    if (!isOnline || !activeDriver?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/bookings`);
        const result = await res.json();
        
        if (result.success && Array.isArray(result.data)) {
          // Find if there is an active booking assigned to this driver
          const activeRide = result.data.find(
            (booking: any) =>
              booking.driverId === activeDriver.id &&
              ['pending', 'accepted', 'in_progress', 'arrived'].includes(booking.status)
          );

          if (activeRide) {
            // Update current ride state
            setCurrentRide(activeRide);
          } else {
            setCurrentRide(null);
          }
        }
      } catch (err) {
        console.warn('[DriverContext] Error polling bookings:', err);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isOnline, activeDriver?.id]);

  return (
    <DriverContext.Provider
      value={{
        isOnline,
        setIsOnline,
        driverLocation,
        currentRide,
        setCurrentRide,
        distance,
        activeDriver,
        setActiveDriver,
        driversList,
        refreshDrivers,
      }}
    >
      {children}
    </DriverContext.Provider>
  );
};

export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) throw new Error('useDriver must be used within DriverProvider');
  return context;
};
