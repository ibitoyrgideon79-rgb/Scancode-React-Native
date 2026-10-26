import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from './src/types';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CreateStorefrontScreen from './src/screens/CreateStorefrontScreen';
import ActivateQRScreen from './src/screens/ActivateQRScreen';
import QRScreen from './src/screens/QRScreen';
import StorefrontManageScreen from './src/screens/StorefrontManageScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#6C63FF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#F3F4F6' },
          }}
        >
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreateStorefront"
            component={CreateStorefrontScreen}
            options={{ title: 'New Storefront', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="ActivateQR"
            component={ActivateQRScreen}
            options={({ route }) => ({
              title: route.params.name,
              headerBackTitle: 'Back',
            })}
          />
          <Stack.Screen
            name="StorefrontManage"
            component={StorefrontManageScreen}
            options={({ route }) => ({
              title: route.params.name,
              headerBackTitle: 'Back',
            })}
          />
          <Stack.Screen
            name="QR"
            component={QRScreen}
            options={({ route }) => ({
              title: `${route.params.name} — QR`,
              headerBackTitle: 'Back',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
