import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  CreateStorefront: undefined;
  ActivateQR: { storefrontId: number; slug: string; name: string };
  StorefrontManage: { storefrontId: number; name: string };
  QR: { slug: string; name: string };
};

export type NavigationProp<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type RouteProps<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;
