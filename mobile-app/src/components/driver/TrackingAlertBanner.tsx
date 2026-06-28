import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';

interface Props {
  message: string | null;
  visible: boolean;
  onHide: () => void;
}

const TrackingAlertBanner: React.FC<Props> = ({ message, visible, onHide }) => {
  const alertSlide = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (visible && message) {
      Animated.sequence([
        Animated.spring(alertSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.delay(3500),
        Animated.timing(alertSlide, { toValue: -120, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        onHide();
      });
    }
  }, [visible, message]);

  if (!visible && alertSlide.interpolate({ inputRange: [-120, 0], outputRange: [0, 1] }) as any === 0) return null;

  return (
    <Animated.View style={[styles.alertBanner, { transform: [{ translateY: alertSlide }] }]}>
      <Text style={styles.alertIcon}>🔔</Text>
      <Text style={styles.alertText}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
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
    zIndex: 100,
  },
  alertIcon: { fontSize: 18, marginRight: 8 },
  alertText: { color: '#FFD600', fontSize: 13, fontWeight: '600', flex: 1 },
});

export default TrackingAlertBanner;
