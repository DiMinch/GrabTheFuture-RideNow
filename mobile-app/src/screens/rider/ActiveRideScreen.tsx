import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

type RideStatus = 'MATCHED' | 'EN_ROUTE' | 'ARRIVED';

type RideSnapshot = {
  status: RideStatus;
  rider: {
    lat: number;
    lng: number;
    signal_tapped: boolean;
  };
  driver: {
    name: string;
    plate: string;
    ble_major_minor: string;
    lat: number;
    lng: number;
  };
};

type ActiveRideNavigation = {
  goBack?: () => void;
};

type ActiveRideScreenProps = {
  navigation: ActiveRideNavigation;
  route: {
    params: {
      ride_id: string;
    };
  };
};

const INITIAL_RIDE: RideSnapshot = {
  status: 'MATCHED',
  rider: {
    lat: 10.8756,
    lng: 106.8007,
    signal_tapped: false,
  },
  driver: {
    name: 'Nguyễn Văn A',
    plate: '59X3-1234',
    ble_major_minor: '12345-67890',
    lat: 10.8762,
    lng: 106.8015,
  },
};

const MOCK_RIDE_ID = 'ride_999';
const EXPECTED_BLE_SIGNATURE = '12345-67890';
const DRIVER_ANNOUNCEMENT = 'Tài xế Nguyễn Văn A - Mã nhận diện: Bông Hoa';
const SIMULATION_STEP_MS = 3000;
const FLASH_THRESHOLD_METERS = 20;
const RADAR_THRESHOLD_METERS = 100;
const HANDSHAKE_THRESHOLD_METERS = 5;
const FLASH_INTERVAL_MS = 400;
const FLASH_ON_COLOR = '#00FF66';
const FLASH_OFF_COLOR = '#FFFFFF';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const speakAsync = (text: string): Promise<void> => {
  Speech.stop();

  return new Promise((resolve) => {
    Speech.speak(text, {
      language: 'vi-VN',
      rate: 0.95,
      pitch: 1,
      onDone: resolve,
      onStopped: resolve,
      onError: (_error: Error) => {
        resolve();
      },
    });
  });
};

