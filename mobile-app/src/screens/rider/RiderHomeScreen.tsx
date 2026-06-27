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

type VoicePhase = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'BOOKED';
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

  useEffect(() => {
    isMountedRef.current = true;
    void speakAsync(VOICE_PROMPTS.idle);

    return () => {
      isMountedRef.current = false;
      aiStreamRef.current?.close();
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
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        setPhase('PROCESSING');

        try {
          aiStreamRef.current?.close();
          await speakAsync(VOICE_PROMPTS.processing);
          
          // Gọi API backend thật
          const bookingResponse = await createBooking({
            pickupLocation: RIDER_LOCATION,
            dropoffLocation: { latitude: 10.864319, longitude: 106.804961 },
            pickupAddress: "Vị trí hiện tại của bạn",
            dropoffAddress: BOOKING_DESTINATION,
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
            await speakAsync('Xin lỗi, hệ thống đặt xe đang gặp sự cố. Vui lòng chạm để thử lại.');
          }
        } finally {
          isBusyRef.current = false;
        }
      }
    },
    [navigation, phase, startAiStream],
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
            ? `Micro ảo đang mở. AI stream: ${aiStreamStatus}. Chạm thêm lần nữa để gửi lệnh.`
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
