import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { AiStreamClient, type AiStreamIncomingMessage } from '../../services/aiStream';
import { API_BASE_URL, AI_GATEWAY_WS_URL } from '../../config';

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

type VoicePhase = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'CONFIRMING' | 'BOOKED';
type AiStreamStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';

type CreateBookingActionResult = {
  bookingId?: string;
};

const VOICE_PROMPTS = {
  idle: 'Ứng dụng đặt xe Blind Beacon. Chạm vào màn hình để ra lệnh giọng nói.',
  processing: 'Đang phân tích lộ trình và tìm kiếm tài xế.',
};

const BOOKING_DESTINATION = 'Bến xe Miền Đông Mới';
const RIDER_ID = 'mock-user-123';
const RIDER_LOCATION = { latitude: 10.762622, longitude: 106.660172 };

// Cấu trúc dữ liệu gửi đi (Request Body) theo chuẩn OpenAPI
interface BookingRequest {
  pickupLocation: { latitude: number; longitude: number };
  dropoffLocation: { latitude: number; longitude: number };
  pickupAddress?: string;
  dropoffAddress?: string;
  accessibilityMode?: boolean;
}

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

// Hàm gọi API thật tới Backend
async function createBooking(payload: BookingRequest) {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer YOUR_TOKEN' // Mở comment nếu cần token
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Lỗi hệ thống khi đặt xe');
  }

  return await response.json();
}

