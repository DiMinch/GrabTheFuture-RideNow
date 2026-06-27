import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { updateDriverLocation } from '../../services/drivers';

interface DriverTrackingScreenProps {
  onConfirmPickup: () => void;
  driverId?: string;
}

type LocationSyncStatus = 'idle' | 'requesting-permission' | 'tracking' | 'syncing' | 'synced' | 'error' | 'denied';

type DriverPosition = {
  latitude: number;
  longitude: number;
  bearing?: number;
};

const API_BASE_URL = 'http://localhost:5000/api';
const DEFAULT_DRIVER_ID = 'driver-mock-1';
const LOCATION_UPDATE_INTERVAL_MS = 10000;

const locationOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: LOCATION_UPDATE_INTERVAL_MS,
  distanceInterval: 5,
};

async function requestLocationPermission(): Promise<boolean> {
  const permission = await Location.requestForegroundPermissionsAsync();
  return permission.granted;
}

function toDriverPosition(position: Location.LocationObject): DriverPosition {
  const { latitude, longitude, heading } = position.coords;
  const bearing = typeof heading === 'number' && heading >= 0 ? heading : undefined;

  return {
    latitude,
    longitude,
    ...(bearing !== undefined ? { bearing } : {}),
  };
}

function getLocationErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not read GPS position';
}

