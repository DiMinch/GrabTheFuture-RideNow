import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Lang = 'en' | 'vi';

// ─── Translation map ────────────────────────────────────────────────────────
export const translations = {
  en: {
    // RoleSelection
    appTagline: 'RideNow · Accessibility First',
    chooseRole: 'Choose your role',
    iAmRider: "I'm a Rider",
    riderDesc: 'Request a ride with accessibility support',
    iAmDriver: "I'm a Driver",
    driverDesc: 'Accept rides and assist passengers',
    poweredBy: 'Powered by RideNow AI · v1.0',

    // DriverHome
    online: 'ONLINE',
    offline: 'OFFLINE',
    today: 'Today',
    trips: 'Trips',
    rating: 'Rating',
    accessibilityRequest: 'ACCESSIBILITY REQUEST',
    visuallyImpaired: 'Visually Impaired Passenger',
    rides: 'rides',
    pickup: 'PICKUP',
    dropoff: 'DROPOFF',
    specialNote: 'Needs assistance finding car · BLE auth · TTS enabled',
    minToPickup: 'min to pickup',
    surge: 'Surge ×1.2',
    skip: 'SKIP',
    acceptRide: 'ACCEPT RIDE',

    // DriverTracking
    enRoute: 'En Route to Pickup',
    distanceAway: 'away',
    toPassenger: 'to passenger',
    connectionStatus: 'System Status',
    ttaLabel: 'Text-to-Speech (TTS)',
    ttaStatus: 'Active — English (US)',
    flashLabel: 'Flash / Haptic Detection',
    flashWaiting: 'Waiting (< 20m)',
    flashDetected: 'SIGNAL DETECTED',
    bleLabel: 'BLE Secure Verification',
    bleScanning: 'Scanning...',
    bleSuccess: '✓ Code: Flower 🌸',
    tapLabel: 'Tap-to-Signal (WebSocket)',
    tapWaiting: 'Waiting for signal...',
    tapReady: 'PASSENGER READY ✅',
    confirmPickup: 'CONFIRM PICKUP',
    waitingPassenger: 'WAITING FOR PASSENGER',
    min: 'min',
    headingToDestination: 'Driving to Destination',
    toDestination: 'to destination',
    confirmDropoff: 'CONFIRM DROPOFF',

    // RiderHome
    riderIdle: 'Tap the screen to give a voice command.',
    riderListening: 'Recording command. Tap again to send.',
    riderProcessing: 'Processing your ride request...',
    riderBooked: 'Ride booked. Opening trip screen.',
    riderIdleSub: 'TTS will read instructions when screen opens.',
    riderListeningSub: 'Virtual mic is open. Tap again to send command.',
    riderProcessingSub: 'System is simulating backend booking call.',
    riderBookedSub: 'Opening trip navigation screen.',
  },
  vi: {
    // RoleSelection
    appTagline: 'RideNow · Ưu tiên người khuyết tật',
    chooseRole: 'Chọn vai trò của bạn',
    iAmRider: 'Tôi là Hành khách',
    riderDesc: 'Đặt xe với hỗ trợ tiếp cận',
    iAmDriver: 'Tôi là Tài xế',
    driverDesc: 'Nhận chuyến & hỗ trợ hành khách',
    poweredBy: 'Được hỗ trợ bởi RideNow AI · v1.0',

    // DriverHome
    online: 'TRỰC TUYẾN',
    offline: 'NGOẠI TUYẾN',
    today: 'Hôm nay',
    trips: 'Chuyến',
    rating: 'Đánh giá',
    accessibilityRequest: 'YÊU CẦU HỖ TRỢ',
    visuallyImpaired: 'Hành khách khiếm thị',
    rides: 'chuyến',
    pickup: 'ĐÓN',
    dropoff: 'TRẢ',
    specialNote: 'Cần hỗ trợ tìm xe · Xác thực BLE · TTS đã bật',
    minToPickup: 'phút đến điểm đón',
    surge: 'Phụ phí ×1.2',
    skip: 'BỎ QUA',
    acceptRide: 'NHẬN CHUYẾN',

    // DriverTracking
    enRoute: 'Đang đến điểm đón',
    distanceAway: 'còn lại',
    toPassenger: 'đến hành khách',
    connectionStatus: 'Trạng thái hệ thống',
    ttaLabel: 'Đọc màn hình (TTS)',
    ttaStatus: 'Đang hoạt động — Tiếng Việt',
    flashLabel: 'Phát hiện đèn flash / rung',
    flashWaiting: 'Chờ (< 20m)',
    flashDetected: 'ĐÃ PHÁT HIỆN TÍN HIỆU',
    bleLabel: 'Xác thực BLE bảo mật',
    bleScanning: 'Đang quét...',
    bleSuccess: '✓ Mã: Hoa 🌸',
    tapLabel: 'Gõ để báo hiệu (WebSocket)',
    tapWaiting: 'Đang chờ tín hiệu...',
    tapReady: 'HÀNH KHÁCH SẴN SÀNG ✅',
    confirmPickup: 'XÁC NHẬN ĐÓN KHÁCH',
    waitingPassenger: 'ĐANG CHỜ HÀNH KHÁCH',
    min: 'phút',
    headingToDestination: 'Đang đến điểm trả',
    toDestination: 'đến điểm trả',
    confirmDropoff: 'XÁC NHẬN TRẢ KHÁCH',

    // RiderHome
    riderIdle: 'Chạm vào màn hình để ra lệnh giọng nói.',
    riderListening: 'Đang ghi nhận lệnh. Chạm lần nữa để gửi.',
    riderProcessing: 'Đang xử lý yêu cầu đặt xe...',
    riderBooked: 'Đặt xe thành công. Đang mở hành trình.',
    riderIdleSub: 'TTS sẽ đọc hướng dẫn ngay khi màn hình mở.',
    riderListeningSub: 'Mikro ảo đang mở. Chạm thêm lần nữa để gửi lệnh.',
    riderProcessingSub: 'Hệ thống đang mô phỏng gọi backend đặt xe.',
    riderBookedSub: 'Mở màn hình điều hướng hành trình.',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

// ─── Context ─────────────────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'vi',
  toggleLang: () => {},
  t: (key) => translations.vi[key],
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>('vi');

  const toggleLang = () => setLang((prev) => (prev === 'vi' ? 'en' : 'vi'));

  const t = (key: TranslationKey): string => translations[lang][key];

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);

// ─── Reusable toggle button ───────────────────────────────────────────────────
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface LangToggleProps {
  style?: ViewStyle;
}

export const LangToggleButton = ({ style }: LangToggleProps) => {
  const { lang, toggleLang } = useLang();
  return (
    <TouchableOpacity style={[langStyles.btn, style]} onPress={toggleLang} activeOpacity={0.8}>
      <Text style={[langStyles.inactive, lang === 'vi' && langStyles.active]}>VI</Text>
      <Text style={langStyles.divider}>|</Text>
      <Text style={[langStyles.inactive, lang === 'en' && langStyles.active]}>EN</Text>
    </TouchableOpacity>
  );
};

const langStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293BCC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#ffffff20',
    gap: 4,
  },
  inactive: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  active: {
    color: '#00C896',
  },
  divider: {
    color: '#334155',
    fontSize: 12,
    marginHorizontal: 2,
  },
});
