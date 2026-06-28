import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import socketService from '../services/socket';
import { rideApi } from '../services/api';

export const PASSENGER_COORD = { latitude: 10.7600, longitude: 106.6600 };

interface DriverContextProps {
  isOnline: boolean;
  setIsOnline: (val: boolean) => void;
  driverLocation: { latitude: number; longitude: number } | null;
  currentRide: any;
  setCurrentRide: (ride: any) => void;
  distance: number;
}

const DriverContext = createContext<DriverContextProps | undefined>(undefined);

export const DriverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [distance, setDistance] = useState(150);

  // GPS tracking
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
            
            if (isOnline) {
              socketService.send('driver_location_update', { lat: coord.latitude, lng: coord.longitude });
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
  }, [isOnline]);

  // Socket setup
  useEffect(() => {
    socketService.connect();
    socketService.on('ride_requested', (data: any) => {
      setCurrentRide(data || { id: 'mock' });
    });
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <DriverContext.Provider value={{ isOnline, setIsOnline, driverLocation, currentRide, setCurrentRide, distance }}>
      {children}
    </DriverContext.Provider>
  );
};

export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) throw new Error('useDriver must be used within DriverProvider');
  return context;
};
