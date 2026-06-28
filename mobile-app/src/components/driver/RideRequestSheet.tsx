import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Vibration, ScrollView } from 'react-native';
import { useLang } from '../../context/LanguageContext';
import * as Speech from 'expo-speech';

const ACCENT = '#00C896';
const SHEET_BG = '#111827';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';

interface Props {
  isVisible: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const RideRequestSheet: React.FC<Props> = ({ isVisible, onAccept, onReject }) => {
  const { t, lang } = useLang();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (isVisible) {
      setCountdown(15);
      acceptedRef.current = false;

      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }).start();

      Vibration.vibrate([0, 400, 150, 400, 150, 400]);
      const msg = lang === 'vi'
          ? 'Bạn có yêu cầu chuyến xe mới từ hành khách khiếm thị'
          : 'You have a new ride request from a visually impaired passenger';
      Speech.speak(msg, { language: lang === 'vi' ? 'vi-VN' : 'en-US' });

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            if (!acceptedRef.current) {
              handleClose(onReject);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      handleClose();
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isVisible, lang]);

  const handleClose = (callback?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (callback) callback();
    });
  };

  const handleAccept = () => {
    acceptedRef.current = true;
    if (countdownRef.current) clearInterval(countdownRef.current);
    handleClose(onAccept);
  };

  const handleReject = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    handleClose(onReject);
  };

  const countdownColor = countdown > 5 ? '#00E676' : '#FF1744';

  if (!isVisible && slideAnim.interpolate({ inputRange: [0, 600], outputRange: [1, 0] }) as any === 0) {
    return null; // hide fully if not visible
  }

  return (
    <Animated.View style={[styles.rideRequestSheet, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.dragHandle} />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
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
      </ScrollView>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.rejectButton} onPress={handleReject} activeOpacity={0.85}>
          <Text style={styles.rejectIcon}>✕</Text>
          <Text style={styles.rejectButtonText}>{t('skip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.85}>
          <Text style={styles.acceptIcon}>✓</Text>
          <Text style={styles.acceptButtonText}>{t('acceptRide')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
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
    zIndex: 100,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: '#ffffff30', borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  countdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  countdownCircle: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: '#0a1628',
  },
  countdownText: { fontSize: 24, fontWeight: 'bold' },
  rideHeaderInfo: { flex: 1 },
  accessibilityBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E91E6325', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E91E6360',
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
  fareBadge: { alignItems: 'center', marginLeft: 12, backgroundColor: '#00C89618', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#00C89640' },
  fareAmount: { color: ACCENT, fontSize: 18, fontWeight: 'bold' },
  fareDistance: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  noteBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#ffffff10' },
  noteIcon: { fontSize: 16, marginRight: 10 },
  noteText: { color: '#94A3B8', fontSize: 13, flex: 1 },
  etaRow: { flexDirection: 'row', marginBottom: 18, gap: 8 },
  etaBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#ffffff10' },
  etaIcon: { fontSize: 14, marginRight: 6 },
  etaText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12 },
  scrollContainer: {
    maxHeight: 280,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  rejectButton: { flex: 0.35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B', paddingVertical: 18, borderRadius: 18, borderWidth: 1.5, borderColor: '#FF174440', gap: 6 },
  rejectIcon: { fontSize: 18, color: '#FF1744' },
  rejectButtonText: { color: '#FF1744', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  acceptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT, paddingVertical: 18, borderRadius: 18, gap: 8, elevation: 8 },
  acceptIcon: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  acceptButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});

export default RideRequestSheet;
