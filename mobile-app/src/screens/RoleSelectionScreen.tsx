import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';


const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoleSelection'>;

const RoleSelectionScreen = () => {
  const navigation = useNavigation<NavigationProp>();


  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background map decoration */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.mapBase} />
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.mapGridH, { top: (height / 10) * i }]} />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.mapGridV, { left: (width / 7) * i }]} />
        ))}
        <View style={[styles.roadH, { top: height * 0.3 }]} />
        <View style={[styles.roadH, { top: height * 0.55 }]} />
        <View style={[styles.roadV, { left: width * 0.35 }]} />
        <View style={[styles.roadV, { left: width * 0.7 }]} />
        <View style={styles.routeGlow} />
        <View style={styles.topFade} />
        <View style={styles.bottomFade} />
      </View>



      {/* Logo / Title */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.View
          style={[
            styles.logoRing,
            {
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
            },
          ]}
        />
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🚀</Text>
        </View>
        <Text style={styles.appName}>RideNow</Text>
        <Text style={styles.appTagline}>RideNow · Accessibility First</Text>
      </Animated.View>

      {/* Role cards */}
      <Animated.View style={[styles.cardsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.chooseText}>Choose your role</Text>

        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => navigation.navigate('RiderHome')}
          activeOpacity={0.85}
        >
          <View style={styles.roleIconBox}>
            <Text style={styles.roleEmoji}>🧑‍🦯</Text>
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle}>I'm a Rider</Text>
            <Text style={styles.roleDesc}>Request a ride with accessibility support</Text>
          </View>
          <Text style={styles.roleArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, styles.roleCardAccent]}
          onPress={() => navigation.navigate('DriverHome')}
          activeOpacity={0.85}
        >
          <View style={[styles.roleIconBox, styles.roleIconBoxAccent]}>
            <Text style={styles.roleEmoji}>🚗</Text>
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle}>I'm a Driver</Text>
            <Text style={styles.roleDesc}>Accept rides and assist passengers</Text>
          </View>
          <Text style={[styles.roleArrow, { color: '#00C896' }]}>›</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>Powered by RideNow AI · v1.0</Text>
      </Animated.View>
    </View>
  );
};

const MAP_BG = '#1a2235';
const ROAD_LINE_COLOR = '#3d5080';
const ACCENT = '#00C896';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAP_BG, justifyContent: 'space-between', alignItems: 'center' },
  mapBase: { ...StyleSheet.absoluteFillObject, backgroundColor: MAP_BG },
  mapGridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#ffffff08' },
  mapGridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff08' },
  roadH: { position: 'absolute', left: 0, right: 0, height: 10, backgroundColor: ROAD_LINE_COLOR, borderRadius: 2 },
  roadV: { position: 'absolute', top: 0, bottom: 0, width: 10, backgroundColor: ROAD_LINE_COLOR, borderRadius: 2 },
  routeGlow: {
    position: 'absolute',
    top: height * 0.28,
    left: width * 0.1,
    width: width * 0.7,
    height: 4,
    backgroundColor: ACCENT,
    borderRadius: 2,
    opacity: 0.4,
    transform: [{ rotate: '15deg' }],
  },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.45, backgroundColor: '#1a223590' },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.6, backgroundColor: '#111827CC' },

  header: { alignItems: 'center', paddingTop: height * 0.14, zIndex: 10 },
  logoRing: {
    position: 'absolute',
    top: height * 0.09,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  logoEmoji: { fontSize: 38 },
  appName: { color: TEXT_PRIMARY, fontSize: 36, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 },
  appTagline: { color: TEXT_SECONDARY, fontSize: 14, letterSpacing: 0.5 },

  cardsContainer: { width: '100%', paddingHorizontal: 20, zIndex: 10, marginTop: 20 },
  chooseText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ffffff15',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  roleCardAccent: { borderColor: '#00C89630', backgroundColor: '#0f2820' },
  roleIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#E91E6320',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E91E6340',
  },
  roleIconBoxAccent: { backgroundColor: '#00C89620', borderColor: '#00C89640' },
  roleEmoji: { fontSize: 28 },
  roleInfo: { flex: 1 },
  roleTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  roleDesc: { color: TEXT_SECONDARY, fontSize: 13 },
  roleArrow: { color: '#E91E63', fontSize: 30, fontWeight: '300', marginLeft: 8 },

  footer: { paddingBottom: 32, zIndex: 10 },
  footerText: { color: '#334155', fontSize: 12, letterSpacing: 0.5 },
});

export default RoleSelectionScreen;
