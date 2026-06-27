import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, AnimatedRegion } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useLang, LangToggleButton } from '../../context/LanguageContext';

const { width } = Dimensions.get('window');

interface DriverTrackingScreenProps {
  onConfirmPickup: () => void;
}

// Fixed passenger pickup location
const PASSENGER_COORD = {
  latitude: 10.7626,
  longitude: 106.6602,
};

// ── Status Row component ──────────────────────────────────────────────────────
const StatusIndicator = ({
  label, status, active, icon,
}: {
  label: string; status: string; active: boolean; icon: string;
}) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [active]);

  return (
    <View style={statusStyles.row}>
      <View style={[statusStyles.iconBox, { backgroundColor: active ? '#00C89620' : '#1E293B' }]}>
        <Text style={statusStyles.icon}>{icon}</Text>
      </View>
      <View style={statusStyles.textCol}>
        <Text style={statusStyles.label}>{label}</Text>
        <Text style={[statusStyles.status, { color: active ? '#00C896' : '#64748B' }]}>{status}</Text>
      </View>
      <Animated.View style={[statusStyles.activeDot, {
        backgroundColor: active ? '#00C896' : '#334155',
        opacity: active ? glowAnim : 1,
      }]} />
    </View>
  );
};

const statusStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ffffff08' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 18 },
  textCol: { flex: 1 },
  label: { color: '#94A3B8', fontSize: 12 },
  status: { fontSize: 13, fontWeight: 'bold', marginTop: 1 },
  activeDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
