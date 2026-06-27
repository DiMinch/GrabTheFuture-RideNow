import type { BookingStatus } from '../utils/bookingStatus';

export type UpdateBookingStatusPayload = {
  status: BookingStatus;
  driverId?: string;
};

export type UpdateBookingStatusResponse = {
  id: string;
  status: BookingStatus;
  driverId?: string;
  [key: string]: unknown;
};

export const updateBookingStatus = async (
  apiBaseUrl: string,
  bookingId: string,
  payload: UpdateBookingStatusPayload
): Promise<UpdateBookingStatusResponse> => {
  const response = await fetch(`${apiBaseUrl}/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Không thể cập nhật trạng thái chuyến đi');
  }

  return (await response.json()) as UpdateBookingStatusResponse;
};
