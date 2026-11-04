import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { initializePayment, PAYMENT_REDIRECT_URL, verifyPayment } from '../api';
import type { NavigationProp, RouteProps } from '../types';

interface Props {
  navigation: NavigationProp<'ActivateQR'>;
  route: RouteProps<'ActivateQR'>;
}

type Step = 'idle' | 'initializing' | 'waiting' | 'verifying' | 'success' | 'error';

export default function ActivateQRScreen({ navigation, route }: Props) {
  const { slug, name } = route.params;
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function handlePay() {
    setStep('initializing');
    setErrorMsg(null);
    try {
      const res = await initializePayment('STOREFRONT_CREATION', slug);
      setReference(res.reference);
      setStep('waiting');

      const browserResult = await WebBrowser.openAuthSessionAsync(
        res.authorizationUrl,
        PAYMENT_REDIRECT_URL,
      );

      setStep('verifying');
      await handleVerify(res.reference);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMsg(msg);
      setStep('error');
    }
  }

  async function handleVerify(ref?: string) {
    const useRef = ref ?? reference;
    if (!useRef) {
      setErrorMsg('No payment reference found.');
      setStep('error');
      return;
    }
    setStep('verifying');
    setErrorMsg(null);
    try {
      const res = await verifyPayment(useRef);
      if (res.verified) {
        setStep('success');
      } else {
        setErrorMsg('Payment not confirmed yet. Please try verifying again after completing payment.');
        setStep('error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.';
      setErrorMsg(msg);
      setStep('error');
    }
  }

  if (step === 'success') {
    return (
      <View style={styles.center}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>QR Activated!</Text>
        <Text style={styles.successSub}>
          Your storefront "{name}" is now live and your QR code is active.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('QR', { slug, name })}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>View QR Code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Dashboard')}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const busy = step === 'initializing' || step === 'verifying' || step === 'waiting';

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.bg}>
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>Activation Fee</Text>
        <Text style={styles.price}>₦5,000</Text>
        <Text style={styles.priceNote}>One-time payment per storefront</Text>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>What you get</Text>
        {[
          'Unique QR code for your storefront',
          'Public storefront page at scancode.ng',
          'Share with customers instantly',
          'Permanent activation — no renewals',
        ].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {step === 'error' && reference && (
        <TouchableOpacity
          style={[styles.button, styles.verifyBtn]}
          onPress={() => handleVerify()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Verify Payment</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handlePay}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.buttonText, { marginLeft: 10 }]}>
              {step === 'initializing' && 'Opening Payment…'}
              {step === 'waiting' && 'Waiting for Payment…'}
              {step === 'verifying' && 'Verifying Payment…'}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Pay with Paystack</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.secureNote}>
        Secured by Paystack. You'll be redirected to a secure payment page.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  successSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  priceCard: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: { color: '#C7D2FE', fontSize: 14, marginBottom: 4 },
  price: { color: '#ffffff', fontSize: 42, fontWeight: '800' },
  priceNote: { color: '#C7D2FE', fontSize: 13, marginTop: 4 },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
    gap: 8,
  },
  detailTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: '#6C63FF', fontSize: 16, marginTop: 1 },
  bulletText: { color: '#4B5563', fontSize: 14, flex: 1, lineHeight: 20 },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#DC2626', fontSize: 14 },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  verifyBtn: { backgroundColor: '#059669' },
  busyRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  secureNote: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
});
