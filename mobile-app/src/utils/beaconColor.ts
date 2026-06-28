export interface BeaconColor {
  name: string;
  nameEn: string;
  hex: string;
}

export const BEACON_COLORS: BeaconColor[] = [
  { name: 'Xanh Dương', nameEn: 'Blue', hex: '#00B0FF' },
  { name: 'Xanh Lá', nameEn: 'Green', hex: '#00E676' },
  { name: 'Cam', nameEn: 'Orange', hex: '#FF9100' },
  { name: 'Vàng', nameEn: 'Yellow', hex: '#FFEA00' },
  { name: 'Hồng', nameEn: 'Pink', hex: '#F50057' },
  { name: 'Tím', nameEn: 'Purple', hex: '#D500F9' },
];

export const getBeaconColor = (rideId: string): BeaconColor => {
  if (!rideId) return BEACON_COLORS[0];
  let hash = 0;
  for (let i = 0; i < rideId.length; i++) {
    hash = rideId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BEACON_COLORS.length;
  return BEACON_COLORS[index];
};
