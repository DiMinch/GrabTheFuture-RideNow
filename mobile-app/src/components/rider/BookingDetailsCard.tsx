import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  getBookingStatusColor,
  getBookingStatusText,
  type BookingStatusLike,
} from '../../utils/bookingStatus';

// Định nghĩa cấu trúc Location khớp component schema định nghĩa trong API Docs
export interface Location {
  latitude: number;
  longitude: number;
}

// Định nghĩa cấu trúc dữ liệu trả về (Response JSON Schema) của Booking
export interface Booking {
  id: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  pickupAddress?: string;
  dropoffAddress?: string;
  accessibilityMode: boolean;
  status: BookingStatusLike;
  driverId?: string;
  createdAt?: string;
}

interface BookingDetailsCardProps {
  booking: Booking;
}

export default function BookingDetailsCard({ booking }: BookingDetailsCardProps): React.JSX.Element {
  const currentStatusText = getBookingStatusText(booking.status);
  
  // Chuỗi thông tin tối ưu hóa cho công cụ đọc màn hình (VoiceOver / TalkBack)
  const accessibleText = `Thông tin chuyến đi. Mã số ${booking.id}. Trạng thái: ${currentStatusText}. Điểm đón: ${booking.pickupAddress || 'Chưa cập nhật địa chỉ'}. Điểm đến: ${booking.dropoffAddress || 'Chưa cập nhật địa chỉ'}. Chế độ hỗ trợ khiếm thị: ${booking.accessibilityMode ? 'Đang bật' : 'Tắt'}.`;

  return (
    <View 
      style={styles.card}
      accessible={true}
      accessibilityLabel={accessibleText}
    >
      <Text style={styles.headerText}>Thông Tin Chuyến Đi</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Mã đơn đặt:</Text>
        <Text style={styles.value}>{booking.id}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Trạng thái:</Text>
        <Text style={[styles.value, { color: getBookingStatusColor(booking.status), fontWeight: '700' }]}>
          {currentStatusText}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Điểm đón:</Text>
        <Text style={styles.value}>
          {booking.pickupAddress || `Tọa độ: ${booking.pickupLocation.latitude}, ${booking.pickupLocation.longitude}`}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Điểm đến:</Text>
        <Text style={styles.value}>
          {booking.dropoffAddress || `Tọa độ: ${booking.dropoffLocation.latitude}, ${booking.dropoffLocation.longitude}`}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Chế độ hỗ trợ tiếp cận:</Text>
        <Text style={styles.value}>{booking.accessibilityMode ? 'Đang bật (Ưu tiên)' : 'Tắt'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#123A63',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginTop: 20,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    paddingBottom: 8,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 2,
    lineHeight: 22,
  },
});