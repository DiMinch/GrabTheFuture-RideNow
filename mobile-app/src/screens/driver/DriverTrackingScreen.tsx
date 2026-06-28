import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { LangToggleButton } from '../../context/LanguageContext';
import { useDriver, PASSENGER_COORD } from '../../context/DriverContext';
import TrackingBottomSheet from '../../components/driver/TrackingBottomSheet';
import TrackingAlertBanner from '../../components/driver/TrackingAlertBanner';
import { useLang } from '../../context/LanguageContext';

interface DriverTrackingScreenProps {
  onConfirmPickup?: () => void;
}

const DriverTrackingScreen: React.FC<DriverTrackingScreenProps> = ({ onConfirmPickup }) => {
  const { driverLocation, distance } = useDriver();
  const { lang, t } = useLang();
  const mapRef = useRef<MapView>(null);
  
  const [mapReady, setMapReady] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [passengerSignaled, setPassengerSignaled] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertFlags, setAlertFlags] = useState({ alert100: false, alert50: false, alert20: false, alert10: false, alert0: false });

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
  }, [mapReady]); // Only on ready

  const showAlert = (msg: string) => {
    setCurrentAlert(msg);
    setAlertVisible(true);
  };

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
      showAlert(isVi ? 'Hành khách đang phát đèn flash và rung điện thoại' : 'Passenger is flashing and vibrating');
    } else if (distance <= 10 && distance > 5 && !alertFlags.alert10 && !bleConnected) {
      setAlertFlags(prev => ({ ...prev, alert10: true }));
      setBleConnected(true);
      showAlert(isVi ? '✓ Xác thực BLE thành công · Mã: Hoa 🌸' : '✓ BLE Verified · Code: Flower 🌸');
    } else if (distance <= 5 && !alertFlags.alert0 && !passengerSignaled) {
      setAlertFlags(prev => ({ ...prev, alert0: true }));
      setPassengerSignaled(true);
      showAlert(isVi ? 'Hành khách đã gõ 2 lần · Sẵn sàng đón ✅' : 'Passenger tapped · Ready for pickup ✅');
    }
  }, [distance, lang, bleConnected, passengerSignaled, alertFlags]);

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

        <Marker coordinate={PASSENGER_COORD} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.passengerMarkerContainer}>
            <View style={styles.passengerMarker} />
          </View>
        </Marker>

        {driverLocation && (
          <Polyline
            coordinates={[driverLocation, PASSENGER_COORD]}
            strokeColor="#00C896"
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

      <LangToggleButton style={styles.langBtn} />

      <TrackingBottomSheet 
        distance={distance}
        bleConnected={bleConnected}
        passengerSignaled={passengerSignaled}
        onConfirmPickup={() => {
          if (onConfirmPickup) onConfirmPickup();
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
});

export default DriverTrackingScreen;
