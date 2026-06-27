import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  useColorScheme,
  Alert,
} from 'react-native';

// Import skeleton hooks/services (to be implemented during Hackathon phases)
// import { useBLEHandshake } from './src/hooks/useBLEHandshake';
// import { useProximitySensor } from './src/hooks/useProximitySensor';
// import { useVoiceAgent } from './src/hooks/useVoiceAgent';

const App = (): React.JSX.Element => {
  const isDarkMode = useColorScheme() === 'dark';
  const [appMode, setAppMode] = useState<'rider' | 'driver'>('rider');
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#121212' : '#F5F6FA',
    flex: 1,
  };

  const toggleAppMode = () => {
    setAppMode((prev) => (prev === 'rider' ? 'driver' : 'rider'));
  };

  const handleHoldToTalkStart = () => {
    setIsVoiceActive(true);
    // TODO: Trigger WebRTC / Gemini Audio Stream init
  };

  const handleHoldToTalkEnd = () => {
    setIsVoiceActive(false);
    // TODO: Terminate WebRTC / Process final commands
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1A1A1A' }]}>
          RideNow
        </Text>
        <TouchableOpacity
          style={[styles.modeBadge, { backgroundColor: appMode === 'rider' ? '#00B0FF' : '#4CAF50' }]}
          onPress={toggleAppMode}
        >
          <Text style={styles.modeText}>
            {appMode === 'rider' ? 'PASSENGER MODE' : 'DRIVER MODE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {appMode === 'rider' ? (
        /* PASSENGER ACCESSIBILITY MODE */
        <View style={styles.container}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPressIn={handleHoldToTalkStart}
            onPressOut={handleHoldToTalkEnd}
            style={[
              styles.hugeButton,
              {
                backgroundColor: isVoiceActive ? '#E91E63' : '#6200EE',
                shadowColor: isVoiceActive ? '#E91E63' : '#6200EE',
              },
            ]}
          >
            <Text style={styles.buttonMainText}>
              {isVoiceActive ? 'Listening...' : 'HOLD TO SPEAK'}
            </Text>
            <Text style={styles.buttonSubText}>
              Hold anywhere and speak to request a ride.
            </Text>
          </TouchableOpacity>

          <View style={styles.statusPanel}>
            <Text style={[styles.statusTitle, { color: isDarkMode ? '#888' : '#666' }]}>
              ACCESSIBILITY SERVICES STATUS
            </Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: isDarkMode ? '#DDD' : '#333' }]}>Haptic Radar:</Text>
              <Text style={styles.statusValueActive}>READY</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: isDarkMode ? '#DDD' : '#333' }]}>BLE Beacon Scanner:</Text>
              <Text style={styles.statusValueActive}>SCANNING</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: isDarkMode ? '#DDD' : '#333' }]}>Proximity Sensor:</Text>
              <Text style={styles.statusValueActive}>MONITORING</Text>
            </View>
          </View>
        </View>
      ) : (
        /* DRIVER INTERFACE */
        <View style={styles.container}>
          <View style={[styles.card, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' }]}>
            <Text style={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : '#1A1A1A' }]}>
              Incoming Accessibility Ride
            </Text>
            <View style={styles.divider} />
            <Text style={[styles.cardDetail, { color: isDarkMode ? '#CCC' : '#555' }]}>
              Passenger: Visually Impaired Rider
            </Text>
            <Text style={[styles.cardDetail, { color: isDarkMode ? '#CCC' : '#555' }]}>
              Pickup: 235 Nguyen Van Cu, Ward 4, District 5
            </Text>

            <TouchableOpacity
              style={styles.driverButton}
              onPress={() => Alert.alert('Ride Accepted', 'Starting navigation and broadcasting BLE beacon.')}
            >
              <Text style={styles.driverButtonText}>ACCEPT & ACTIVATE BEACON</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusPanel}>
            <Text style={[styles.statusTitle, { color: isDarkMode ? '#888' : '#666' }]}>
              DRIVER ACCESSIBILITY BROADCAST
            </Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: isDarkMode ? '#DDD' : '#333' }]}>BLE Transmitting:</Text>
              <Text style={styles.statusValueActive}>ON (Major: 1, Minor: 102)</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: isDarkMode ? '#DDD' : '#333' }]}>TTS Audio Alerts:</Text>
              <Text style={styles.statusValueActive}>ENABLED (Speaker)</Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#CCCCCC55',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  hugeButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    marginVertical: 30,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    paddingHorizontal: 20,
  },
  buttonMainText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonSubText: {
    color: '#FFFFFFCC',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
  statusPanel: {
    padding: 20,
    borderRadius: 15,
    backgroundColor: '#00000010',
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValueActive: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  card: {
    flex: 1,
    borderRadius: 25,
    padding: 25,
    marginVertical: 30,
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#CCCCCC55',
    marginVertical: 15,
  },
  cardDetail: {
    fontSize: 16,
    marginVertical: 6,
  },
  driverButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 30,
  },
  driverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default App;
