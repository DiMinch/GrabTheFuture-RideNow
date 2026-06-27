# RideNow - Smart Mobility Solution for Visually Impaired Passengers

RideNow is an accessibility-focused smart mobility layer designed to bridge the **"Last-Meter Gap"**—the final, highly visual steps of locating and boarding a ride-hailing vehicle. The system integrates hardware features (BLE, Haptics, Flash, Sensors) with real-time Multimodal Voice AI to provide an audio-first experience for visually impaired passengers and seamless guidance for drivers.

---

## 1. 🚨 Problem Statement & Bicultural Context
Visually impaired people in urban environments like Ho Chi Minh City rely heavily on ride-hailing services for independent travel. However, the current UX is designed entirely for sighted users:
* **The Last-Meter Gap:** Once the driver arrives at a busy picking spot, passengers cannot see license plates, vehicle color, or gestures.
* **Driver Restrictions:** Drivers cannot wear headphones while riding/driving, which prevents continuous voice guidance.
* **Loss of Autonomy:** Passengers are forced to ask strangers to find their driver, sacrificing independence and safety.
* **No Accessibility Modes:** Existing platforms (e.g., Grab, Be) lack a dedicated accessibility mode that resolves this gap.

---

## 2. 💡 Solution Overview & Core Mechanics
RideNow solves this by establishing a synchronized system of three core technical mechanisms:

### 2.1 AI Voice Agent (Hands-Free Booking)
* **Audio-First Interface:** The mobile screen acts as a giant button. Using the proximity sensor, when the user raises the phone to their ear, it opens a low-latency (under 200ms) WebRTC/WebSocket audio stream with a **Gemini Multimodal Live Agent**.
* **Automatic Parsing:** The AI listens, captures destination inputs, checks the current GPS coordinate, and queries routing options without requiring visual confirmation.

### 2.2 Proximity Guidance (Haptic Radar + Flash Beacon)
* **Azimuth Audio Navigation:** At <100m, the app reads out relative directions ("Vehicle is at 2 o'clock, 80 meters away") updated every 3 seconds.
* **Haptic Radar:** At <20m, the passenger's phone vibrates in frequency pulses relative to distance (pulses speed up as the vehicle approaches).
* **Flash Beacon:** Simultaneously, the passenger's phone camera flash blinks in a specific frequency cycle, allowing the driver to spot the correct passenger in a crowd.
* **Driver Alerts:** The driver app plays audio alerts over the external speaker ("Visually impaired customer 15 meters to your front-right") to avoid driver distraction.

### 2.3 Secure Authentication (BLE Handshake + Tap-to-Signal)
* **BLE Verification:** When the driver is within <5m, the passenger app scans the driver's BLE beacon and automatically reads the confirmation info ("Driver: Nguyen Van A - Code: Rose").
* **Tap-to-Signal:** The passenger double-taps the screen. A WebSocket packet notifies the driver that the passenger is ready to board. No calls are needed.

---

## 3. 🎯 MVP Features
| Role | Feature | Technical Mechanism |
| :--- | :--- | :--- |
| **Passenger** | Hold-to-Talk Session | WebRTC + Gemini Live API |
| **Passenger** | Azimuth Audio Guidance | GPS Azimuth + Text-to-Speech (TTS) |
| **Passenger** | Haptic Radar | Vibration API frequency scaling |
| **Passenger** | Flash Beacon | Camera Torch API flashing |
| **Passenger** | BLE Handshake | `react-native-ble-plx` scanning |
| **Driver** | Loudspeaker Audio Alerts | WebSocket -> Driver app TTS |
| **System** | Smart Accessibility Match | Backend prioritizes accessibility-certified drivers |

---

## 🏗️ Technical Architecture & Data Flow

```mermaid
graph TD
    subgraph Passenger App (React Native)
        UI[Audio-First Screen & Sensors]
        BLE[BLE Scanner]
        AudioRTC[WebRTC Client]
    end

    subgraph Driver App (React Native)
        DUI[Driver UI / Speaker]
        Beacon[BLE Beacon Broadcast]
    end

    subgraph Backend Server (Node.js & Firebase)
        WS[WebSocket Hub]
        Firebase[Firebase Database & Matching]
    end

    subgraph AI Gateway (FastAPI)
        RTCGW[WebRTC Signalling]
        Gemini[Gemini Multimodal Live API]
    end

    UI -->|Raise to Ear / Voice| AudioRTC
    AudioRTC <-->|WebRTC Stream| RTCGW
    RTCGW <-->|Bidirectional WS| Gemini
    
    BLE <-->|RSSI Scanner <5m| Beacon
    UI -->|Tap-to-Signal| WS
    WS -->|Realtime Alert| DUI
    
    DUI -->|GPS Updates| WS
    WS -->|Distance & Azimuth calculation| UI
```

### Data Flow Summaries:
1. **Booking:** [User Voice Input] → `AI Gateway` WebRTC stream → `Gemini Live` parsing → [API Call to Backend] → Ride Created.
2. **Geofencing:** [Driver GPS] → `Backend Server` → [Azimuth calculation] → Passenger Screen & TTS.
3. **Boarding:** [Driver BLE Beacon] → Broadcast → [Passenger BLE Scan] → TTS verification → Passenger Tap → WebSocket → Driver Alert.

