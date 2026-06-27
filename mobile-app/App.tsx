import React from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RiderHomeScreen from './src/screens/rider/RiderHomeScreen';
import ActiveRideScreen from './src/screens/rider/ActiveRideScreen';
import DriverHomeScreen from './src/screens/driver/DriverHomeScreen';
import DriverTrackingScreen from './src/screens/driver/DriverTrackingScreen';

export type RootStackParamList = {
  RiderHome: undefined;
  ActiveRide: { ride_id: string };
  DriverHome: undefined;
  DriverTracking: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="RiderHome" screenOptions={{ headerShown: false }}>
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
