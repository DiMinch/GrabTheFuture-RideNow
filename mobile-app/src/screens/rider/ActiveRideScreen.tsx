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

// Khai báo kiểu Props cho màn hình này
type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRide'>;

const API_BASE_URL = 'http://192.168.x.x:3000'; // Đổi lại IP của bạn

export default function ActiveRideScreen({ route, navigation }: Props): React.JSX.Element {
  // Lấy ride_id (chính là bookingId) được truyền từ RiderHomeScreen sang
  const { ride_id } = route.params;

  // Khởi tạo các state
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gọi API ngay khi màn hình vừa render xong
  useEffect(() => {
    fetchBookingDetails();

    return () => {
      Speech.stop(); // Cancel speech when screen is unmount
    };
  }, [ride_id]);

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
      const statusMessage = data.status === 'PENDING' || data.status === 'SEARCHING_FOR_DRIVER'
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
  }
});