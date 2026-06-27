import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

export type RiderStackParamList = {
  RiderHome: undefined;
  ActiveRide: { ride_id: string };
};

export type RiderHomeNavigation = {
  navigate: (screen: 'ActiveRide', params: { ride_id: string }) => void;
};

type RiderHomeScreenProps = {
  navigation: RiderHomeNavigation;
};

type VoicePhase = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'BOOKED';

const VOICE_PROMPTS = {
  idle: 'Ứng dụng đặt xe Blind Beacon. Chạm vào màn hình để ra lệnh giọng nói.',
  processing: 'Đang phân tích lộ trình và tìm kiếm tài xế.',
};

const BOOKING_DESTINATION = 'Bến xe Miền Đông Mới';
const MOCK_RIDE_ID = 'ride_999';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function speakAsync(text: string, language = 'vi-VN'): Promise<void> {
  Speech.stop();

  return new Promise((resolve) => {
    Speech.speak(text, {
      language,
      rate: 0.95,
      pitch: 1.0,
      onDone: resolve,
      onStopped: resolve,
      onError: (_error: Error) => {
        resolve();
      },
    });
  });
}

async function mockPost(endpoint: string, payload: unknown): Promise<{ ok: true; endpoint: string; payload: unknown }> {
  await delay(700);

  return {
    ok: true,
    endpoint,
    payload,
  };
}

export default function RiderHomeScreen({ navigation }: RiderHomeScreenProps): React.JSX.Element {
  const [phase, setPhase] = useState<VoicePhase>('IDLE');
  const isMountedRef = useRef(true);
  const isBusyRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    void speakAsync(VOICE_PROMPTS.idle);

    return () => {
      isMountedRef.current = false;
      Speech.stop();
    };
  }, []);

  const handleTap = useCallback(
    async (_event: GestureResponderEvent) => {
      if (isBusyRef.current || phase === 'BOOKED' || phase === 'PROCESSING') {
        return;
      }

      if (phase === 'IDLE') {
        isBusyRef.current = true;
        setPhase('LISTENING');

        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await mockPost('/api/v1/voice/connect', {
            session: 'voice-session-mock',
            mode: 'listen',
          });
        } finally {
          isBusyRef.current = false;
        }

        return;
      }

      if (phase === 'LISTENING') {
        isBusyRef.current = true;
        setPhase('PROCESSING');

        try {
          await speakAsync(VOICE_PROMPTS.processing);
          await mockPost('/api/v1/rides/book', {
            destination: BOOKING_DESTINATION,
            ride_type: 'passenger_accessibility',
          });

          if (isMountedRef.current) {
            setPhase('BOOKED');
            navigation.navigate('ActiveRide', { ride_id: MOCK_RIDE_ID });
          }
        } finally {
          isBusyRef.current = false;
        }
      }
    },
    [navigation, phase],
  );

  const accessibilityLabel =
    phase === 'IDLE'
      ? 'Ứng dụng đặt xe Blind Beacon. Trạng thái chờ. Chạm vào màn hình để ra lệnh giọng nói.'
      : phase === 'LISTENING'
        ? 'Blind Beacon đang ghi nhận lệnh giọng nói. Chạm lần nữa để gửi lệnh đặt xe.'
        : phase === 'PROCESSING'
          ? 'Blind Beacon đang xử lý yêu cầu đặt xe và tìm tài xế.'
          : 'Blind Beacon đã đặt xe thành công. Đang chuyển sang màn hình hành trình.';

  const renderBody = () => {
    if (phase === 'IDLE') {
      return <Text style={styles.primaryText}>Chạm vào màn hình để ra lệnh giọng nói.</Text>;
    }

    if (phase === 'LISTENING') {
      return <Text style={styles.primaryText}>Đang ghi nhận lệnh. Chạm lần nữa để gửi.</Text>;
    }

    if (phase === 'PROCESSING') {
      return <Text style={styles.primaryText}>Đang xử lý yêu cầu đặt xe...</Text>;
    }

    return <Text style={styles.primaryText}>Đặt xe thành công. Đang mở hành trình.</Text>;
  };

  return (
    <TouchableOpacity
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Chạm một lần để đổi trạng thái. Khi đang nghe, chạm thêm lần nữa để xác nhận đặt xe."
      onPress={handleTap}
      activeOpacity={0.95}
      style={[
        styles.screen,
        phase === 'IDLE' && styles.idleBackground,
        phase === 'LISTENING' && styles.listeningBackground,
        phase === 'PROCESSING' && styles.processingBackground,
        phase === 'BOOKED' && styles.bookedBackground,
      ]}
    >
      {renderBody()}
      <Text style={styles.secondaryText}>
        {phase === 'IDLE'
          ? 'TTS sẽ đọc hướng dẫn ngay khi màn hình mở.'
          : phase === 'LISTENING'
            ? 'Mikro ảo đang mở. Chạm thêm lần nữa để gửi lệnh.'
            : phase === 'PROCESSING'
              ? 'Hệ thống đang mô phỏng gọi backend đặt xe.'
              : 'Mở màn hình điều hướng hành trình.'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  idleBackground: {
    backgroundColor: '#0B1D39',
  },
  listeningBackground: {
    backgroundColor: '#123A63',
  },
  processingBackground: {
    backgroundColor: '#4A1B58',
  },
  bookedBackground: {
    backgroundColor: '#0A3B2C',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  secondaryText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
