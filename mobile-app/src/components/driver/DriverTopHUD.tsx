import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLang } from '../../context/LanguageContext';
import { useDriver } from '../../context/DriverContext';

const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';

const DriverTopHUD = () => {
  const { t } = useLang();
  const { isOnline, setCurrentRide } = useDriver();

  const earnings = { today: '₫350,000', trips: 12, rating: 4.9 };

  return (
    <View style={styles.topHUD}>
      <TouchableOpacity 
        style={styles.onlineBadge}
        activeOpacity={0.8}
        onPress={() => {
          // Nút ẩn dùng để debug (giả lập server gửi cuốc xe mới)
          setCurrentRide({
            id: 'mock_ride_123',
            passengerName: 'Nguyễn Văn A',
            pickup: '235 Nguyễn Văn Cừ, Q.5'
          });
        }}
      >
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#00E676' : '#FF1744' }]} />
        <Text style={styles.onlineBadgeText}>{isOnline ? t('online') : t('offline')}</Text>
      </TouchableOpacity>
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
  );
};

const styles = StyleSheet.create({
  topHUD: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
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
});

export default DriverTopHUD;