const DriverTrackingScreen: React.FC<DriverTrackingScreenProps> = ({ onConfirmPickup }) => {
  const { t, lang } = useLang();
  const mapRef = useRef<MapView>(null);

  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [distance, setDistance] = useState(150);
  const [bleConnected, setBleConnected] = useState(false);
  const [passengerSignaled, setPassengerSignaled] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);

  // Animated driver marker position
  const animatedCoord = useRef(new AnimatedRegion({
    latitude: 10.7769,
    longitude: 106.6997,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;

  const alertSlide = useRef(new Animated.Value(-120)).current;

  // Get real GPS
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const fallback = { latitude: 10.7769, longitude: 106.6997 };

      if (status !== 'granted') {
        setDriverLocation(fallback);
        animatedCoord.setValue({ ...fallback, latitudeDelta: 0, longitudeDelta: 0 });
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setDriverLocation(coord);
        animatedCoord.setValue({ ...coord, latitudeDelta: 0, longitudeDelta: 0 });
      } catch {
        setDriverLocation(fallback);
        animatedCoord.setValue({ ...fallback, latitudeDelta: 0, longitudeDelta: 0 });
      }
    })();
  }, []);

  // Fit map once both markers are set
  useEffect(() => {
    if (driverLocation && mapReady) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [driverLocation, PASSENGER_COORD],
          { edgePadding: { top: 120, right: 60, bottom: 380, left: 60 }, animated: true }
        );
      }, 400);
    }
  }, [driverLocation, mapReady]);

  // Simulate distance countdown + animate car toward passenger
  useEffect(() => {
    const interval = setInterval(() => {
      setDistance((prev) => {
        const next = Math.max(0, prev - 10);

        // Animate car marker toward passenger
        if (driverLocation) {
          const ratio = 1 - next / 150;
          const newLat = driverLocation.latitude + (PASSENGER_COORD.latitude - driverLocation.latitude) * ratio;
          const newLng = driverLocation.longitude + (PASSENGER_COORD.longitude - driverLocation.longitude) * ratio;
          animatedCoord.timing({
            latitude: newLat,
            longitude: newLng,
            latitudeDelta: 0,
            longitudeDelta: 0,
            duration: 1800,
            useNativeDriver: false,
          }).start();
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [driverLocation]);

  const showAlert = (msg: string, ttsMsg?: string) => {
    setCurrentAlert(msg);
    setAlertVisible(true);
    Animated.sequence([
      Animated.spring(alertSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(alertSlide, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start(() => setAlertVisible(false));
    if (ttsMsg) Speech.speak(ttsMsg, { language: lang === 'vi' ? 'vi-VN' : 'en-US' });
  };

  useEffect(() => {
    const isVi = lang === 'vi';
    if (distance === 100) {
      showAlert(
        isVi ? 'Hành khách khiếm thị cách 100 mét phía trước' : 'Passenger is 100 meters ahead',
        isVi ? 'Hành khách cách 100 mét' : 'Passenger is 100 meters ahead'
      );
    } else if (distance === 50) {
      showAlert(
        isVi ? 'Hành khách cách 50 mét bên phải' : 'Passenger 50 meters on the right',
        isVi ? 'Hành khách cách 50 mét' : 'Passenger 50 meters ahead'
      );
    } else if (distance === 20) {
      showAlert(
        isVi ? 'Hành khách đang phát đèn flash và rung điện thoại' : 'Passenger is flashing and vibrating',
        isVi ? 'Hành khách đang ra tín hiệu' : 'Passenger signaling'
      );
    } else if (distance === 10 && !bleConnected) {
      setBleConnected(true);
      showAlert(
        isVi ? '✓ Xác thực BLE thành công · Mã: Hoa 🌸' : '✓ BLE Verified · Code: Flower 🌸',
        isVi ? 'Xác thực thành công' : 'BLE verified'
      );
    } else if (distance === 0 && !passengerSignaled) {
      setPassengerSignaled(true);
      showAlert(
        isVi ? 'Hành khách đã gõ 2 lần · Sẵn sàng đón ✅' : 'Passenger tapped · Ready for pickup ✅',
        isVi ? 'Hành khách sẵn sàng' : 'Passenger is ready'
      );
    }
  }, [distance]);

  const distancePercent = Math.max(0, (150 - distance) / 150);
  const progressWidth = width - 40;

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
        onMapReady={() => setMapReady(true)}
        initialRegion={{
          latitude: 10.7700,
          longitude: 106.6800,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {/* Animated driver / car marker */}
        <Marker.Animated
          coordinate={animatedCoord}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.driverMarker}>
            <Text style={{ fontSize: 22 }}>🚗</Text>
          </View>
        </Marker.Animated>

        {/* Passenger marker */}
        <Marker coordinate={PASSENGER_COORD} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.passengerMarkerContainer}>
            <View style={styles.passengerMarker}>
              <Text style={{ fontSize: 18 }}>🧑‍🦯</Text>
            </View>
            <View style={styles.passengerLabel}>
              <Text style={styles.passengerLabelText}>{distance}m</Text>
            </View>
          </View>
        </Marker>

        {/* Route polyline */}
        {driverLocation && (
          <Polyline
            coordinates={[driverLocation, PASSENGER_COORD]}
            strokeColor="#00C896"
            strokeWidth={4}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      {/* Loading */}
      {!driverLocation && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00C896" />
        </View>
      )}

      {/* Alert banner */}
      {alertVisible && (
        <Animated.View style={[styles.alertBanner, { transform: [{ translateY: alertSlide }] }]}>
          <Text style={styles.alertIcon}>🔔</Text>
          <Text style={styles.alertText}>{currentAlert}</Text>
        </Animated.View>
      )}

      {/* Distance HUD */}
      <View style={styles.distanceHUD}>
        <Text style={styles.distanceHUDValue}>{distance}m</Text>
        <Text style={styles.distanceHUDLabel}>{t('toPassenger')}</Text>
      </View>

      {/* Lang toggle */}
      <LangToggleButton style={styles.langBtn} />

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth * distancePercent }]} />
        </View>

        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>{t('enRoute')}</Text>
            <Text style={styles.sheetSubtitle}>Nguyễn Văn Cừ, Q.5 · {distance}m {t('distanceAway')}</Text>
          </View>
          <View style={styles.etaBubble}>
            <Text style={styles.etaValue}>{Math.max(1, Math.ceil(distance / 50))}</Text>
            <Text style={styles.etaUnit}>{t('min')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statusSection}>
          <StatusIndicator icon="🔊" label={t('ttaLabel')} status={t('ttaStatus')} active={true} />
          <StatusIndicator icon="💡" label={t('flashLabel')} status={distance <= 20 ? t('flashDetected') : t('flashWaiting')} active={distance <= 20} />
          <StatusIndicator icon="📡" label={t('bleLabel')} status={bleConnected ? t('bleSuccess') : t('bleScanning')} active={bleConnected} />
          <StatusIndicator icon="📲" label={t('tapLabel')} status={passengerSignaled ? t('tapReady') : t('tapWaiting')} active={passengerSignaled} />
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, { opacity: passengerSignaled ? 1 : 0.45 }]}
          onPress={onConfirmPickup}
          disabled={!passengerSignaled}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmButtonIcon}>{passengerSignaled ? '✓' : '⏳'}</Text>
          <Text style={styles.confirmButtonText}>
            {passengerSignaled ? t('confirmPickup') : t('waitingPassenger')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Dark map style (matches DriverHomeScreen)
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
    backgroundColor: '#1a2235AA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Markers
  driverMarker: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10,
    elevation: 8,
  },
  passengerMarkerContainer: { alignItems: 'center' },
  passengerMarker: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#E91E63',
    shadowColor: '#E91E63', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8,
    elevation: 6,
  },
  passengerLabel: { backgroundColor: '#E91E63', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  passengerLabelText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  // Distance HUD
  distanceHUD: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: '#111827DD',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff15',
  },
  distanceHUDValue: { color: ACCENT, fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  distanceHUDLabel: { color: TEXT_SECONDARY, fontSize: 12 },

  langBtn: { position: 'absolute', top: 50, right: 16, zIndex: 20 },

  alertBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 90,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD60040',
    elevation: 20,
    shadowColor: '#FFD600',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  alertIcon: { fontSize: 18, marginRight: 8 },
  alertText: { color: '#FFD600', fontSize: 13, fontWeight: '600', flex: 1 },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    borderTopWidth: 1,
    borderColor: '#ffffff15',
  },
  progressTrack: { height: 4, backgroundColor: '#1E293B', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  progressBar: { height: 4, backgroundColor: ACCENT, shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  sheetTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' },
  sheetSubtitle: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3 },
  etaBubble: { backgroundColor: '#00C89618', borderWidth: 1, borderColor: '#00C89640', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  etaValue: { color: ACCENT, fontSize: 22, fontWeight: 'bold', lineHeight: 26 },
  etaUnit: { color: ACCENT, fontSize: 11, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#ffffff10', marginVertical: 12, marginHorizontal: 20 },
  statusSection: { paddingHorizontal: 20, marginBottom: 16 },
  confirmButton: {
    marginHorizontal: 20,
    backgroundColor: ACCENT,
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  confirmButtonIcon: { fontSize: 20, color: '#fff' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});

export default DriverTrackingScreen;
