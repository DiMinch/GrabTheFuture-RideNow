import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Vibration,
  StatusBar,
  Easing,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useLang, LangToggleButton } from '../../context/LanguageContext';

const { width, height } = Dimensions.get('window');

interface DriverHomeScreenProps {
  onAcceptRide: () => void;
  onRejectRide?: () => void;
}

// Mock passenger pickup location (near a fixed point from driver)
const PASSENGER_LOCATION = {
  latitude: 10.7626,
  longitude: 106.6602,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ onAcceptRide, onRejectRide }) => {
  const { t, lang } = useLang();
  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acceptedRef = useRef(false);
  const [rideVisible, setRideVisible] = useState(true); // hide card after timeout/skip

  const [earnings] = useState({ today: '₫285,000', trips: 8, rating: '4.96' });
  const [isOnline] = useState(true);

  // Get real GPS location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        // Fallback to Ho Chi Minh City center
        setDriverLocation({ latitude: 10.7769, longitude: 106.6997 });
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDriverLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        setDriverLocation({ latitude: 10.7769, longitude: 106.6997 });
      }
    })();
  }, []);

  // Animations & ride request trigger
  useEffect(() => {
    // Pulse on driver marker
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ).start();

    // Slide-up ride card after 800ms
    const slideTimer = setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }).start();

      Vibration.vibrate([0, 400, 150, 400, 150, 400]);
      const msg =
        lang === 'vi'
          ? 'Bạn có yêu cầu chuyến xe mới từ hành khách khiếm thị'
          : 'You have a new ride request from a visually impaired passenger';
      Speech.speak(msg, { language: lang === 'vi' ? 'vi-VN' : 'en-US' });
    }, 800);

    // Countdown — when it hits 0, silently slide card away (no alert)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          if (!acceptedRef.current) {
            // Silently dismiss card, no popup
            Animated.timing(slideAnim, {
              toValue: 400,
              duration: 300,
              useNativeDriver: true,
            }).start(() => setRideVisible(false));
            onRejectRide?.(); // still calls it but App.tsx handler is now silent
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(slideTimer);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Fit map to show both driver and passenger when location ready
  useEffect(() => {
    if (driverLocation && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [driverLocation, PASSENGER_LOCATION],
          {
            edgePadding: { top: 140, right: 60, bottom: 420, left: 60 },
            animated: true,
          }
        );
      }, 500);
    }
  }, [driverLocation]);

  const countdownColor =
    countdown > 10 ? '#00E676' : countdown > 5 ? '#FFD600' : '#FF1744';

  // Route polyline between driver and passenger
  const routeCoords = driverLocation
    ? [driverLocation, PASSENGER_LOCATION]
    : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Real Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        customMapStyle={darkMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        initialRegion={PASSENGER_LOCATION}
      >
        {/* Driver marker */}
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Text style={{ fontSize: 22 }}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Passenger pickup marker */}
        <Marker coordinate={PASSENGER_LOCATION} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.passengerMarkerContainer}>
            <View style={styles.passengerMarker}>
              <Text style={{ fontSize: 18 }}>🧑‍🦯</Text>
            </View>
            <View style={styles.passengerLabel}>
              <Text style={styles.passengerLabelText}>Passenger</Text>
            </View>
          </View>
        </Marker>

        {/* Route polyline */}
        {routeCoords.length === 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#00C896"
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        )}
      </MapView>

      {/* Loading overlay while getting location */}
      {!driverLocation && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00C896" />
          <Text style={styles.loadingText}>Đang xác định vị trí...</Text>
        </View>
      )}

      {/* Top HUD */}
      <View style={styles.topHUD}>
        <View style={styles.onlineBadge}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#00E676' : '#FF1744' }]} />
          <Text style={styles.onlineBadgeText}>{isOnline ? t('online') : t('offline')}</Text>
        </View>
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>{t('today')}</Text>
          <Text style={styles.earningsValue}>{earnings.today}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{earnings.trips}</Text>
            <Text style={styles.statLabel}>{t('trips')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>⭐ {earnings.rating}</Text>
            <Text style={styles.statLabel}>{t('rating')}</Text>
          </View>
        </View>
      </View>

      {/* Lang toggle */}
      <LangToggleButton style={styles.langBtn} />

      {/* Ride Request Bottom Sheet */}
      <Animated.View style={[styles.rideRequestSheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.dragHandle} />

        <View style={styles.countdownRow}>
          <View style={[styles.countdownCircle, { borderColor: countdownColor }]}>
            <Text style={[styles.countdownText, { color: countdownColor }]}>{countdown}</Text>
          </View>
          <View style={styles.rideHeaderInfo}>
            <View style={styles.accessibilityBadge}>
              <Text style={styles.accessibilityIcon}>♿</Text>
              <Text style={styles.accessibilityBadgeText}>{t('accessibilityRequest')}</Text>
            </View>
            <Text style={styles.rideTitle}>{t('visuallyImpaired')}</Text>
            <Text style={styles.ratingText}>⭐ 4.8 · 23 {t('rides')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.routeInfo}>
          <View style={styles.routeIconCol}>
            <View style={styles.routeDotGreen} />
            <View style={styles.routeConnector} />
            <View style={styles.routeDotRed} />
          </View>
          <View style={styles.routeTextCol}>
            <View style={styles.routeBlock}>
              <Text style={styles.routeBlockLabel}>{t('pickup')}</Text>
              <Text style={styles.routeBlockText}>235 Nguyễn Văn Cừ, Phường 4, Q.5</Text>
            </View>
            <View style={styles.routeBlock}>
              <Text style={styles.routeBlockLabel}>{t('dropoff')}</Text>
              <Text style={styles.routeBlockText}>Bệnh viện Chợ Rẫy, Q.5</Text>
            </View>
          </View>
          <View style={styles.fareBadge}>
            <Text style={styles.fareAmount}>₫42K</Text>
            <Text style={styles.fareDistance}>3.2 km</Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteIcon}>💡</Text>
          <Text style={styles.noteText}>{t('specialNote')}</Text>
        </View>

        <View style={styles.etaRow}>
          <View style={styles.etaBadge}>
            <Text style={styles.etaIcon}>🕐</Text>
            <Text style={styles.etaText}>~4 {t('minToPickup')}</Text>
          </View>
          <View style={styles.etaBadge}>
            <Text style={styles.etaIcon}>💰</Text>
            <Text style={styles.etaText}>{t('surge')}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectButton} onPress={onRejectRide} activeOpacity={0.85}>
            <Text style={styles.rejectIcon}>✕</Text>
            <Text style={styles.rejectButtonText}>{t('skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => {
              acceptedRef.current = true;
              if (countdownRef.current) clearInterval(countdownRef.current);
              onAcceptRide();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptIcon}>✓</Text>
            <Text style={styles.acceptButtonText}>{t('acceptRide')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ── Google Maps dark style ──────────────────────────────────────────────────
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
const SHEET_BG = '#111827';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a2235' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a2235CC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#94A3B8', fontSize: 14 },

  // Markers
  driverMarker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  passengerMarkerContainer: { alignItems: 'center' },
  passengerMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#E91E63',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  passengerLabel: {
    backgroundColor: '#E91E63',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  passengerLabelText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  // Top HUD
  topHUD: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827DD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00E67640',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  onlineBadgeText: { color: '#00E676', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  earningsCard: {
    backgroundColor: '#111827DD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff15',
  },
  earningsLabel: { color: TEXT_SECONDARY, fontSize: 11 },
  earningsValue: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: 'bold' },
  statsRow: {
    backgroundColor: '#111827DD',
    borderRadius: 20,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffffff15',
  },
  statItem: { alignItems: 'center', paddingHorizontal: 8 },
  statValue: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: 'bold' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 10 },
  statDivider: { width: 1, backgroundColor: '#ffffff20', marginHorizontal: 4 },

  langBtn: { position: 'absolute', top: 110, right: 16, zIndex: 20 },

  // Bottom Sheet
  rideRequestSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    borderTopWidth: 1,
    borderColor: '#ffffff15',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ffffff30',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  countdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  countdownCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: '#0a1628',
  },
  countdownText: { fontSize: 24, fontWeight: 'bold' },
  rideHeaderInfo: { flex: 1 },
  accessibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E91E6325',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E91E6360',
  },
  accessibilityIcon: { fontSize: 13, marginRight: 5 },
  accessibilityBadgeText: { color: '#F48FB1', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  rideTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  ratingText: { color: TEXT_SECONDARY, fontSize: 13 },
  divider: { height: 1, backgroundColor: '#ffffff12', marginVertical: 14 },
  routeInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  routeIconCol: { alignItems: 'center', width: 20, marginRight: 12, paddingVertical: 4 },
  routeDotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: ACCENT, borderWidth: 2, borderColor: '#fff' },
  routeConnector: { width: 2, height: 28, backgroundColor: '#ffffff30', marginVertical: 4 },
  routeDotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF1744', borderWidth: 2, borderColor: '#fff' },
  routeTextCol: { flex: 1 },
  routeBlock: { marginBottom: 10 },
  routeBlockLabel: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 2 },
  routeBlockText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  fareBadge: {
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: '#00C89618',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#00C89640',
  },
  fareAmount: { color: ACCENT, fontSize: 18, fontWeight: 'bold' },
  fareDistance: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  noteIcon: { fontSize: 16, marginRight: 10 },
  noteText: { color: '#94A3B8', fontSize: 13, flex: 1 },
  etaRow: { flexDirection: 'row', marginBottom: 18, gap: 8 },
  etaBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  etaIcon: { fontSize: 14, marginRight: 6 },
  etaText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12 },
  rejectButton: {
    flex: 0.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FF174440',
    gap: 6,
  },
  rejectIcon: { fontSize: 18, color: '#FF1744' },
  rejectButtonText: { color: '#FF1744', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 18,
    borderRadius: 18,
    gap: 8,
    elevation: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  acceptIcon: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  acceptButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});

export default DriverHomeScreen;
