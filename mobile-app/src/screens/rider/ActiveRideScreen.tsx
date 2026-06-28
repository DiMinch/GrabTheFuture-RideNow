import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App'; // Đường dẫn có thể thay đổi tùy cấu trúc thư mục của bạn
import * as Speech from 'expo-speech';
import BookingDetailsCard, { Booking } from '@/components/rider/BookingDetailsCard';
import BleHandshakeOverlay from '../../components/rider/BleHandshakeOverlay';
import { getBookingStatusText, getNextBookingStatus, normalizeBookingStatus } from '../../utils/bookingStatus';
import { updateBookingStatus } from '../../services/bookings';
import { API_BASE_URL } from '../../config';
import { getBeaconColor } from '../../utils/beaconColor';

// Khai báo kiểu Props cho màn hình này
type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRide'>;

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters}m`;
  }
  const km = Math.floor(meters / 1000);
  const m = meters % 1000;
  return m > 0 ? `${km}km ${m}m` : `${km}km`;
};

const formatDistanceSpeech = (meters: number): string => {
  if (meters < 1000) {
    return `${meters} mét`;
  }
  const km = Math.floor(meters / 1000);
  const m = meters % 1000;
  return m > 0 ? `${km} ki-lô-mét ${m} mét` : `${km} ki-lô-mét`;
};

export default function ActiveRideScreen({ route, navigation }: Props): React.JSX.Element {
  // Lấy ride_id (chính là bookingId) được truyền từ RiderHomeScreen sang
  const { ride_id } = route.params;
  const beaconColor = getBeaconColor(ride_id);

  // Khởi tạo các state
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);

  // States cho giả lập GPS/BLE (Haptic Radar + Flash Beacon + BLE Handshake)
  const [distance, setDistance] = useState<number>(120);
  const [showBleOverlay, setShowBleOverlay] = useState<boolean>(false);
  const [isScreenFlashing, setIsScreenFlashing] = useState<boolean>(false);

  const spokenThresholdsRef = useRef<{ [key: number]: boolean }>({});

  // Reset spoken thresholds when booking status changes
  useEffect(() => {
    spokenThresholdsRef.current = {};
  }, [booking?.status]);

  // Gọi API ngay khi màn hình vừa render xong và thiết lập Polling
  useEffect(() => {
    fetchBookingDetails(true);

    const pollInterval = setInterval(() => {
      fetchBookingDetails(false); // background fetch silently
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      Speech.stop(); // Cancel speech when screen is unmount
    };
  }, [ride_id]);

  // Vòng lặp giả lập hành trình & tính khoảng cách động (Simulation Loop & Dynamic Distance)
  useEffect(() => {
    const status = normalizeBookingStatus(booking?.status || '');
    if (!booking || (status !== 'ACCEPTED' && status !== 'ARRIVED' && status !== 'IN_PROGRESS')) {
      setDistance(120);
      setShowBleOverlay(false);
      setIsScreenFlashing(false);
      return;
    }

    // Nếu đã có tọa độ tài xế live từ server, ta dùng tọa độ đó tính khoảng cách động thực tế
    if (booking.driver?.lat && booking.driver?.lng) {
      import('geolib').then(({ getDistance }) => {
        try {
          const target = status === 'IN_PROGRESS' ? booking.dropoffLocation : booking.pickupLocation;
          const d = getDistance(
            { latitude: target.latitude, longitude: target.longitude },
            { latitude: booking.driver!.lat!, longitude: booking.driver!.lng! }
          );
          setDistance(d);
        } catch (err) {
          console.warn('[ActiveRideScreen] Geolib calculation failed:', err);
        }
      });
      return;
    }

    // Fallback: Giả lập giảm khoảng cách nếu chưa có tọa độ live của tài xế
    const simInterval = setInterval(() => {
      setDistance((prev) => {
        if (prev <= 0) {
          clearInterval(simInterval);
          return 0;
        }
        const nextDist = prev - 10;
        return nextDist < 0 ? 0 : nextDist;
      });
    }, 2500);

    return () => {
      clearInterval(simInterval);
    };
  }, [booking?.status, booking?.driver?.lat, booking?.driver?.lng, booking?.pickupLocation, booking?.dropoffLocation]);

  // TTS thông báo khi tài xế tiến lại gần (sử dụng khoảng cách động với ngưỡng range)
  useEffect(() => {
    if (!booking) return;
    const status = normalizeBookingStatus(booking.status);
    if (status !== 'ACCEPTED' && status !== 'ARRIVED') return;

    let speechText = '';
    
    if (status === 'ARRIVED') {
      if (!spokenThresholdsRef.current[0]) {
        speechText = 'Tài xế đã đến điểm đón. Bắt đầu xác thực BLE Handshake. Hãy chạm đúp hai lần trên màn hình để gửi tín hiệu.';
        spokenThresholdsRef.current[0] = true;
        setDistance(0);
        setShowBleOverlay(true);
        setIsScreenFlashing(true);
      }
    } else {
      // status === 'ACCEPTED'
      if (distance <= 120 && distance > 100 && !spokenThresholdsRef.current[120]) {
        speechText = 'Tài xế đang cách bạn khoảng một trăm hai mươi mét. Điểm đón của bạn ở phía trước bên phải.';
        spokenThresholdsRef.current[120] = true;
      } else if (distance <= 100 && distance > 80 && !spokenThresholdsRef.current[100]) {
        speechText = 'Tài xế đang cách bạn khoảng một trăm mét.';
        spokenThresholdsRef.current[100] = true;
      } else if (distance <= 80 && distance > 50 && !spokenThresholdsRef.current[80]) {
        speechText = 'Tài xế cách bạn khoảng tám mươi mét.';
        spokenThresholdsRef.current[80] = true;
      } else if (distance <= 50 && distance > 20 && !spokenThresholdsRef.current[50]) {
        speechText = 'Tài xế đang cách bạn khoảng năm mươi mét.';
        spokenThresholdsRef.current[50] = true;
      } else if (distance <= 20 && distance > 10 && !spokenThresholdsRef.current[20]) {
        speechText = `Tài xế cách bạn khoảng hai mươi mét. Kích hoạt radar rung và nháy màn hình màu ${beaconColor.name} để tài xế nhận diện.`;
        spokenThresholdsRef.current[20] = true;
        setIsScreenFlashing(true);
      } else if (distance <= 10 && distance > 0 && !spokenThresholdsRef.current[10]) {
        speechText = 'Tài xế đã đến rất gần dưới mười mét. Bắt đầu xác thực BLE Handshake. Hãy chạm đúp hai lần trên màn hình để gửi tín hiệu.';
        spokenThresholdsRef.current[10] = true;
        setShowBleOverlay(true);
      }
    }

    if (speechText) {
      void Speech.speak(speechText, { language: 'vi-VN' });
    }
  }, [distance, booking?.status, beaconColor.name]);

  // Haptic Radar + Flash Beacon (20m -> 5m)
  useEffect(() => {
    if (!booking) return;
    const status = normalizeBookingStatus(booking.status);
    if (status !== 'ACCEPTED' && status !== 'ARRIVED') {
      setIsScreenFlashing(false);
      return;
    }

    let flashTimer: ReturnType<typeof setInterval> | null = null;
    let vibrateTimer: ReturnType<typeof setInterval> | null = null;

    if (status === 'ARRIVED' || (distance <= 20 && distance > 5)) {
      // Flash screen periodically
      flashTimer = setInterval(() => {
        setIsScreenFlashing((prev) => !prev);
      }, 300);

      // Vibration interval gets faster as driver gets closer (or immediately maximum rate if ARRIVED)
      const vibrateInterval = status === 'ARRIVED' ? 400 : Math.max(400, distance * 80);
      
      const triggerVibration = () => {
        Vibration.vibrate(200);
      };
      
      triggerVibration();
      vibrateTimer = setInterval(triggerVibration, vibrateInterval);
    } else {
      setIsScreenFlashing(false);
    }

    return () => {
      if (flashTimer) clearInterval(flashTimer);
      if (vibrateTimer) clearInterval(vibrateTimer);
    };
  }, [distance, booking?.status]);

  const updateNextBookingStatus = async (): Promise<void> => {
    if (!booking) {
      return;
    }

    const nextStatus = getNextBookingStatus(booking.status);

    if (!nextStatus) {
      return;
    }

    try {
      setStatusUpdating(true);

      const updatedBookingRes = await updateBookingStatus(API_BASE_URL, booking.id, {
        status: nextStatus,
        driverId: booking.driverId,
      });

      const updatedBooking = (updatedBookingRes as any).data || updatedBookingRes;

      setBooking((current) =>
        current
          ? {
              ...current,
              ...updatedBooking,
              status: updatedBooking.status,
            }
          : current,
      );

      void Speech.speak(`Trạng thái chuyến đi đã được cập nhật sang ${getBookingStatusText(nextStatus)}.`, {
        language: 'vi-VN',
      });
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái chuyến đi');
    } finally {
      setStatusUpdating(false);
    }
  };

  // BLE Tap-to-Signal handler
  const handleBleSignalTapped = async () => {
    if (!booking) return;
    try {
      const updatedBookingRes = await updateBookingStatus(API_BASE_URL, booking.id, {
        status: 'IN_PROGRESS',
        driverId: booking.driverId,
      });

      const updatedBooking = (updatedBookingRes as any).data || updatedBookingRes;
      setBooking((current) =>
        current
          ? {
              ...current,
              ...updatedBooking,
              status: updatedBooking.status,
            }
          : current,
      );
      setShowBleOverlay(false);
      setIsScreenFlashing(false);

      void Speech.speak('Xác nhận lên xe thành công. Chúc bạn có một hành trình an toàn.', {
        language: 'vi-VN',
      });
    } catch (err) {
      console.error('Error confirming BLE handshake:', err);
    }
  };

  const fetchBookingDetails = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      setError(null);

      // Gọi phương thức GET
      const response = await fetch(`${API_BASE_URL}/bookings/${ride_id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }, 
      });

      // Xử lý các HTTP Status Code theo document
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Booking not found (Không tìm thấy chuyến đi)');
        }
        throw new Error('Đã xảy ra lỗi khi tải dữ liệu');
      }

      // Parse JSON thành công (Mã 200)
      const resJson = await response.json();
      const data: Booking = resJson.data || resJson;

      setBooking((current) => {
        if (current && normalizeBookingStatus(current.status) !== normalizeBookingStatus(data.status)) {
          // Phát âm thanh khi trạng thái thay đổi
          const statusMessage = `Trạng thái chuyến đi đã cập nhật sang: ${getBookingStatusText(data.status)}.`;
          void Speech.speak(statusMessage, { language: 'vi-VN' });
        } else if (!current && showLoadingSpinner) {
          // Lần đầu tải trang
          const statusMessage = normalizeBookingStatus(data.status) === 'PENDING'
            ? 'Đã kết nối dữ liệu hành trình. Hệ thống đang tích cực tìm kiếm tài xế.'
            : 'Cập nhật thông tin chuyến đi thành công.';
          void Speech.speak(statusMessage, { language: 'vi-VN' });
        }
        return data;
      });

    } catch (err: any) {
      if (showLoadingSpinner) {
        setError(err.message || 'Lỗi mạng');
      }
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  // 1. Giao diện lúc đang tải dữ liệu
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Đang lấy thông tin chuyến đi...</Text>
      </View>
    );
  }

  // 2. Giao diện lúc có lỗi (hoặc 404)
  // Trạng thái Lỗi (Bao gồm lỗi 404 hoặc lỗi mạng)
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => fetchBookingDetails(true)}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Thử lại"
          accessibilityHint="Chạm hai lần để gửi lại lệnh tải thông tin chuyến đi"
        >
          <Text style={styles.buttonText}>Thử lại</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Quay lại trang chủ"
        >
          <Text style={styles.buttonText}>Quay lại trang chủ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Giao diện hiển thị chi tiết Booking thành công
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessible accessibilityRole="header">
        Hành Trình Hiện Tại
      </Text>
      {booking && (normalizeBookingStatus(booking.status) === 'ACCEPTED' || normalizeBookingStatus(booking.status) === 'ARRIVED' || normalizeBookingStatus(booking.status) === 'IN_PROGRESS') && (
        <View 
          style={styles.distanceContainer} 
          accessible={true} 
          accessibilityLabel={
            normalizeBookingStatus(booking.status) === 'IN_PROGRESS'
              ? `Khoảng cách đến điểm trả còn ${formatDistanceSpeech(distance)}.`
              : `Tài xế đang cách bạn ${formatDistanceSpeech(distance)}. Hướng phía trước bên phải.`
          }
        >
          <Text style={styles.distanceLabel}>
            {normalizeBookingStatus(booking.status) === 'IN_PROGRESS'
              ? 'Khoảng cách đến điểm trả:'
              : 'Khoảng cách tài xế:'}
          </Text>
          <Text style={styles.distanceValue}>{formatDistance(distance)}</Text>
          {normalizeBookingStatus(booking.status) === 'ACCEPTED' && (
            <Text style={styles.directionText}>Hướng: Phía trước bên phải</Text>
          )}
        </View>
      )}

      {booking && <BookingDetailsCard booking={booking} />}



      {/* Flash Beacon simulation overlay */}
      {isScreenFlashing && (
        <View style={[styles.flashOverlay, { backgroundColor: beaconColor.hex }]} pointerEvents="none" />
      )}

      {/* BLE Handshake overlay */}
      {showBleOverlay && booking && (
        <BleHandshakeOverlay
          driverName={booking.driver?.name || 'Nguyen Van Binh'}
          licensePlate={booking.driver?.plate || '59P1-99999'}
          onSignalTapped={handleBleSignalTapped}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1D39',
    padding: 24,
    paddingTop: 60,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0B1D39',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    backgroundColor: '#123A63',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    backgroundColor: '#4A1B58',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#123A63',
    padding: 20,
    borderRadius: 12,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 4,
  },
  statusValue: {
    color: '#4ade80', // Xanh lá cây nổi bật cho trạng thái
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statusButton: {
    marginTop: 20,
    backgroundColor: '#123A63',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonDisabled: {
    opacity: 0.6,
  },
  distanceContainer: {
    alignItems: 'center',
    marginVertical: 14,
    backgroundColor: '#123A63',
    padding: 16,
    borderRadius: 16,
  },
  distanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceValue: {
    color: '#00B0FF',
    fontSize: 40,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  directionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    opacity: 0.6,
    zIndex: 998,
  },
});