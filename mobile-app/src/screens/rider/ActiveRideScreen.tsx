import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App'; // Đường dẫn có thể thay đổi tùy cấu trúc thư mục của bạn
import * as Speech from 'expo-speech';
import BookingDetailsCard, { Booking } from '@/components/rider/BookingDetailsCard';
import { getBookingStatusText, getNextBookingStatus, normalizeBookingStatus } from '../../utils/bookingStatus';
import { updateBookingStatus } from '../../services/bookings';
import { getDriverBeaconMetadata, type DriverBeaconMetadata } from '../../services/drivers';

// Khai báo kiểu Props cho màn hình này
type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRide'>;

const API_BASE_URL = 'http://10.236.53.198'; // Đổi lại IP của bạn

export default function ActiveRideScreen({ route, navigation }: Props): React.JSX.Element {
  // Lấy ride_id (chính là bookingId) được truyền từ RiderHomeScreen sang
  const { ride_id } = route.params;

  // Khởi tạo các state
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [beaconMetadata, setBeaconMetadata] = useState<DriverBeaconMetadata | null>(null);
  const [beaconError, setBeaconError] = useState<string | null>(null);
  const [beaconLoading, setBeaconLoading] = useState<boolean>(false);

  // Gọi API ngay khi màn hình vừa render xong
  useEffect(() => {
    fetchBookingDetails();

    return () => {
      Speech.stop(); // Cancel speech when screen is unmount
    };
  }, [ride_id]);

  useEffect(() => {
    if (!booking?.driverId) {
      setBeaconMetadata(null);
      setBeaconError(null);
      return;
    }

    let isActive = true;

    const fetchBeaconMetadata = async (): Promise<void> => {
      try {
        setBeaconLoading(true);
        setBeaconError(null);

        const metadata = await getDriverBeaconMetadata(API_BASE_URL, booking.driverId as string);

        if (isActive) {
          setBeaconMetadata(metadata);
        }
      } catch (err: any) {
        if (isActive) {
          setBeaconMetadata(null);
          setBeaconError(err.message || 'KhĂ´ng thá»ƒ táº£i thĂ´ng tin BLE beacon');
        }
      } finally {
        if (isActive) {
          setBeaconLoading(false);
        }
      }
    };

    void fetchBeaconMetadata();

    return () => {
      isActive = false;
    };
  }, [booking?.driverId]);

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

      const updatedBooking = await updateBookingStatus(API_BASE_URL, booking.id, {
        status: nextStatus,
        driverId: booking.driverId,
      });

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

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
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
      const data: Booking = await response.json();
      setBooking(data);

      // Đọc Text-to-Speech tự động cập nhật trạng thái mới nhất cho người dùng
      const statusMessage = normalizeBookingStatus(data.status) === 'PENDING'
        ? 'Đã kết nối dữ liệu hành trình. Hệ thống đang tích cực tìm kiếm tài xế.'
        : 'Cập nhật thông tin chuyến đi thành công.';
      void Speech.speak(statusMessage, { language: 'vi-VN' });

    } catch (err: any) {
      setError(err.message || 'Lỗi mạng');
    } finally {
      setLoading(false);
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
          onPress={fetchBookingDetails}
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

      {booking && <BookingDetailsCard booking={booking} />}

      {booking?.driverId ? (
        <View style={styles.beaconCard}>
          <Text style={styles.beaconTitle}>BLE Beacon</Text>
          {beaconLoading ? (
            <Text style={styles.beaconValue}>Äang táº£i thĂ´ng tin beacon...</Text>
          ) : beaconMetadata ? (
            <>
              <Text style={styles.beaconLabel}>Driver ID</Text>
              <Text style={styles.beaconValue}>{beaconMetadata.driverId}</Text>
              <Text style={styles.beaconLabel}>UUID</Text>
              <Text style={styles.beaconValue}>{beaconMetadata.uuid}</Text>
              <Text style={styles.beaconLabel}>Major / Minor</Text>
              <Text style={styles.beaconValue}>{beaconMetadata.major} / {beaconMetadata.minor}</Text>
            </>
          ) : (
            <Text style={styles.beaconError}>{beaconError || 'ChÆ°a cĂ³ thĂ´ng tin BLE beacon'}</Text>
          )}
        </View>
      ) : null}

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
  beaconCard: {
    backgroundColor: '#0F2E52',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  beaconTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  beaconLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  beaconValue: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  beaconError: {
    color: '#ffb4b4',
    fontSize: 14,
    lineHeight: 20,
  },
});
