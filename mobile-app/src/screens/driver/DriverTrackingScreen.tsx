import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, useColorScheme } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { LangToggleButton } from '../../context/LanguageContext';
import { useDriver } from '../../context/DriverContext';
import TrackingBottomSheet from '../../components/driver/TrackingBottomSheet';
import TrackingAlertBanner from '../../components/driver/TrackingAlertBanner';
import { useLang } from '../../context/LanguageContext';
import { updateDriverLocation } from '../../services/drivers';
import { updateBookingStatus } from '../../services/bookings';
import { API_BASE_URL } from '../../config';
import { getBeaconColor } from '../../utils/beaconColor';

interface DriverTrackingScreenProps {
  onConfirmPickup?: () => void;
  driverId?: string;
}

type LocationSyncStatus = 'idle' | 'requesting-permission' | 'tracking' | 'syncing' | 'synced' | 'error' | 'denied';

type DriverPosition = {
  latitude: number;
  longitude: number;
  bearing?: number;
};

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
  driverId: driverIdProp,
}) => {
  const { driverLocation, distance, activeDriver, currentRide, setCurrentRide } = useDriver();
  const driverId = driverIdProp || activeDriver?.id || DEFAULT_DRIVER_ID;
  const { lang } = useLang();
  const beaconColor = getBeaconColor(currentRide?.id || '');
  const mapRef = useRef<MapView>(null);
  
  // Tọa độ điểm đón lấy từ booking, không dùng hardcode nữa
  const passengerCoord = currentRide?.pickupLocation
    ? { latitude: currentRide.pickupLocation.latitude, longitude: currentRide.pickupLocation.longitude }
    : (driverLocation || { latitude: 10.8756, longitude: 106.8007 });

  const isTripPhase = currentRide?.status?.toUpperCase() === 'IN_PROGRESS';
  const targetCoord = isTripPhase 
    ? (currentRide?.dropoffLocation 
        ? { latitude: currentRide.dropoffLocation.latitude, longitude: currentRide.dropoffLocation.longitude }
        : passengerCoord)
    : passengerCoord;
  
  const [mapReady, setMapReady] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [passengerSignaled, setPassengerSignaled] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertFlags, setAlertFlags] = useState({ alert100: false, alert50: false, alert20: false, alert10: false, alert0: false });

  // GPS Syncing States
  const [lastKnownPosition, setLastKnownPosition] = useState<DriverPosition | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [locationSyncStatus, setLocationSyncStatus] = useState<LocationSyncStatus>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fit map once both markers are set
  useEffect(() => {
    if (driverLocation && mapReady) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [driverLocation, targetCoord],
          { edgePadding: { top: 120, right: 60, bottom: 380, left: 60 }, animated: true }
        );
      }, 400);
    }
  }, [driverLocation, mapReady, targetCoord]);

  const showAlert = (msg: string) => {
    setCurrentAlert(msg);
    setAlertVisible(true);
  };

  // Distance alert logic
  useEffect(() => {
    const isVi = lang === 'vi';
    if (distance <= 100 && distance > 50 && !alertFlags.alert100) {
      setAlertFlags(prev => ({ ...prev, alert100: true }));
      showAlert(isVi ? 'Hành khách khiếm thị cách 100 mét phía trước' : 'Passenger is 100 meters ahead');
    } else if (distance <= 50 && distance > 20 && !alertFlags.alert50) {
      setAlertFlags(prev => ({ ...prev, alert50: true }));
      showAlert(isVi ? 'Hành khách cách 50 mét bên phải' : 'Passenger 50 meters on the right');
    } else if (distance <= 20 && distance > 10 && !alertFlags.alert20) {
      setAlertFlags(prev => ({ ...prev, alert20: true }));
      showAlert(isVi 
        ? `Hành khách đang nháy màn hình màu ${beaconColor.name} và rung điện thoại` 
        : `Passenger is flashing ${beaconColor.nameEn} light and vibrating`
      );
    } else if (distance <= 10 && distance > 5 && !alertFlags.alert10 && !bleConnected) {
      setAlertFlags(prev => ({ ...prev, alert10: true }));
      setBleConnected(true);
      showAlert(isVi ? '✓ Xác thực BLE thành công · Mã: Hoa 🌸' : '✓ BLE Verified · Code: Flower 🌸');
    } else if (distance <= 5 && !alertFlags.alert0 && !passengerSignaled) {
      setAlertFlags(prev => ({ ...prev, alert0: true }));
      setPassengerSignaled(true);
      showAlert(isVi ? 'Hành khách đã gõ 2 lần · Sẵn sàng đón ✅' : 'Passenger tapped · Ready for pickup ✅');
    }
  }, [distance, lang, bleConnected, passengerSignaled, alertFlags, beaconColor.name, beaconColor.nameEn]);

  // GPS background tracking and API syncing effect
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
    if (locationSyncStatus === 'denied') return 'PERMISSION NEEDED';
    if (locationSyncStatus === 'error') return 'ERROR';
    if (locationSyncStatus === 'syncing') return 'SYNCING...';
    if (locationSyncStatus === 'synced') return 'SYNCED';
    if (locationSyncStatus === 'tracking') return 'TRACKING';
    if (locationSyncStatus === 'requesting-permission') return 'REQUESTING...';
    return 'STARTING...';
  })();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        customMapStyle={darkMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        onMapReady={() => setMapReady(true)}
        initialRegion={{
          latitude: 10.7700,
          longitude: 106.6800,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <View style={styles.carIcon} />
            </View>
          </Marker>
        )}

        {/* Điểm đón (Pickup Marker) - Hiển thị màu xám nhỏ hơn khi hành trình bắt đầu */}
        <Marker coordinate={passengerCoord} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.passengerMarkerContainer}>
            <View style={[styles.passengerMarker, isTripPhase && { backgroundColor: '#64748B', transform: [{ scale: 0.8 }] }]} />
          </View>
        </Marker>

        {/* Điểm trả (Dropoff Marker) - Chỉ hiển thị khi đang thực hiện chuyến đi */}
        {isTripPhase && (
          <Marker coordinate={targetCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.passengerMarkerContainer}>
              <View style={[styles.passengerMarker, { backgroundColor: '#EF4444' }]} />
            </View>
          </Marker>
        )}

        {driverLocation && (
          <Polyline
            coordinates={[driverLocation, targetCoord]}
            strokeColor={isTripPhase ? '#F59E0B' : '#00C896'}
            strokeWidth={4}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      <TrackingAlertBanner 
        message={currentAlert} 
        visible={alertVisible} 
        onHide={() => setAlertVisible(false)} 
      />

      {/* Floating GPS Sync Badge */}
      <View style={styles.gpsSyncBadge}>
        <View style={[
          styles.gpsDot, 
          { 
            backgroundColor: 
              locationSyncStatus === 'synced' || locationSyncStatus === 'tracking' 
                ? '#4CAF50' 
                : locationSyncStatus === 'syncing' 
                  ? '#FFC107' 
                  : '#F44336' 
          }
        ]} />
        <Text style={styles.gpsSyncText}>GPS: {locationStatusText}</Text>
      </View>

      <LangToggleButton style={styles.langBtn} />

      <TrackingBottomSheet 
        distance={distance}
        bleConnected={bleConnected}
        passengerSignaled={passengerSignaled}
        beaconColor={beaconColor}
        pickupAddress={currentRide?.pickupAddress}
        dropoffAddress={currentRide?.dropoffAddress}
        isTripPhase={isTripPhase}
        onConfirmPickup={async () => {
          if (currentRide?.id && driverId) {
            try {
              if (!isTripPhase) {
                // Đón khách -> Đổi trạng thái sang IN_PROGRESS
                await updateBookingStatus(API_BASE_URL, currentRide.id, {
                  status: 'IN_PROGRESS',
                  driverId,
                });
              } else {
                // Trả khách -> Đổi trạng thái sang COMPLETED
                await updateBookingStatus(API_BASE_URL, currentRide.id, {
                  status: 'COMPLETED',
                  driverId,
                });
                setCurrentRide(null); // Clear active ride locally immediately
                if (onConfirmPickup) onConfirmPickup();
              }
            } catch (err) {
              console.error('[DriverTrackingScreen] Failed to update booking status:', err);
            }
          }
        }}
      />
    </View>
  );
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a2235' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3a2a' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c3e5a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d5080' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f3c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

const ACCENT = '#00C896';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a2235' },
  driverMarker: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10,
    elevation: 8,
  },
  carIcon: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff'
  },
  passengerMarkerContainer: { alignItems: 'center' },
  passengerMarker: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1E293B',
    borderWidth: 2.5, borderColor: '#E91E63',
    shadowColor: '#E91E63', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8,
    elevation: 6,
  },
  langBtn: { position: 'absolute', top: 50, right: 16, zIndex: 20 },
  gpsSyncBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 34, 53, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  gpsSyncText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default DriverTrackingScreen;
