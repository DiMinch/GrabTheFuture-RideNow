export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type LegacyBookingStatus = 'SEARCHING_FOR_DRIVER' | 'PICKED_UP';

export type BookingStatusLike = BookingStatus | LegacyBookingStatus;

export const normalizeBookingStatus = (status: string): BookingStatus => {
  switch (status.toUpperCase()) {
    case 'SEARCHING_FOR_DRIVER':
      return 'PENDING';
    case 'PICKED_UP':
      return 'IN_PROGRESS';
    case 'ACCEPTED':
    case 'ARRIVED':
    case 'IN_PROGRESS':
    case 'COMPLETED':
    case 'CANCELLED':
    case 'PENDING':
      return status.toUpperCase() as BookingStatus;
    default:
      return 'PENDING';
  }
};

export const getBookingStatusText = (status: string): string => {
  switch (normalizeBookingStatus(status)) {
    case 'PENDING':
      return 'Đang tìm kiếm tài xế';
    case 'ACCEPTED':
      return 'Tài xế đã nhận chuyến';
    case 'ARRIVED':
      return 'Tài xế đã đến điểm đón';
    case 'IN_PROGRESS':
      return 'Chuyến đi đang diễn ra';
    case 'COMPLETED':
      return 'Chuyến đi hoàn thành';
    case 'CANCELLED':
      return 'Chuyến đi đã bị hủy';
  }
};

export const getBookingStatusColor = (status: string): string => {
  switch (normalizeBookingStatus(status)) {
    case 'PENDING':
      return '#EAB308';
    case 'ACCEPTED':
    case 'ARRIVED':
      return '#3B82F6';
    case 'IN_PROGRESS':
      return '#8B5CF6';
    case 'COMPLETED':
      return '#22C55E';
    case 'CANCELLED':
      return '#EF4444';
  }
};

export const getNextBookingStatus = (status: string): BookingStatus | null => {
  switch (normalizeBookingStatus(status)) {
    case 'PENDING':
      return 'ACCEPTED';
    case 'ACCEPTED':
      return 'ARRIVED';
    case 'ARRIVED':
      return 'IN_PROGRESS';
    case 'IN_PROGRESS':
      return 'COMPLETED';
    case 'COMPLETED':
    case 'CANCELLED':
      return null;
  }
};
