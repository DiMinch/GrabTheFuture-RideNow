import React from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useLang } from '../../context/LanguageContext';

const { width } = Dimensions.get('window');
const ACCENT = '#00C896';
const SHEET_BG = '#111827';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';

const StatusIndicator = ({ icon, label, status, active }: any) => (
  <View style={styles.statusRow}>
    <View style={[styles.statusIconBox, active && styles.statusIconBoxActive]}>
      <Text style={styles.statusIcon}>{icon}</Text>
    </View>
    <View style={styles.statusTextCol}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, active && styles.statusValueActive]}>{status}</Text>
    </View>
  </View>
);

interface Props {
  distance: number;
  bleConnected: boolean;
  passengerSignaled: boolean;
  onConfirmPickup: () => void;
}

const TrackingBottomSheet: React.FC<Props> = ({ distance, bleConnected, passengerSignaled, onConfirmPickup }) => {
  const { t } = useLang();
  const distancePercent = Math.max(0, (150 - distance) / 150);
  const progressWidth = width - 40;

  return (
    <View style={styles.bottomSheet}>
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
  );
};

const styles = StyleSheet.create({
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4,
  },
  sheetTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' },
  sheetSubtitle: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3 },
  etaBubble: { backgroundColor: '#00C89618', borderWidth: 1, borderColor: '#00C89640', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  etaValue: { color: ACCENT, fontSize: 22, fontWeight: 'bold', lineHeight: 26 },
  etaUnit: { color: ACCENT, fontSize: 11, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#ffffff10', marginVertical: 12, marginHorizontal: 20 },
  statusSection: { paddingHorizontal: 20, marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statusIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#ffffff10' },
  statusIconBoxActive: { backgroundColor: '#00C89615', borderColor: '#00C89640' },
  statusIcon: { fontSize: 16 },
  statusTextCol: { flex: 1 },
  statusLabel: { color: TEXT_SECONDARY, fontSize: 11, marginBottom: 2 },
  statusValue: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  statusValueActive: { color: TEXT_PRIMARY, fontWeight: 'bold' },
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
  },
  confirmButtonIcon: { fontSize: 20, color: '#fff' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});

export default TrackingBottomSheet;
