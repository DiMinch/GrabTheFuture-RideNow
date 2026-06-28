import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

type BleHandshakeOverlayProps = {
  driverName: string;
  licensePlate: string;
  onSignalTapped: () => void | Promise<void>;
};

const DOUBLE_TAP_WINDOW_MS = 400;

const formatPlateForTts = (plate: string): string => {
  const cleaned = plate.replace(/\s+/g, '').toUpperCase();
  const groups = cleaned.split('-').filter(Boolean);

  if (groups.length === 0) {
    return cleaned.split('').join(' ');
  }

  return groups.map((group) => group.split('').join(' ')).join(', ');
};

const speakAsync = (text: string): Promise<void> =>
  new Promise((resolve) => {
    Speech.stop();
    Speech.speak(text, {
      language: 'vi-VN',
      rate: 0.92,
      pitch: 1,
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });

export default function BleHandshakeOverlay({
  driverName,
  licensePlate,
  onSignalTapped,
}: BleHandshakeOverlayProps): React.JSX.Element {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastTapAtRef = useRef<number>(0);

  const formattedPlate = useMemo(() => formatPlateForTts(licensePlate), [licensePlate]);

  useEffect(() => {
    // Read driver identity immediately so users can verify they are boarding the right car.
    void speakAsync(`Tài xế ${driverName}. Biển số ${formattedPlate}. Nhấn nhanh hai lần để gửi tín hiệu.`);

    return () => {
      Speech.stop();
    };
  }, [driverName, formattedPlate]);

  const accessibilityLabel = isConfirmed
    ? `Đã xác nhận với tài xế ${driverName}, biển số ${licensePlate}.`
    : `Tài xế ${driverName}, biển số ${licensePlate}. Nhấn nhanh hai lần để gửi tín hiệu BLE.`;

  const handlePress = (): void => {
    if (isSubmitting || isConfirmed) {
      return;
    }

    const now = Date.now();
    const delta = now - lastTapAtRef.current;

    if (delta > 0 && delta <= DOUBLE_TAP_WINDOW_MS) {
      lastTapAtRef.current = 0;

      const submitSignal = async (): Promise<void> => {
        setIsSubmitting(true);

        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await Promise.resolve(onSignalTapped());
          setIsConfirmed(true);
          void speakAsync('Đã gửi tín hiệu đến tài xế.');
        } finally {
          setIsSubmitting(false);
        }
      };

      void submitSignal();
      return;
    }

    lastTapAtRef.current = now;
  };

  return (
    <Pressable
      style={[styles.overlay, isConfirmed ? styles.overlayConfirmed : styles.overlayWaiting]}
      onPress={handlePress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Nhấn nhanh hai lần trong vòng bốn trăm mili giây để gửi tín hiệu cho tài xế."
      accessibilityState={{ busy: isSubmitting, disabled: isConfirmed }}
    >
      <View style={styles.content}>
        <Text style={styles.title}>BLE Handshake</Text>
        <Text style={styles.driverText}>Tài xế: {driverName}</Text>
        <Text style={styles.plateText}>Biển số: {licensePlate}</Text>
        <Text style={styles.instructionText}>
          {isConfirmed
            ? 'Đã xác nhận. Vui lòng chờ chuyến đi bắt đầu.'
            : 'Nhấn nhanh hai lần ở bất kỳ vị trí nào trên màn hình để gửi tín hiệu.'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  overlayWaiting: {
    backgroundColor: '#031A3A',
  },
  overlayConfirmed: {
    backgroundColor: '#0B8A3E',
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  driverText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  plateText: {
    color: '#E6F4FF',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
  },
});
