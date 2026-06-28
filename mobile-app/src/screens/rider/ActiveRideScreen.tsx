import React, { useEffect, useState } from 'react';
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
    if (!booking || (status !== 'ACCEPTED' && status !== 'IN_PROGRESS')) {
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

  // TTS thông báo khi tài xế tiến lại gần
  useEffect(() => {
    if (!booking || normalizeBookingStatus(booking.status) !== 'ACCEPTED') return;

    let speechText = '';
    
    if (distance === 120) {
      speechText = 'Tài xế đang cách bạn một trăm hai mươi mét. Điểm đón của bạn ở phía trước bên phải.';
    } else if (distance === 100) {
      speechText = 'Tài xế đang ở phía trước bên phải, cách bạn một trăm mét.';
    } else if (distance === 80) {
      speechText = 'Tài xế cách bạn tám mươi mét, tiếp tục di chuyển về phía điểm đón.';
    } else if (distance === 50) {
      speechText = 'Tài xế đang cách bạn năm mươi mét.';
    } else if (distance === 20) {
      speechText = `Tài xế cách bạn hai mươi mét. Kích hoạt radar rung và nháy màn hình màu ${beaconColor.name} để tài xế nhận diện.`;
    } else if (distance === 5) {
      speechText = 'Tài xế đã đến gần dưới năm mét. Bắt đầu xác thực BLE Handshake.';
      setShowBleOverlay(true);
    }

    if (speechText) {
      void Speech.speak(speechText, { language: 'vi-VN' });
    }
  }, [distance, booking?.status, beaconColor.name]);

  // Haptic Radar + Flash Beacon (20m -> 5m)
  useEffect(() => {
    if (!booking || normalizeBookingStatus(booking.status) !== 'ACCEPTED') {
      setIsScreenFlashing(false);
      return;
    }

    let flashTimer: ReturnType<typeof setInterval> | null = null;
    let vibrateTimer: ReturnType<typeof setInterval> | null = null;

    if (distance <= 20 && distance > 5) {
      // Flash screen periodically
      flashTimer = setInterval(() => {
        setIsScreenFlashing((prev) => !prev);
      }, 300);

      // Vibration interval gets faster as driver gets closer
      const vibrateInterval = Math.max(400, distance * 80);
      
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
      {booking && (normalizeBookingStatus(booking.status) === 'ACCEPTED' || normalizeBookingStatus(booking.status) === 'IN_PROGRESS') && (
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

      {booking ? (
        <TouchableOpacity
          style={[styles.statusButton, (statusUpdating || getNextBookingStatus(booking.status) === null) && styles.statusButtonDisabled]}
          onPress={updateNextBookingStatus}
          disabled={statusUpdating || getNextBookingStatus(booking.status) === null}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cập nhật trạng thái chuyến đi"
          accessibilityHint="Chạm hai lần để gửi yêu cầu PATCH cập nhật trạng thái chuyến đi theo API."
        >
          <Text style={styles.buttonText}>
            {statusUpdating
              ? 'Đang cập nhật...'
              : getNextBookingStatus(booking.status)
                ? `Cập nhật sang ${getBookingStatusText(getNextBookingStatus(booking.status) as string)}`
                : 'Trạng thái đã hoàn tất'}
          </Text>
        </TouchableOpacity>
      ) : null}

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