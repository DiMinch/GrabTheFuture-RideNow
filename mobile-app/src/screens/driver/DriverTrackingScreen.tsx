import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import * as Speech from 'expo-speech';

interface DriverTrackingScreenProps {
  onConfirmPickup: () => void;
}

const DriverTrackingScreen: React.FC<DriverTrackingScreenProps> = ({ onConfirmPickup }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = isDarkMode ? '#FFFFFF' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#CCCCCC' : '#555555';
  const cardBg = isDarkMode ? '#1E1E1E' : '#FFFFFF';

  // State to mock the ride progress
  const [distance, setDistance] = useState(150); // Starts at 150m
  const [bleConnected, setBleConnected] = useState(false);
  const [passengerSignaled, setPassengerSignaled] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<string | null>(null);

  useEffect(() => {
    // Mock decreasing distance to test UX flow
    const interval = setInterval(() => {
      setDistance((prev) => {
        if (prev <= 0) return 0;
        return prev - 10;
      });
    }, 2000); // Decreases 10m every 2s

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Handle distance milestones (TTS and State)
    let message = null;
    
    if (distance === 100) {
      message = "Visually impaired passenger is 100 meters ahead";
    } else if (distance === 50) {
      message = "Passenger is 50 meters ahead on the right";
    } else if (distance === 20) {
      message = "Passenger is flashing light and vibrating";
    } else if (distance === 10 && !bleConnected) {
      setBleConnected(true);
      message = "BLE Verification successful. Code: Flower";
    } else if (distance === 0 && !passengerSignaled) {
      setPassengerSignaled(true);
      message = "Passenger double-tapped to signal ready";
    }

    if (message) {
      setCurrentAlert(message);
      Speech.speak(message, { language: 'en-US' });
    }
  }, [distance]);

  return (
    <View style={styles.container}>
      {currentAlert && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>{currentAlert}</Text>
        </View>
      )}

      <View style={styles.distanceContainer}>
        <Text style={[styles.distanceLabel, { color: subTextColor }]}>Distance to passenger:</Text>
        <Text style={[styles.distanceValue, { color: textColor }]}>{distance}m</Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textColor }]}>Connection Status</Text>
        <View style={styles.divider} />
        
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Speaker Alert (TTS):</Text>
          <Text style={styles.statusActive}>ON</Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Detect Flash/Haptic ({'< 20m'}):</Text>
          <Text style={distance <= 20 ? styles.statusActive : styles.statusInactive}>
            {distance <= 20 ? 'DETECTED' : 'WAITING'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>BLE Secure Verification:</Text>
          <Text style={bleConnected ? styles.statusActive : styles.statusInactive}>
            {bleConnected ? 'SUCCESS (Code: Flower)' : 'SCANNING...'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Tap-to-Signal (WebSocket):</Text>
          <Text style={passengerSignaled ? styles.statusActive : styles.statusInactive}>
            {passengerSignaled ? 'PASSENGER READY' : 'WAITING...'}
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.finishButton, { opacity: passengerSignaled ? 1 : 0.6 }]} 
        onPress={onConfirmPickup}
        disabled={!passengerSignaled}
      >
        <Text style={styles.buttonText}>CONFIRM PICKUP</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  alertBanner: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  alertText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  distanceContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  distanceLabel: {
    fontSize: 18,
    marginBottom: 10,
  },
  distanceValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#00B0FF',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 40,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#CCCCCC55',
    marginVertical: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  statusLabel: {
    fontSize: 14,
    flex: 1,
  },
  statusActive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    flexShrink: 0,
    marginLeft: 10,
  },
  statusInactive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9E9E9E',
    flexShrink: 0,
    marginLeft: 10,
  },
  finishButton: {
    backgroundColor: '#6200EE',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default DriverTrackingScreen;
