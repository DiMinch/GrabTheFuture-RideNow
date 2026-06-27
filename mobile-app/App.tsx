import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { NativeStackNavigationProp, createNativeStackNavigator } from '@react-navigation/native-stack';

import RiderHomeScreen from './src/screens/rider/RiderHomeScreen';
import ActiveRideScreen from './src/screens/rider/ActiveRideScreen';
import DriverHomeScreen from './src/screens/driver/DriverHomeScreen';
import DriverTrackingScreen from './src/screens/driver/DriverTrackingScreen';

export type RootStackParamList = {
  RoleSelection: undefined;
  RiderHome: undefined;
  ActiveRide: { ride_id: string };
  DriverHome: undefined;
  DriverTracking: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type RoleSelectionNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoleSelection'>;

function RoleSelectionScreen({ navigation }: { navigation: RoleSelectionNavigationProp }): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your mode</Text>
      <TouchableOpacity style={[styles.optionButton, styles.riderButton]} onPress={() => navigation.navigate('RiderHome')}>
        <Text style={styles.optionButtonText}>Rider</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.optionButton, styles.driverButton]} onPress={() => navigation.navigate('DriverHome')}>
        <Text style={styles.optionButtonText}>Driver</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="RoleSelection" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="RiderHome" component={RiderHomeScreen} />
        <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
        <Stack.Screen name="DriverHome">
          {({ navigation }) => (
            <DriverHomeScreen
              onAcceptRide={() => navigation.navigate('DriverTracking')}
              onRejectRide={() => Alert.alert('Rejected', 'You have rejected this ride.')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="DriverTracking">
          {({ navigation }) => (
            <DriverTrackingScreen
              onConfirmPickup={() => {
                Alert.alert(
                  'Pickup Confirmed',
                  'Passenger has been picked up. Starting navigation to destination.'
                );
                navigation.navigate('DriverHome');
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: '#1A1A1A',
  },
  optionButton: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  riderButton: {
    backgroundColor: '#0057FF',
  },
  driverButton: {
    backgroundColor: '#2E7D32',
  },
  optionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});