const mockPost = async <TResponse,>(
  endpoint: string,
  payload: Record<string, unknown>,
  latencyMs: number
): Promise<TResponse> => {
  await delay(latencyMs);

  return {
    ok: true,
    endpoint,
    payload,
    simulatedAt: new Date().toISOString(),
  } as TResponse;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

const angleDifference = (source: number, target: number): number => {
  const diff = normalizeAngle(target - source);
  return diff > 180 ? diff - 360 : diff;
};

const approachAngle = (current: number, target: number, step: number): number => {
  const diff = angleDifference(current, target);

  if (Math.abs(diff) <= step) {
    return normalizeAngle(target);
  }

  return normalizeAngle(current + Math.sign(diff) * step);
};

const calculateDistanceMeters = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number => {
  const earthRadiusMeters = 6_371_000;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const calculateBearingDegrees = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number => {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLng = toRadians(toLng - fromLng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return normalizeAngle(toDegrees(Math.atan2(y, x)));
};

const moveTowards = (
  sourceLat: number,
  sourceLng: number,
  targetLat: number,
  targetLng: number,
  fraction: number
): { lat: number; lng: number } => ({
  lat: sourceLat + (targetLat - sourceLat) * fraction,
  lng: sourceLng + (targetLng - sourceLng) * fraction,
});

const getDirectionPhrase = (differenceDegrees: number): string => {
  const normalized = normalizeAngle(differenceDegrees);

  if (normalized <= 22.5 || normalized > 337.5) {
    return 'phía trước';
  }

  if (normalized <= 67.5) {
    return 'phía trước bên phải';
  }

  if (normalized <= 112.5) {
    return 'bên phải';
  }

  if (normalized <= 157.5) {
    return 'phía sau bên phải';
  }

  if (normalized <= 202.5) {
    return 'phía sau';
  }

  if (normalized <= 247.5) {
    return 'phía sau bên trái';
  }

  if (normalized <= 292.5) {
    return 'bên trái';
  }

  return 'phía trước bên trái';
};

async function playRadarFeedback(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(100);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(100);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics are best-effort.
  }
}

async function playSignalFeedback(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(90);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(90);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are best-effort.
  }
}

export default function ActiveRideScreen({ navigation, route }: ActiveRideScreenProps): React.JSX.Element {
  const rideId = route.params.ride_id;
  const [rideSnapshot, setRideSnapshot] = useState<RideSnapshot>(INITIAL_RIDE);
  const [deviceHeading, setDeviceHeading] = useState(145);
  const [isBeaconFlashOn, setIsBeaconFlashOn] = useState(false);
  const [isBrightnessForced, setIsBrightnessForced] = useState(false);
  const originalBrightnessRef = useRef<number | null>(null);
  const lastAnnouncementRef = useRef('');
  const lastTapRef = useRef(0);
  const handshakeConfirmedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setRideSnapshot((current) => {
        if (current.status === 'ARRIVED') {
          return current;
        }

        const currentDistance = calculateDistanceMeters(
          current.rider.lat,
          current.rider.lng,
          current.driver.lat,
          current.driver.lng
        );

        if (currentDistance <= HANDSHAKE_THRESHOLD_METERS) {
          return {
            ...current,
            status: 'ARRIVED',
          };
        }

        const fraction = currentDistance > RADAR_THRESHOLD_METERS ? 0.18 : currentDistance > FLASH_THRESHOLD_METERS ? 0.32 : 0.5;
        const nextDriverPosition = moveTowards(
          current.driver.lat,
          current.driver.lng,
          current.rider.lat,
          current.rider.lng,
          fraction
        );

        return {
          ...current,
          status: 'EN_ROUTE',
          driver: {
            ...current.driver,
            lat: nextDriverPosition.lat,
            lng: nextDriverPosition.lng,
          },
        };
      });
    }, SIMULATION_STEP_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const distanceMeters = useMemo(
    () =>
      calculateDistanceMeters(
        rideSnapshot.rider.lat,
        rideSnapshot.rider.lng,
        rideSnapshot.driver.lat,
        rideSnapshot.driver.lng
      ),
    [rideSnapshot.driver.lat, rideSnapshot.driver.lng, rideSnapshot.rider.lat, rideSnapshot.rider.lng]
  );

  const bearingDegrees = useMemo(
    () =>
      calculateBearingDegrees(
        rideSnapshot.rider.lat,
        rideSnapshot.rider.lng,
        rideSnapshot.driver.lat,
        rideSnapshot.driver.lng
      ),
    [rideSnapshot.driver.lat, rideSnapshot.driver.lng, rideSnapshot.rider.lat, rideSnapshot.rider.lng]
  );

  useEffect(() => {
    setDeviceHeading((currentHeading) => {
      const approachStep = distanceMeters <= FLASH_THRESHOLD_METERS ? 26 : distanceMeters <= RADAR_THRESHOLD_METERS ? 18 : 12;
      return approachAngle(currentHeading, bearingDegrees, approachStep);
    });
  }, [bearingDegrees, distanceMeters]);

  const headingOffset = angleDifference(deviceHeading, bearingDegrees);
  const directionPhrase = getDirectionPhrase(headingOffset);
  const isRadarActive = distanceMeters <= RADAR_THRESHOLD_METERS && distanceMeters > HANDSHAKE_THRESHOLD_METERS;
  const isFlashActive = distanceMeters <= FLASH_THRESHOLD_METERS && distanceMeters > HANDSHAKE_THRESHOLD_METERS;
  const isHandshakeReady = distanceMeters <= HANDSHAKE_THRESHOLD_METERS;
  const isAligned = isRadarActive && Math.abs(headingOffset) <= 18;

  useEffect(() => {
    let active = true;

    const syncBrightness = async (): Promise<void> => {
      if (!isFlashActive) {
        setIsBrightnessForced(false);

        if (originalBrightnessRef.current !== null) {
          try {
            await Brightness.setBrightnessAsync(originalBrightnessRef.current);
          } catch {
            // Best-effort restore.
          }
        }

        return;
      }

      try {
        if (originalBrightnessRef.current === null) {
          originalBrightnessRef.current = await Brightness.getBrightnessAsync();
        }

        const permission = await Brightness.requestPermissionsAsync();

        if (permission.status === 'granted') {
          await Brightness.setBrightnessAsync(1);
          if (active) {
            setIsBrightnessForced(true);
          }
        }
      } catch {
        if (active) {
          setIsBrightnessForced(false);
        }
      }
    };

    void syncBrightness();

    return () => {
      active = false;
    };
  }, [isFlashActive]);

  useEffect(() => {
    if (!isFlashActive) {
      setIsBeaconFlashOn(false);
      return;
    }

    const timer = setInterval(() => {
      setIsBeaconFlashOn((current) => !current);
    }, FLASH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      setIsBeaconFlashOn(false);
    };
  }, [isFlashActive]);

  useEffect(() => {
    if (!isAligned) {
      return;
    }

    const announcement = `Xe đang ở ${directionPhrase}, ${Math.max(1, Math.round(distanceMeters))} mét`;

    if (lastAnnouncementRef.current === announcement) {
      return;
    }

    lastAnnouncementRef.current = announcement;

    void playRadarFeedback();
    void speakAsync(`${announcement}.`);
  }, [directionPhrase, distanceMeters, isAligned]);

  useEffect(() => {
    if (!isHandshakeReady || handshakeConfirmedRef.current) {
      return;
    }

    handshakeConfirmedRef.current = true;

    const confirmHandshake = async (): Promise<void> => {
      try {
        const bleMatch = rideSnapshot.driver.ble_major_minor === EXPECTED_BLE_SIGNATURE;

        if (!bleMatch) {
          handshakeConfirmedRef.current = false;
          return;
        }

        await mockPost<{ ok: true; endpoint: string; payload: Record<string, unknown> }>(
          `/api/v1/rides/${MOCK_RIDE_ID}/start`,
          {
            ride_id: MOCK_RIDE_ID,
            driver_ble_signature: rideSnapshot.driver.ble_major_minor,
          },
          500
        );

        await speakAsync(DRIVER_ANNOUNCEMENT);
        setRideSnapshot((current) => ({
          ...current,
          status: 'ARRIVED',
        }));

        setIsBeaconFlashOn(false);
        setIsBrightnessForced(false);

        if (originalBrightnessRef.current !== null) {
          try {
            await Brightness.setBrightnessAsync(originalBrightnessRef.current);
          } catch {
            // Best-effort restore.
          }
        }

        await delay(700);

        if (mountedRef.current) {
          navigation.goBack?.();
        }
      } catch {
        handshakeConfirmedRef.current = false;
      }
    };

    void confirmHandshake();
  }, [isHandshakeReady, navigation, rideSnapshot.driver.ble_major_minor]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      Speech.stop();

      if (originalBrightnessRef.current !== null) {
        void Brightness.setBrightnessAsync(originalBrightnessRef.current);
      }
    };
  }, []);

  const handleSignalTap = (): void => {
    const now = Date.now();
    const delta = now - lastTapRef.current;

    if (delta > 0 && delta < 320) {
      lastTapRef.current = 0;

      setRideSnapshot((current) => ({
        ...current,
        rider: {
          ...current.rider,
          signal_tapped: true,
        },
      }));

      void playSignalFeedback();
      void speakAsync('Tín hiệu báo xe đã được gửi tới tài xế.');
      return;
    }

    lastTapRef.current = now;
  };

  const backgroundColor = isFlashActive ? (isBeaconFlashOn ? FLASH_ON_COLOR : FLASH_OFF_COLOR) : '#04111E';
  const textColor = isFlashActive ? '#0B1220' : '#FFFFFF';
  const overlayText = isHandshakeReady
    ? 'Tài xế đã đến sát điểm đón. Chạm đúp để báo tín hiệu cuối cùng hoặc chờ xác nhận tự động.'
    : isFlashActive
      ? 'Beacon đã bật. Giữ màn hình sáng để hỗ trợ tài xế xác định vị trí.'
      : isRadarActive
        ? `Xe đang ở ${directionPhrase}, ${Math.max(1, Math.round(distanceMeters))} mét.`
        : `Đang theo dõi tài xế. Khoảng cách còn ${Math.max(1, Math.round(distanceMeters))} mét.`;

  return (
    <TouchableOpacity
      accessible
      accessibilityRole="button"
      accessibilityLabel={overlayText}
      accessibilityHint="Chạm hai lần nhanh để gửi tín hiệu báo xe cho tài xế."
      accessibilityState={{ busy: isFlashActive || isHandshakeReady }}
      activeOpacity={1}
      onPress={handleSignalTap}
      style={[styles.screen, { backgroundColor }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>Blind Beacon - Active Ride</Text>
        <Text style={[styles.heading, { color: textColor }]}>{overlayText}</Text>

        <View style={[styles.panel, isFlashActive && styles.lightPanel]}>
          <Text style={[styles.metaText, { color: textColor }]}>Ride ID: {rideId}</Text>
          <Text style={[styles.metaText, { color: textColor }]}>Status: {rideSnapshot.status}</Text>
          <Text style={[styles.metaText, { color: textColor }]}>Driver: {rideSnapshot.driver.name}</Text>
          <Text style={[styles.metaText, { color: textColor }]}>Plate: {rideSnapshot.driver.plate}</Text>
          <Text style={[styles.metaText, { color: textColor }]}>BLE: {rideSnapshot.driver.ble_major_minor}</Text>
          <Text style={[styles.metaText, { color: textColor }]}>Signal tapped: {rideSnapshot.rider.signal_tapped ? 'true' : 'false'}</Text>
          <Text style={[styles.metaText, { color: textColor }]}>Brightness forced: {isBrightnessForced ? 'true' : 'false'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 14,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  panel: {
    width: '100%',
    marginTop: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.16)',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  lightPanel: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  metaText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
});
