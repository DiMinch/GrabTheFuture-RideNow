import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Vibration } from 'react-native';
import * as Speech from 'expo-speech';

interface DriverHomeScreenProps {
  onAcceptRide: () => void;
  onRejectRide?: () => void;
}

const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ onAcceptRide, onRejectRide }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = isDarkMode ? '#FFFFFF' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#CCCCCC' : '#555555';
  const cardBg = isDarkMode ? '#1E1E1E' : '#FFFFFF';

  useEffect(() => {
    // Simulate a new ride request arriving
    Vibration.vibrate([0, 500, 200, 500]); // Vibrate pattern
    Speech.speak("You have a new ride request from a visually impaired passenger", { language: 'en-US' });
  }, []);

  return (
    <View style={styles.container}>
      {/* Simulation of receiving a ride */}
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>ACCESSIBILITY REQUEST</Text>
        </View>

        <Text style={[styles.title, { color: textColor }]}>Visually Impaired</Text>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: subTextColor }]}>Pickup:</Text>
          <Text style={[styles.value, { color: textColor }]}>235 Nguyen Van Cu, D5</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: subTextColor }]}>Note:</Text>
          <Text style={[styles.value, { color: textColor, fontWeight: 'bold' }]}>Needs help finding car</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectButton} onPress={onRejectRide}>
            <Text style={styles.rejectButtonText}>REJECT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptButton} onPress={onAcceptRide}>
            <Text style={styles.acceptButtonText}>ACCEPT</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.idlePanel}>
        <Text style={[styles.idleText, { color: subTextColor }]}>Waiting for ride requests...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 30,
  },
  badgeContainer: {
    backgroundColor: '#E91E63',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 15,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#CCCCCC55',
    marginVertical: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  label: {
    width: 80,
    fontSize: 16,
  },
  value: {
    flex: 1,
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  idlePanel: {
    alignItems: 'center',
  },
  idleText: {
    fontSize: 16,
    fontStyle: 'italic',
  }
});

export default DriverHomeScreen;
