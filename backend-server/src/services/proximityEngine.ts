const EARTH_RADIUS_M = 6371000;

export interface Coordinate {
    latitude: number;
    longitude: number;
}

type Phase = "far" | "gps_guide" | "haptic" | "ble_handshake";

interface HapticIntensity {
  intensity: number;
  beepHz: number;
}

export const THRESHOLDS = {
  GPS_GUIDE_M: 100,
  HAPTIC_M: 20,
  BLE_HANDSHAKE_M: 5,
} as const;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Khoảng cách thật (mét) giữa 2 tọa độ GPS - công thức Haversine. */
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_M * c;
}

/** Góc phương vị (0-360, 0 = Bắc thật) từ điểm a hướng tới điểm b. */
export function bearingDegrees(a: Coordinate, b: Coordinate): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));

  return (brng + 360) % 360;
}

const COMPASS_LABELS_VI: readonly string[] = [
  "Bắc",
  "Đông Bắc",
  "Đông",
  "Đông Nam",
  "Nam",
  "Tây Nam",
  "Tây",
  "Tây Bắc",
];

/** Quy đổi góc tuyệt đối (0-360) sang 1 trong 8 hướng la bàn tiếng Việt. */
export function compassLabel(bearingDeg: number): string {
  const index = Math.round(bearingDeg / 45) % 8;
  return COMPASS_LABELS_VI[index];
}

const RELATIVE_LABELS_VI: readonly string[] = [
  "phía trước",
  "phía trước bên phải",
  "bên phải",
  "phía sau bên phải",
  "phía sau",
  "phía sau bên trái",
  "bên trái",
  "phía trước bên trái",
];

/**
 * Quy đổi góc sang hướng tương đối so với hướng đang đứng/di chuyển.
 */
export function relativeLabel(
  bearingDeg: number,
  headingDeg: number
): string {
  const relative = ((bearingDeg - headingDeg) % 360 + 360) % 360;
  const index = Math.round(relative / 45) % 8;
  return RELATIVE_LABELS_VI[index];
}

/** Trả về giai đoạn hiện tại dựa trên khoảng cách (mét). */
export function getPhase(distance: number): Phase {
  if (distance <= THRESHOLDS.BLE_HANDSHAKE_M) return "ble_handshake";
  if (distance <= THRESHOLDS.HAPTIC_M) return "haptic";
  if (distance <= THRESHOLDS.GPS_GUIDE_M) return "gps_guide";
  return "far";
}

/**
 * Map khoảng cách -> độ mạnh rung và tần số bíp.
 */
export function getHapticIntensity(
  distance: number
): HapticIntensity {
  if (distance > THRESHOLDS.HAPTIC_M) {
    return {
      intensity: 0,
      beepHz: 0,
    };
  }

  const ratio = 1 - distance / THRESHOLDS.HAPTIC_M;

  return {
    intensity: Math.max(0, Math.min(1, ratio)),
    beepHz: Math.round(1 + ratio * 7),
  };
}

/**
 * Câu TTS cho người khiếm thị.
 */
export function buildRiderGuidanceText(
  distance: number,
  bearingDeg: number,
  riderHeadingDeg?: number | null
): string {
  const direction =
    riderHeadingDeg != null
      ? relativeLabel(bearingDeg, riderHeadingDeg)
      : compassLabel(bearingDeg);

  const roundedDistance = Math.round(distance);

  return `Xe đang ở ${direction}, ${roundedDistance} mét.`;
}

/**
 * Câu cảnh báo cho tài xế.
 */
export function buildDriverAlertText(
  distance: number,
  bearingDeg: number,
  driverHeadingDeg?: number | null,
  riderName?: string
): string {
  const direction =
    driverHeadingDeg != null
      ? relativeLabel(bearingDeg, driverHeadingDeg)
      : compassLabel(bearingDeg);

  const roundedDistance = Math.round(distance);

  const who = riderName
    ? `Hành khách ${riderName}`
    : "Hành khách khiếm thị";

  return `${who} ở ${direction} ${roundedDistance} mét.`;
}