const DriverTrackingScreen: React.FC<DriverTrackingScreenProps> = ({
  onConfirmPickup,
  driverId = DEFAULT_DRIVER_ID,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = isDarkMode ? '#FFFFFF' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#CCCCCC' : '#555555';
  const cardBg = isDarkMode ? '#1E1E1E' : '#FFFFFF';

  // State to mock the ride progress
  const [distance, setDistance] = useState(150); // Starts at 150m
  const [bleConnected, setBleConnected] = useState(false);
  const [passengerSignaled, setPassengerSignaled] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<string | null>(null);
  const [lastKnownPosition, setLastKnownPosition] = useState<DriverPosition | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [locationSyncStatus, setLocationSyncStatus] = useState<LocationSyncStatus>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Mock decreasing distance to test UX flow
    const interval = setInterval(() => {
      setDistance((prev) => {
        if (prev <= 0) return 0;
        return prev - 10;
      });
    }, 2000); // Decreases 10m every 2s

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Handle distance milestones (TTS and State)
    let message = null;
    
    if (distance === 100) {
      message = "Visually impaired passenger is 100 meters ahead";
    } else if (distance === 50) {
      message = "Passenger is 50 meters ahead on the right";
    } else if (distance === 20) {
      message = "Passenger is flashing light and vibrating";
    } else if (distance === 10 && !bleConnected) {
      setBleConnected(true);
      message = "BLE Verification successful. Code: Flower";
    } else if (distance === 0 && !passengerSignaled) {
      setPassengerSignaled(true);
      message = "Passenger double-tapped to signal ready";
    }

    if (message) {
      setCurrentAlert(message);
      Speech.speak(message, { language: 'en-US' });
    }
  }, [distance]);

  useEffect(() => {
    let isActive = true;
    let locationSubscription: Location.LocationSubscription | null = null;
    let updateInterval: ReturnType<typeof setInterval> | null = null;
    let latestPosition: DriverPosition | null = null;
    let isPosting = false;

    const postLatestPosition = async (position: DriverPosition) => {
      if (isPosting) {
        return;
      }

      try {
        isPosting = true;
        setLocationSyncStatus('syncing');

        await updateDriverLocation(API_BASE_URL, {
          driverId,
          location: {
            latitude: position.latitude,
            longitude: position.longitude,
          },
          ...(position.bearing !== undefined ? { bearing: position.bearing } : {}),
        });

        if (isActive) {
          setLastSyncedAt(new Date());
          setLocationError(null);
          setLocationSyncStatus('synced');
        }
      } catch (error: any) {
        if (isActive) {
          setLocationError(error.message || 'Could not update driver location');
          setLocationSyncStatus('error');
        }
      } finally {
        isPosting = false;
      }
    };

    const handlePosition = (position: Location.LocationObject) => {
      latestPosition = toDriverPosition(position);

      if (isActive) {
        setLastKnownPosition(latestPosition);
        setLocationError(null);
        setLocationSyncStatus('tracking');
      }
    };

    const handlePositionError = (error: string) => {
      if (isActive) {
        setLocationError(getLocationErrorMessage(error));
        setLocationSyncStatus('error');
      }
    };

    const startTracking = async () => {
      try {
        setLocationSyncStatus('requesting-permission');

        const hasPermission = await requestLocationPermission();
        if (!isActive) {
          return;
        }

        if (!hasPermission) {
          setLocationSyncStatus('denied');
          setLocationError('Location permission is required to update driver location');
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync(locationOptions);
        const nextPosition = toDriverPosition(currentPosition);
        latestPosition = nextPosition;

        if (isActive) {
          setLastKnownPosition(nextPosition);
          void postLatestPosition(nextPosition);
        }

        locationSubscription = await Location.watchPositionAsync(
          locationOptions,
          handlePosition,
          handlePositionError,
        );

        if (!isActive) {
          locationSubscription.remove();
          return;
        }

        updateInterval = setInterval(() => {
          if (latestPosition) {
            void postLatestPosition(latestPosition);
          }
        }, LOCATION_UPDATE_INTERVAL_MS);
      } catch (error: unknown) {
        if (isActive) {
          setLocationError(getLocationErrorMessage(error));
          setLocationSyncStatus('error');
        }
      }
    };

    void startTracking();

    return () => {
      isActive = false;

      locationSubscription?.remove();

      if (updateInterval !== null) {
        clearInterval(updateInterval);
      }
    };
  }, [driverId]);

  const locationStatusText = (() => {
    if (locationSyncStatus === 'denied') {
      return 'PERMISSION NEEDED';
    }
    if (locationSyncStatus === 'error') {
      return 'ERROR';
    }
    if (locationSyncStatus === 'syncing') {
      return 'SYNCING...';
    }
    if (locationSyncStatus === 'synced') {
      return 'SYNCED';
    }
    if (locationSyncStatus === 'tracking') {
      return 'TRACKING';
    }
    if (locationSyncStatus === 'requesting-permission') {
      return 'REQUESTING...';
    }

    return 'STARTING...';
  })();

  return (
    <View style={styles.container}>
      {currentAlert && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>{currentAlert}</Text>
        </View>
      )}

      <View style={styles.distanceContainer}>
        <Text style={[styles.distanceLabel, { color: subTextColor }]}>Distance to passenger:</Text>
        <Text style={[styles.distanceValue, { color: textColor }]}>{distance}m</Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textColor }]}>Connection Status</Text>
        <View style={styles.divider} />
        
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Speaker Alert (TTS):</Text>
          <Text style={styles.statusActive}>ON</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>GPS API Sync:</Text>
          <Text style={locationSyncStatus === 'error' || locationSyncStatus === 'denied' ? styles.statusError : styles.statusActive}>
            {locationStatusText}
          </Text>
        </View>

        <Text style={[styles.locationDetail, { color: subTextColor }]}>
          {lastKnownPosition
            ? `${lastKnownPosition.latitude.toFixed(5)}, ${lastKnownPosition.longitude.toFixed(5)}${
                lastSyncedAt ? ` - ${lastSyncedAt.toLocaleTimeString()}` : ''
              }`
            : locationError || 'Waiting for GPS position...'}
        </Text>
        
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Detect Flash/Haptic ({'< 20m'}):</Text>
          <Text style={distance <= 20 ? styles.statusActive : styles.statusInactive}>
            {distance <= 20 ? 'DETECTED' : 'WAITING'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>BLE Secure Verification:</Text>
          <Text style={bleConnected ? styles.statusActive : styles.statusInactive}>
            {bleConnected ? 'SUCCESS (Code: Flower)' : 'SCANNING...'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Tap-to-Signal (WebSocket):</Text>
          <Text style={passengerSignaled ? styles.statusActive : styles.statusInactive}>
            {passengerSignaled ? 'PASSENGER READY' : 'WAITING...'}
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.finishButton, { opacity: passengerSignaled ? 1 : 0.6 }]} 
        onPress={onConfirmPickup}
        disabled={!passengerSignaled}
      >
        <Text style={styles.buttonText}>CONFIRM PICKUP</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  alertBanner: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  alertText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  distanceContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  distanceLabel: {
    fontSize: 18,
    marginBottom: 10,
  },
  distanceValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#00B0FF',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 40,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#CCCCCC55',
    marginVertical: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  statusLabel: {
    fontSize: 14,
    flex: 1,
  },
  statusActive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    flexShrink: 0,
    marginLeft: 10,
  },
  statusInactive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9E9E9E',
    flexShrink: 0,
    marginLeft: 10,
  },
  statusError: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
    flexShrink: 0,
    marginLeft: 10,
  },
  locationDetail: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  finishButton: {
    backgroundColor: '#6200EE',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default DriverTrackingScreen;