export default function RiderHomeScreen({ navigation }: RiderHomeScreenProps): React.JSX.Element {
  const [phase, setPhase] = useState<VoicePhase>('IDLE');
  const [aiStreamStatus, setAiStreamStatus] = useState<AiStreamStatus>('idle');
  const isMountedRef = useRef(true);
  const isBusyRef = useRef(false);
  const aiStreamRef = useRef<AiStreamClient | null>(null);

  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [resolvedDestination, setResolvedDestination] = useState<string>(BOOKING_DESTINATION);
  const [resolvedDropoffLocation, setResolvedDropoffLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 10.864319,
    longitude: 106.804961,
  });

  useEffect(() => {
    isMountedRef.current = true;
    void speakAsync(VOICE_PROMPTS.idle);

    return () => {
      isMountedRef.current = false;
      aiStreamRef.current?.close();
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      Speech.stop();
    };
  }, []);

  const handleAiStreamMessage = useCallback(
    (message: AiStreamIncomingMessage) => {
      if (message.type === 'error') {
        setAiStreamStatus('error');
        return;
      }

      if (message.type === 'text' && typeof message.text === 'string') {
        void speakAsync(message.text);
        return;
      }

      if (message.type === 'fallback_response' && typeof message.text_response === 'string') {
        void speakAsync(message.text_response);
        return;
      }

      if (message.type === 'action_result' && message.tool === 'geocode_address') {
        const result = message.result as any;
        if (result && result.display_name) {
          const displayName = result.display_name.split(',')[0] || result.display_name;
          setResolvedDestination(displayName);
          setResolvedDropoffLocation({
            latitude: result.lat || 10.864319,
            longitude: result.lng || 106.804961,
          });

          if (isMountedRef.current) {
            setPhase('CONFIRMING');
            aiStreamRef.current?.close();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void speakAsync(
              `Có phải bạn muốn đi đến: ${displayName} không? Hãy chạm nhanh hai lần vào màn hình để xác nhận đặt xe, hoặc chạm một lần để hủy.`
            );
          }
        }
        return;
      }

      if (message.type === 'action_result' && message.tool === 'create_booking') {
        const result = message.result as CreateBookingActionResult | undefined;
        const bookingId = result?.bookingId;

        if (bookingId && isMountedRef.current) {
          setPhase('BOOKED');
          aiStreamRef.current?.close();
          navigation.navigate('ActiveRide', { ride_id: bookingId });
        }
      }
    },
    [navigation],
  );

  const startAiStream = useCallback(() => {
    const sessionId = `sess_${RIDER_ID}_${Date.now()}`;

    aiStreamRef.current?.close();
    setAiStreamStatus('connecting');

    const aiStream = new AiStreamClient(
      AI_GATEWAY_WS_URL,
      {
        sessionId,
        lat: RIDER_LOCATION.latitude,
        lng: RIDER_LOCATION.longitude,
        userId: RIDER_ID,
        lang: 'vi',
      },
      {
        onOpen: () => {
          if (!isMountedRef.current) {
            return;
          }

          setAiStreamStatus('connected');
          aiStream.sendSessionContext({
            latitude: RIDER_LOCATION.latitude,
            longitude: RIDER_LOCATION.longitude,
            lang: 'vi',
          });
        },
        onMessage: handleAiStreamMessage,
        onError: () => {
          if (isMountedRef.current) {
            setAiStreamStatus('error');
          }
        },
        onClose: () => {
          if (isMountedRef.current) {
            setAiStreamStatus((current) => (current === 'error' ? current : 'closed'));
          }
        },
      },
    );

    aiStreamRef.current = aiStream;
    aiStream.connect();
  }, [handleAiStreamMessage]);

  const handleTap = useCallback(
    async (_event: GestureResponderEvent) => {
      if (isBusyRef.current || phase === 'BOOKED' || phase === 'PROCESSING') {
        return;
      }

      if (phase === 'IDLE') {
        isBusyRef.current = true;
        setPhase('LISTENING');

        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          startAiStream();
          
          // SỬA Ở ĐÂY: Thay mockPost bằng delay để giả lập khởi động ghi âm giọng nói
          await delay(500); 
          
        } finally {
          isBusyRef.current = false;
        }

        return;
      }

      if (phase === 'LISTENING') {
        isBusyRef.current = true;
        setPhase('CONFIRMING');

        try {
          aiStreamRef.current?.close();
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await speakAsync(`Xác nhận điểm đến: ${resolvedDestination}. Chạm nhanh hai lần liên tiếp vào màn hình để đặt xe, hoặc chạm một lần để hủy.`);
        } finally {
          isBusyRef.current = false;
        }
        return;
      }

      if (phase === 'CONFIRMING') {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 350;

        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          // Double-tap: CONFIRM BOOKING
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
          }

          isBusyRef.current = true;
          setPhase('PROCESSING');

          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await speakAsync(VOICE_PROMPTS.processing);
            
            // Gọi API backend thật
            const bookingResponse = await createBooking({
              pickupLocation: RIDER_LOCATION,
              dropoffLocation: resolvedDropoffLocation,
              pickupAddress: "Vị trí hiện tại của bạn",
              dropoffAddress: resolvedDestination,
              accessibilityMode: true
            });

            // Nhận response thành công
            if (isMountedRef.current) {
              setPhase('BOOKED');
              const bookingId = bookingResponse.data?.id || bookingResponse.id;
              navigation.navigate('ActiveRide', { ride_id: bookingId });
            }

          } catch (error: any) {
            console.error("Lỗi khi gọi API đặt xe:", error);
            
            if (isMountedRef.current) {
              setPhase('IDLE');
              setResolvedDestination(BOOKING_DESTINATION);
              setResolvedDropoffLocation({ latitude: 10.864319, longitude: 106.804961 });
              await speakAsync('Xin lỗi, hệ thống đặt xe đang gặp sự cố. Vui lòng chạm để thử lại.');
            }
          } finally {
            isBusyRef.current = false;
          }
        } else {
          // First tap of a potential double-tap, or a single tap
          lastTapRef.current = now;
          
          tapTimeoutRef.current = setTimeout(async () => {
            // If timer completes without a second tap, it is a SINGLE TAP -> CANCEL
            if (isMountedRef.current) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setPhase('IDLE');
              setResolvedDestination(BOOKING_DESTINATION);
              setResolvedDropoffLocation({ latitude: 10.864319, longitude: 106.804961 });
              await speakAsync('Đã hủy đặt xe. Vui lòng chạm để bắt đầu lại.');
            }
          }, DOUBLE_TAP_DELAY);
        }
      }
    },
    [navigation, phase, startAiStream, resolvedDestination, resolvedDropoffLocation],
  );

  const accessibilityLabel =
    phase === 'IDLE'
      ? 'Ứng dụng đặt xe Blind Beacon. Trạng thái chờ. Chạm vào màn hình để ra lệnh giọng nói.'
      : phase === 'LISTENING'
        ? 'Blind Beacon đang ghi nhận lệnh giọng nói. Chạm lần nữa để kết thúc ghi âm.'
        : phase === 'CONFIRMING'
          ? `Xác nhận điểm đến: ${resolvedDestination}. Chạm nhanh hai lần liên tiếp để đặt xe, chạm một lần để hủy.`
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
    if (phase === 'CONFIRMING') {
      return (
        <>
          <Text style={styles.primaryText}>Điểm đến: {resolvedDestination}</Text>
          <Text style={styles.confirmSubText}>Chạm 2 lần để XÁC NHẬN {"\n"} Chạm 1 lần để HỦY</Text>
        </>
      );
    }
    if (phase === 'PROCESSING') {
      return <Text style={styles.primaryText}>Đang xử lý yêu cầu đặt xe...</Text>;
    }
    return <Text style={styles.primaryText}>Đặt xe thành công. Đang mở hành trình.</Text>;
  };

  const accessibilityHint = phase === 'CONFIRMING'
    ? 'Chạm nhanh hai lần để xác thực đặt xe. Chạm một lần để hủy.'
    : 'Chạm một lần để bắt đầu hoặc đổi trạng thái.';

  return (
    <TouchableOpacity
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={handleTap}
      activeOpacity={0.95}
      style={[
        styles.screen,
        phase === 'IDLE' && styles.idleBackground,
        phase === 'LISTENING' && styles.listeningBackground,
        phase === 'CONFIRMING' && styles.confirmingBackground,
        phase === 'PROCESSING' && styles.processingBackground,
        phase === 'BOOKED' && styles.bookedBackground,
      ]}
    >
      {renderBody()}
      <Text style={styles.secondaryText}>
        {phase === 'IDLE'
          ? 'TTS sẽ đọc hướng dẫn ngay khi màn hình mở.'
          : phase === 'LISTENING'
            ? `Micro ảo đang mở. AI stream: ${aiStreamStatus}. Chạm thêm lần nữa để kết thúc.`
            : phase === 'CONFIRMING'
              ? 'Xác thực hành động đặt xe.'
              : phase === 'PROCESSING'
                ? 'Hệ thống đang gọi API đặt xe...'
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
  confirmingBackground: {
    backgroundColor: '#D97706',
  },
  processingBackground: {
    backgroundColor: '#4A1B58',
  },
  bookedBackground: {
    backgroundColor: '#0A3B2C',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  confirmSubText: {
    color: '#FFE8D6',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    lineHeight: 28,
    textAlign: 'center',
  },
  secondaryText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
