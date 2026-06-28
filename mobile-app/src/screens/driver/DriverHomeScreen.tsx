import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LangToggleButton } from '../../context/LanguageContext';
import { useDriver } from '../../context/DriverContext';
import DriverTopHUD from '../../components/driver/DriverTopHUD';
import RideRequestSheet from '../../components/driver/RideRequestSheet';

interface DriverHomeScreenProps {
  onAcceptRide?: () => void;
  onRejectRide?: () => void;
}

const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ onAcceptRide, onRejectRide }) => {
  const { driverLocation, currentRide, setCurrentRide } = useDriver();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    if (driverLocation && mapReady) {
      mapRef.current?.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    }
  }, [driverLocation, mapReady]);

  return (
    <View style={styles.container}>
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
          latitude: 10.7769,
          longitude: 106.6997,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Animated.View style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                  }
                ]} 
              />
              <View style={styles.carIcon} />
            </View>
          </Marker>
        )}
      </MapView>

      <DriverTopHUD />
      <LangToggleButton style={styles.langBtn} />

      <RideRequestSheet 
        isVisible={!!currentRide} 
        onAccept={() => {
          if (onAcceptRide) onAcceptRide();
        }}
        onReject={() => {
          setCurrentRide(null);
          if (onRejectRide) onRejectRide();
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
  langBtn: { position: 'absolute', top: 110, right: 16, zIndex: 20 },
  driverMarker: {
    width: 46, height: 46, alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ACCENT,
    borderRadius: 23,
  },
  carIcon: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: ACCENT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }
});

export default DriverHomeScreen;
