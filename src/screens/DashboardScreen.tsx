import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { getMyStorefronts, deleteToken, type StorefrontResponse } from '../api';
import type { NavigationProp } from '../types';

interface Props {
  navigation: NavigationProp<'Dashboard'>;
}

export default function DashboardScreen({ navigation }: Props) {
  const [storefronts, setStorefronts] = useState<StorefrontResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getMyStorefronts();
      // Mobile only populates storefronts (PRODUCT, RESTAURANT, HOTEL), filtering out events and business cards
      const storefrontsOnly = data.filter(
        (item) => item.businessType !== 'EVENT' && item.businessType !== 'BUSINESSCARD',
      );
      setStorefronts(storefrontsOnly);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load storefronts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await deleteToken();
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
          );
        },
      },
    ]);
  }

  function renderStorefront({ item }: { item: StorefrontResponse }) {
    const published = item.isPublished;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{item.name}</Text>
          <View style={[styles.badge, published ? styles.badgePublished : styles.badgeLocked]}>
            <Text style={[styles.badgeText, published ? styles.badgeTextPublished : styles.badgeTextLocked]}>
              {published ? 'Published' : 'QR Locked'}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <Text style={styles.cardType}>{item.businessType}</Text>

        <View style={styles.cardActions}>
          {published ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('QR', { slug: item.slug, name: item.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnText}>View QR</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.activateBtn]}
              onPress={() =>
                navigation.navigate('ActivateQR', {
                  storefrontId: item.id,
                  slug: item.slug,
                  name: item.name,
                })
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBtnText, styles.activateBtnText]}>Activate QR</Text>
            </TouchableOpacity>
          )}
        </View>
        {published && (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() =>
              navigation.navigate('StorefrontManage', {
                storefrontId: item.id,
                name: item.name,
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.manageBtnText}>Manage sales & wallet</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Storefronts</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={storefronts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStorefront}
          contentContainerStyle={[
            styles.list,
            storefronts.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#6C63FF"
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No storefronts yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first storefront to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateStorefront')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>+ Create Storefront</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateStorefront')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ New Storefront</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, gap: 12 },
  listEmpty: { flex: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgePublished: { backgroundColor: '#D1FAE5' },
  badgeLocked: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextPublished: { color: '#065F46' },
  badgeTextLocked: { color: '#92400E' },
  cardDesc: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  cardType: { fontSize: 12, color: '#9CA3AF', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', gap: 8 },
  manageBtn: {
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    marginTop: 10,
    paddingVertical: 10,
  },
  manageBtnText: { color: '#4F46E5', fontSize: 14, fontWeight: '700' },
  actionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 14 },
  activateBtn: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  activateBtnText: { color: '#ffffff' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  emptyBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#6C63FF', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#ffffff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
