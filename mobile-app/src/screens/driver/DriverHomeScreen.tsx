import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Animated, Modal, ScrollView, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LangToggleButton } from '../../context/LanguageContext';
import { useDriver } from '../../context/DriverContext';
import DriverTopHUD from '../../components/driver/DriverTopHUD';
import RideRequestSheet from '../../components/driver/RideRequestSheet';
import { API_BASE_URL } from '../../config';
import { updateBookingStatus } from '../../services/bookings';

interface DriverHomeScreenProps {
  onAcceptRide?: () => void;
  onRejectRide?: () => void;
}

const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ onAcceptRide, onRejectRide }) => {
  const { 
    driverLocation, 
    currentRide, 
    setCurrentRide, 
    activeDriver, 
    setActiveDriver,
    driversList,
    refreshDrivers
  } = useDriver();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    refreshDrivers();
  }, []);

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
        onAccept={async () => {
          if (currentRide?.id && activeDriver?.id) {
            try {
              await updateBookingStatus(API_BASE_URL, currentRide.id, {
                status: 'ACCEPTED',
                driverId: activeDriver.id,
              });
            } catch (err) {
              console.error('[DriverHomeScreen] Failed to accept booking:', err);
            }
          }
          if (onAcceptRide) onAcceptRide();
        }}
        onReject={async () => {
          if (currentRide?.id && activeDriver?.id) {
            try {
              await updateBookingStatus(API_BASE_URL, currentRide.id, {
                status: 'CANCELLED',
                driverId: activeDriver.id,
              });
            } catch (err) {
              console.error('[DriverHomeScreen] Failed to reject booking:', err);
            }
          }
          setCurrentRide(null);
          if (onRejectRide) onRejectRide();
        }}
      />

      {/* Floating Driver Account Controls */}
      <View style={styles.profileControls}>
        <TouchableOpacity 
          style={styles.profileBtn} 
          onPress={() => setShowAccountSelector(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.profileBtnText}>👥</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.profileBtn, { marginTop: 10 }]} 
          onPress={() => setShowInfoModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.profileBtnText}>ℹ️</Text>
        </TouchableOpacity>
      </View>

      {/* Account Selector Modal */}
      <Modal
        visible={showAccountSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAccountSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn tài khoản tài xế</Text>
              <TouchableOpacity onPress={() => setShowAccountSelector(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {driversList.map((driver) => {
                const isSelected = activeDriver?.id === driver.id;
                return (
                  <TouchableOpacity
                    key={driver.id}
                    style={[
                      styles.driverAccountItem,
                      isSelected && styles.driverAccountItemSelected,
                    ]}
                    onPress={() => {
                      setActiveDriver(driver);
                      setShowAccountSelector(false);
                    }}
                  >
                    <View style={styles.driverAccountRow}>
                      <Text style={styles.driverAvatar}>🚗</Text>
                      <View style={styles.driverAccountDetails}>
                        <Text style={styles.driverAccountName}>{driver.name}</Text>
                        <Text style={styles.driverAccountPlate}>{driver.plate}</Text>
                      </View>
                      <View style={styles.driverAccountStats}>
                        <Text style={styles.driverAccountRating}>⭐ {driver.rating}</Text>
                        {driver.busy ? (
                          <Text style={styles.statusBusy}>Bận</Text>
                        ) : (
                          <Text style={styles.statusFree}>Sẵn sàng</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Driver Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thông tin tài xế</Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            {activeDriver ? (
              <View style={styles.infoContent}>
                <View style={styles.infoAvatarContainer}>
                  <Text style={styles.infoAvatar}>👨‍✈️</Text>
                  <Text style={styles.infoName}>{activeDriver.name}</Text>
                  <Text style={styles.infoPlate}>{activeDriver.plate}</Text>
                </View>
                <View style={styles.infoList}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã định danh:</Text>
                    <Text style={styles.infoValue}>{activeDriver.id}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Đánh giá:</Text>
                    <Text style={styles.infoValue}>⭐ {activeDriver.rating} / 5.0</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trạng thái:</Text>
                    <Text style={[styles.infoValue, activeDriver.busy ? styles.textBusy : styles.textFree]}>
                      {activeDriver.busy ? 'Đang bận' : 'Sẵn sàng'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Hỗ trợ tiếp cận:</Text>
                    <Text style={styles.infoValue}>
                      {activeDriver.accessibilityFriendly ? 'Có hỗ trợ xe lăn' : 'Thông thường'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bluetooth BLE Beacon:</Text>
                    <Text style={styles.infoValueCode} numberOfLines={1}>
                      {activeDriver.ble_major_minor || 'Chưa thiết lập'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.noDriverText}>Chưa chọn tài xế</Text>
            )}
          </View>
        </View>
      </Modal>
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
    width: 120, height: 120, alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ACCENT,
    top: 37, // (120 - 46) / 2 to center perfectly
    left: 37,
  },
  carIcon: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: ACCENT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    top: 48, // (120 - 24) / 2 to center perfectly
    left: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ffffff15',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeModalText: {
    color: '#94A3B8',
    fontSize: 20,
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  driverAccountItem: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#ffffff08',
  },
  driverAccountItemSelected: {
    borderColor: '#00C896',
    backgroundColor: '#00C89615',
  },
  driverAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  driverAccountDetails: {
    flex: 1,
  },
  driverAccountName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  driverAccountPlate: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  driverAccountStats: {
    alignItems: 'flex-end',
  },
  driverAccountRating: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusBusy: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: 'bold',
  },
  statusFree: {
    color: '#10B981',
    fontSize: 11,
    marginTop: 4,
    fontWeight: 'bold',
  },
  profileControls: {
    position: 'absolute',
    top: 170,
    right: 16,
    zIndex: 20,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827DD',
    borderWidth: 1,
    borderColor: '#ffffff15',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  profileBtnText: {
    fontSize: 18,
  },
  infoContent: {
    alignItems: 'center',
  },
  infoAvatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoAvatar: {
    fontSize: 50,
    marginBottom: 10,
  },
  infoName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoPlate: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },
  infoList: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff08',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  infoValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoValueCode: {
    color: '#00C896',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    maxWidth: '55%',
  },
  textBusy: {
    color: '#EF4444',
  },
  textFree: {
    color: '#10B981',
  },
  noDriverText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
  },
});

export default DriverHomeScreen;