---

## 📁 Repository Structure
```text
├── docs/
│   └── openapi.yaml          # Shared API Contract (Auth, Bookings, BLE & AI endpoints)
├── mobile-app/               # React Native Client (Rider Mode & Driver Mode)
│   ├── src/                  # App components, screens, services, hooks, navigation
│   ├── App.tsx               # Main application container UI & state mockup
│   ├── package.json          # Dependencies (BLE, WebRTC, TTS, Sensors, Haptic, Socket.io)
│   └── .env.example          # Mobile connection URLs and mock configs
├── backend-server/           # Node.js Express & WebSocket matching server
│   ├── src/index.ts          # Socket.io connection orchestration
│   ├── src/server.ts         # Express server configuration
│   ├── src/config/firebase.ts# Firebase SDK startup
│   ├── src/routes/index.ts   # Express routes and sandbox mockup mocks
│   └── .env.example          # Server ports & Firebase paths configuration
└── ai-gateway/               # FastAPI proxy gateway for Gemini Live
    ├── main.py               # Gateway main runner file
    ├── app/api/endpoints.py  # WebRTC/WS streaming routes
    ├── app/services/gemini.py# Gemini Live WebSocket client service template
    └── .env.example          # Gemini keys and server configurations
```

---

## 🛠️ Prerequisites & Installation Steps

### Prerequisites
1. **Node.js** (v18 or higher)
2. **Python** (v3.10 or higher)
3. **Mobile SDKs**: Android Studio (SDK 34+) and/or Xcode for iOS builds.

### Step-by-Step Installation
Clone the repository and install dependencies for each service:

```bash
# 1. Setup Backend Server
cd backend-server
npm install
cp .env.example .env

# 2. Setup AI Gateway
cd ../ai-gateway
python -m venv venv
# Linux/macOS: source venv/bin/activate
# Windows:
.\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# 3. Setup Mobile App
cd ../mobile-app
npm install
cp .env.example .env
```

---

## 🚀 Run Instructions

### A. Local Development

#### 1. Start the Backend Server (Port 5000)
```bash
cd backend-server
npm run dev
```

#### 2. Start the AI Gateway (Port 8000)
Make sure your Gemini API key is filled in `ai-gateway/.env`.
```bash
cd ai-gateway
# Activate venv first
python main.py
```

#### 3. Start the React Native Bundler
Make sure the API endpoints are configured in `mobile-app/.env`.
```bash
cd mobile-app
npm start
```
Then, run on emulator/simulator:
* For Android: `npm run android`
* For iOS: `npm run ios`

---

### B. Mobile testing with External Tunnels (Cloud / ngrok)
Since physical mobile devices cannot access `localhost` directly when running on cellular networks or different Wi-Fi networks:
1. Run `ngrok http 5000` to tunnel the backend.
2. Run `ngrok http 8000` to tunnel the AI gateway.
3. Replace the `BACKEND_URL`, `AI_GATEWAY_URL`, and `AI_GATEWAY_WS_URL` inside `mobile-app/.env` with your HTTPS/WSS ngrok domains.
4. Build the app on your physical device.

---

## 📱 User Guide (E2E Walkthrough)

### Phase 1: Booking a Ride
1. **Passenger:** Open the RideNow app.
2. **Passenger:** Tap and hold anywhere on the screen (or hold the phone to your ear). You will hear a chime.
3. **Passenger:** Speak clearly: *"Đặt cho tôi một xe ôm đến 235 Nguyễn Văn Cừ"* (Book me a ride to 235 Nguyen Van Cu).
4. **AI Gateway:** Streams the audio to Gemini Live, which parses the destination, maps it against GPS coordinates, books the ride on the backend, and replies: *"Đã tìm thấy tài xế Nguyễn Văn A. Quãng đường 3km. Xe sẽ đến trong 5 phút."* (Driver found. Distance 3km. Arriving in 5 mins).

### Phase 2: Approach & Proximity Guidance
1. **Driver:** Navigates to the passenger's GPS coordinate.
2. **Passenger App:** Continuously calculates distance and azimuth. The phone speaks: *"Xe đang ở hướng 12 giờ, 80 mét"* (Vehicle is at 12 o'clock, 80 meters).
3. **Tactile feedback:** When the driver is under 20 meters, the passenger's phone starts vibrating in rhythmic pulses.
4. **Visual Indicator:** The passenger's camera flash automatically starts flashing, signalling their location to the driver.
5. **Driver App:** Plays audio announcements over the driver's device speakers so they can hear where the visually impaired passenger is standing.

### Phase 3: BLE Handshake & Safe Boarding
1. **Driver:** Pulls up near the passenger. The driver's app broadcasts a BLE Beacon ID.
2. **Passenger App:** Detects the BLE Beacon RSSI value. At close range (<5m), it speaks: *"Tài xế Nguyễn Văn A đã dừng kế bên. Mã nhận diện: Bông Hoa"* (Driver Nguyen Van A has stopped next to you. Recognition Code: Rose).
3. **Passenger:** Double-taps the screen (Tap-to-Signal).
4. **Driver App:** Receives a WebSocket trigger and sounds a chime: *"Hành khách đã xác nhận lên xe"* (Passenger has confirmed boarding).
5. The ride begins safely without any looking or complex UI navigation!
