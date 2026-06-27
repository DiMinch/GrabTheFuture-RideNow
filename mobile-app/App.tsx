import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RiderHomeScreen from './src/screens/rider/RiderHomeScreen';
import ActiveRideScreen from './src/screens/rider/ActiveRideScreen';

export type RootStackParamList = {
  RiderHome: undefined;
  ActiveRide: { ride_id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="RiderHome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RiderHome" component={RiderHomeScreen} />
        <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}