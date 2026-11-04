import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { createStorefront } from '../api';
import type { NavigationProp } from '../types';

interface Props {
  navigation: NavigationProp<'CreateStorefront'>;
}

const BUSINESS_TYPES = ['PRODUCT', 'RESTAURANT', 'HOTEL'] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number];

export default function CreateStorefrontScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('PRODUCT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Business name is required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createStorefront({
        businessType,
        name: name.trim(),
        description: description.trim(),
      });
      navigation.goBack();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create storefront.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.bg}
      >
        <Text style={styles.sectionTitle}>Business Details</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Mama Ade's Kitchen"
          placeholderTextColor="#9CA3AF"
          editable={!loading}
          maxLength={100}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Tell customers about your business…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          editable={!loading}
          maxLength={500}
        />

        <Text style={styles.label}>Business Type</Text>
        <View style={styles.typeRow}>
          {BUSINESS_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, businessType === t && styles.typeBtnActive]}
              onPress={() => setBusinessType(t)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeBtnText, businessType === t && styles.typeBtnTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            After creating your storefront you'll need to pay ₦5,000 to activate your QR code.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Storefront</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#DC2626', fontSize: 14 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  typeBtnActive: { borderColor: '#6C63FF', backgroundColor: '#EEF2FF' },
  typeBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  typeBtnTextActive: { color: '#6C63FF' },
  infoBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  infoText: { color: '#4338CA', fontSize: 13, lineHeight: 18 },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
