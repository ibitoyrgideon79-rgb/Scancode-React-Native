import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  acknowledgeStoreRequest,
  acknowledgeStoreTip,
  clearActivePayoutId,
  getActivePayoutId,
  getBanks,
  getStoreOrders,
  getStoreRequests,
  getStoreTips,
  getWallet,
  refreshWithdrawal,
  rejectStoreRequest,
  requestWithdrawal,
  saveBankAccount,
  saveActivePayoutId,
  submitWithdrawalOtp,
  updateStoreOrderStatus,
  type Bank,
  type StoreOrder,
  type StoreRequest,
  type StoreTip,
  type WalletResponse,
  type WithdrawalResponse,
} from '../api';
import type { NavigationProp, RouteProps } from '../types';

interface Props {
  navigation: NavigationProp<'StorefrontManage'>;
  route: RouteProps<'StorefrontManage'>;
}

type Tab = 'orders' | 'requests' | 'tips' | 'wallet';

const TABS: { id: Tab; label: string }[] = [
  { id: 'orders', label: 'Orders' },
  { id: 'requests', label: 'Requests' },
  { id: 'tips', label: 'Tips' },
  { id: 'wallet', label: 'Wallet' },
];

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function orderLines(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return value;
    const lines = parsed
      .map((line: unknown) => {
        if (typeof line !== 'object' || line === null) return null;
        const item = line as { name?: unknown; qty?: unknown };
        if (typeof item.name !== 'string' || typeof item.qty !== 'number') return null;
        return `${item.name} × ${item.qty}`;
      })
      .filter((line): line is string => line !== null);
    return lines.length ? lines.join(', ') : value;
  } catch {
    return value;
  }
}

export default function StorefrontManageScreen({ route }: Props) {
  const { storefrontId } = route.params;
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [tips, setTips] = useState<StoreTip[]>([]);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [otp, setOtp] = useState('');
  const [withdrawal, setWithdrawal] = useState<WithdrawalResponse | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      if (tab === 'orders') setOrders(await getStoreOrders(storefrontId));
      if (tab === 'requests') setRequests(await getStoreRequests(storefrontId));
      if (tab === 'tips') setTips(await getStoreTips(storefrontId));
      if (tab === 'wallet') {
        setWallet(await getWallet(storefrontId));
        const activePayoutId = await getActivePayoutId(storefrontId);
        if (activePayoutId !== null) {
          const result = await refreshWithdrawal(storefrontId, activePayoutId);
          setWithdrawal(result);
          if (result.status !== 'PENDING' && result.status !== 'OTP_REQUIRED') {
            await clearActivePayoutId(storefrontId);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this storefront data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storefrontId, tab]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filteredBanks = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    return query ? banks.filter((bank) => bank.name.toLowerCase().includes(query)) : banks;
  }, [bankSearch, banks]);

  async function runAction(id: number, action: () => Promise<unknown>, successText: string) {
    setActionId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successText);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action could not be completed.');
    } finally {
      setActionId(null);
    }
  }

  function confirmOrderStatus(order: StoreOrder, status: 'CONFIRMED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED') {
    const refunding = status === 'REJECTED' || status === 'CANCELLED';
    const title = refunding ? 'Refund this order?' : status === 'COMPLETED' ? 'Complete this order?' : 'Confirm this order?';
    const message = refunding
      ? 'This will request a full Paystack refund for the customer.'
      : status === 'COMPLETED'
        ? 'Completing the order releases its earnings to your available wallet balance, less the 0.5% order commission.'
        : 'Mark this paid order as confirmed?';
    Alert.alert(title, message, [
      { text: 'Keep order', style: 'cancel' },
      {
        text: refunding ? 'Refund order' : 'Continue',
        style: refunding ? 'destructive' : 'default',
        onPress: () => {
          void runAction(
            order.id,
            () => updateStoreOrderStatus(storefrontId, order.id, status),
            refunding ? 'Refund request submitted.' : `Order ${status.toLowerCase()}.`,
          );
        },
      },
    ]);
  }

  function confirmRequestAction(request: StoreRequest, reject: boolean) {
    Alert.alert(
      reject ? 'Reject this request?' : 'Acknowledge this request?',
      reject && request.amount > 0
        ? 'The customer will be refunded through Paystack.'
        : 'The customer will see this request as handled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: reject ? 'Reject and refund' : 'Acknowledge',
          style: reject ? 'destructive' : 'default',
          onPress: () => {
            void runAction(
              request.id,
              () => reject
                ? rejectStoreRequest(storefrontId, request.id)
                : acknowledgeStoreRequest(storefrontId, request.id),
              reject ? 'Request rejected; refund requested.' : 'Request acknowledged.',
            );
          },
        },
      ],
    );
  }

  async function openBankPicker() {
    if (!wallet?.payoutsEnabled) return;
    setWalletBusy(true);
    setError(null);
    try {
      setBanks(await getBanks(storefrontId));
      setBankSearch('');
      setBankModalVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load supported banks.');
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleSaveBank() {
    if (!selectedBank) {
      setError('Choose a bank first.');
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError('Enter the 10-digit account number.');
      return;
    }
    setWalletBusy(true);
    setError(null);
    setNotice(null);
    try {
      setWallet(await saveBankAccount(storefrontId, accountNumber, selectedBank.code));
      setAccountNumber('');
      setNotice('Bank account verified and saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify this bank account.');
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleWithdrawal() {
    if (withdrawal?.status === 'PENDING' || withdrawal?.status === 'OTP_REQUIRED') {
      setError('Resolve or refresh the current withdrawal before requesting another payout.');
      return;
    }
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid withdrawal amount in naira.');
      return;
    }
    setWalletBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestWithdrawal(storefrontId, Math.round(amount * 100));
      setWithdrawal(result);
      setWithdrawAmount('');
      if (result.status === 'PENDING' || result.status === 'OTP_REQUIRED') {
        try {
          await saveActivePayoutId(storefrontId, result.id);
        } catch {
          setError('Withdrawal was created, but its status could not be saved on this device. Keep this screen open and note the reference.');
        }
      } else {
        try {
          await clearActivePayoutId(storefrontId);
        } catch {
          setError('Withdrawal was created, but this device could not clear its previous saved status.');
        }
      }
      if (result.status === 'OTP_REQUIRED') {
        setNotice('Paystack requires an OTP to authorize this transfer.');
      } else if (result.status === 'PENDING') {
        setNotice('Withdrawal submitted. Refresh its status before requesting another payout.');
      } else {
        setNotice(`Withdrawal status: ${result.status}.`);
      }
      try {
        setWallet(await getWallet(storefrontId));
      } catch {
        setError('Withdrawal was created, but the wallet balance could not be refreshed. Refresh before requesting another payout.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this withdrawal.');
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleSubmitOtp() {
    if (!withdrawal || !/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit transfer OTP from Paystack.');
      return;
    }
    setWalletBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await submitWithdrawalOtp(storefrontId, withdrawal.id, otp);
      setWithdrawal(result);
      setOtp('');
      if (result.status !== 'PENDING' && result.status !== 'OTP_REQUIRED') {
        try {
          await clearActivePayoutId(storefrontId);
        } catch {
          setError('Transfer authorization was sent, but this device could not clear its saved withdrawal status.');
        }
      }
      setNotice(`Withdrawal status: ${result.status}.`);
      setWallet(await getWallet(storefrontId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authorize this withdrawal.');
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleRefreshWithdrawal() {
    if (!withdrawal) return;
    setWalletBusy(true);
    setError(null);
    try {
      const result = await refreshWithdrawal(storefrontId, withdrawal.id);
      setWithdrawal(result);
      if (result.status !== 'PENDING' && result.status !== 'OTP_REQUIRED') {
        try {
          await clearActivePayoutId(storefrontId);
        } catch {
          setError('Withdrawal status was updated, but this device could not clear its saved status.');
        }
      }
      setWallet(await getWallet(storefrontId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh withdrawal status.');
    } finally {
      setWalletBusy(false);
    }
  }

  async function acknowledgeTip(tip: StoreTip) {
    await runAction(
      tip.id,
      () => acknowledgeStoreTip(storefrontId, tip.id),
      'Tip acknowledged.',
    );
  }

  function renderOrder(order: StoreOrder) {
    const busy = actionId === order.id;
    return (
      <View key={order.id} style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Order #{order.id}</Text>
          <Text style={styles.status}>{order.status.replaceAll('_', ' ')}</Text>
        </View>
        <Text style={styles.bodyText}>{order.customerName || 'Customer'} · {naira(Math.round(order.total * 100))}</Text>
        {order.customerPhone ? <Text style={styles.muted}>Phone: {order.customerPhone}</Text> : null}
        {order.customerEmail ? <Text style={styles.muted}>Email: {order.customerEmail}</Text> : null}
        {order.tableLabel ? <Text style={styles.muted}>Table: {order.tableLabel}</Text> : null}
        <Text style={styles.bodyText}>{orderLines(order.orderItems)}</Text>
        <Text style={styles.muted}>{formatDate(order.createdAt)}</Text>
        {busy ? <ActivityIndicator color="#6C63FF" style={styles.inlineBusy} /> : (
          <View style={styles.actionRow}>
            {(order.status === 'PENDING' || order.status === 'CUSTOMER_NOTIFIED') && (
              <>
                <ActionButton label="Confirm" onPress={() => confirmOrderStatus(order, 'CONFIRMED')} />
                <ActionButton label="Reject & refund" danger onPress={() => confirmOrderStatus(order, 'REJECTED')} />
              </>
            )}
            {order.status === 'CONFIRMED' && (
              <>
                <ActionButton label="Complete" onPress={() => confirmOrderStatus(order, 'COMPLETED')} />
                <ActionButton label="Cancel & refund" danger onPress={() => confirmOrderStatus(order, 'CANCELLED')} />
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderRequest(item: StoreRequest) {
    const busy = actionId === item.id;
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{item.requestType}</Text>
          <Text style={styles.status}>{item.status}</Text>
        </View>
        <Text style={styles.bodyText}>{item.details}</Text>
        <Text style={styles.bodyText}>{item.amount > 0 ? naira(Math.round(item.amount * 100)) : 'Free request'}</Text>
        <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
        {item.status === 'PENDING' && (busy
          ? <ActivityIndicator color="#6C63FF" style={styles.inlineBusy} />
          : (
            <View style={styles.actionRow}>
              <ActionButton label="Acknowledge" onPress={() => confirmRequestAction(item, false)} />
              <ActionButton label={item.amount > 0 ? 'Reject & refund' : 'Reject'} danger onPress={() => confirmRequestAction(item, true)} />
            </View>
          ))}
      </View>
    );
  }

  function renderTip(item: StoreTip) {
    const busy = actionId === item.id;
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Tip for {item.customRecipient || item.recipient}</Text>
          <Text style={styles.status}>{item.status}</Text>
        </View>
        <Text style={styles.amount}>{naira(Math.round(item.amount * 100))}</Text>
        <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
        {item.status === 'PENDING' && (busy
          ? <ActivityIndicator color="#6C63FF" style={styles.inlineBusy} />
          : <ActionButton label="Acknowledge tip" onPress={() => acknowledgeTip(item)} />)}
      </View>
    );
  }

  function renderWallet() {
    if (!wallet) return null;
    return (
      <View>
        <View style={styles.balanceRow}>
          <BalanceCard label="Available" amount={naira(wallet.availableBalanceKobo)} />
          <BalanceCard label="Pending" amount={naira(wallet.pendingBalanceKobo)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payout bank account</Text>
          {wallet.accountName ? (
            <View style={styles.bankSaved}>
              <Text style={styles.bodyText}>{wallet.accountName}</Text>
              <Text style={styles.muted}>{wallet.bankName} · •••• {wallet.accountLast4}</Text>
            </View>
          ) : (
            <Text style={styles.muted}>No verified bank account saved.</Text>
          )}
          {wallet.payoutsEnabled ? (
            <>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void openBankPicker()}
                disabled={walletBusy}
              >
                <Text style={styles.secondaryButtonText}>
                  {wallet.accountName ? 'Change bank account' : 'Choose bank'}
                </Text>
              </TouchableOpacity>
              {selectedBank ? (
                <>
                  <Text style={styles.selectedBank}>{selectedBank.name}</Text>
                  <TextInput
                    style={styles.input}
                    value={accountNumber}
                    onChangeText={(value) => setAccountNumber(value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit account number"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <PrimaryButton
                    label="Verify and save bank"
                    busy={walletBusy}
                    onPress={() => void handleSaveBank()}
                  />
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.noticeText}>
              Withdrawals are not enabled for this account yet. Paystack approval and server-side activation are required.
            </Text>
          )}
        </View>

        {wallet.payoutsEnabled && wallet.accountName ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Withdraw</Text>
            {withdrawal?.status === 'PENDING' || withdrawal?.status === 'OTP_REQUIRED' ? (
              <Text style={styles.noticeText}>
                Finish or refresh the current withdrawal before requesting another payout.
              </Text>
            ) : null}
            <Text style={styles.muted}>
              Transfer fees are deducted from your available balance. Available: {naira(wallet.availableBalanceKobo)}
            </Text>
            <TextInput
              style={styles.input}
              value={withdrawAmount}
              onChangeText={(value) => setWithdrawAmount(value.replace(/[^\d.]/g, ''))}
              placeholder="Amount in naira"
              keyboardType="decimal-pad"
              editable={withdrawal?.status !== 'PENDING' && withdrawal?.status !== 'OTP_REQUIRED'}
            />
            <PrimaryButton
              label="Request withdrawal"
              busy={walletBusy}
              disabled={withdrawal?.status === 'PENDING' || withdrawal?.status === 'OTP_REQUIRED'}
              onPress={() => void handleWithdrawal()}
            />
            {withdrawal ? (
              <View style={styles.withdrawalBox}>
                <Text style={styles.bodyText}>Withdrawal {withdrawal.reference}</Text>
                <Text style={styles.bodyText}>
                  {naira(withdrawal.amountKobo)} · Fee {naira(withdrawal.transferFeeKobo)}
                </Text>
                <Text style={styles.status}>Status: {withdrawal.status.replaceAll('_', ' ')}</Text>
                {withdrawal.status === 'OTP_REQUIRED' ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit Paystack transfer OTP"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <PrimaryButton
                      label="Authorize transfer"
                      busy={walletBusy}
                      onPress={() => void handleSubmitOtp()}
                    />
                  </>
                ) : null}
                {withdrawal.status === 'PENDING' ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => void handleRefreshWithdrawal()}
                    disabled={walletBusy}
                  >
                    <Text style={styles.secondaryButtonText}>Refresh withdrawal status</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.commissionNote}>
          The 0.5% ScanCode commission applies to completed orders only; tips and paid requests are not charged this commission.
        </Text>
      </View>
    );
  }

  const activeDataCount = tab === 'orders'
    ? orders.length
    : tab === 'requests'
      ? requests.length
      : tab === 'tips'
        ? tips.length
        : wallet ? 1 : 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setTab(item.id)}
            style={[styles.tab, tab === item.id && styles.activeTab]}
          >
            <Text style={[styles.tabText, tab === item.id && styles.activeTabText]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor="#6C63FF"
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => void load()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {tab === 'orders' && orders.map(renderOrder)}
          {tab === 'requests' && requests.map(renderRequest)}
          {tab === 'tips' && tips.map(renderTip)}
          {tab === 'wallet' && renderWallet()}
          {!error && activeDataCount === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {tab === 'wallet' ? 'Wallet is ready' : `No ${tab} yet`}
              </Text>
              <Text style={styles.muted}>
                {tab === 'wallet'
                  ? 'Paid sales will appear here after customer payments are enabled and verified.'
                  : 'New paid activity will show here after a customer completes checkout.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={bankModalVisible}
        animationType="slide"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.sectionTitle}>Choose your bank</Text>
            <TouchableOpacity onPress={() => setBankModalVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={bankSearch}
            onChangeText={setBankSearch}
            placeholder="Search banks"
            autoCapitalize="none"
          />
          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.muted}>No banks match your search.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.bankOption}
                onPress={() => {
                  setSelectedBank(item);
                  setBankModalVisible(false);
                }}
              >
                <Text style={styles.bodyText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ActionButton({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, danger && styles.dangerButton]}
      onPress={onPress}
    >
      <Text style={[styles.actionButtonText, danger && styles.dangerButtonText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  busy,
  disabled = false,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, (busy || disabled) && styles.disabledButton]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function BalanceCard({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.balance}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#6C63FF' },
  tabText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#6C63FF' },
  content: { padding: 16, paddingBottom: 36, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  cardTitle: { flex: 1, color: '#111827', fontSize: 16, fontWeight: '700' },
  status: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  bodyText: { color: '#374151', fontSize: 14, lineHeight: 21, marginBottom: 5 },
  muted: { color: '#6B7280', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  amount: { color: '#111827', fontSize: 20, fontWeight: '800', marginVertical: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionButton: { borderWidth: 1, borderColor: '#6C63FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  actionButtonText: { color: '#5B52E8', fontSize: 13, fontWeight: '700' },
  dangerButton: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  dangerButtonText: { color: '#B91C1C' },
  inlineBusy: { marginVertical: 12 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 50 },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#B91C1C', fontSize: 14, marginBottom: 8 },
  retryText: { color: '#4338CA', fontWeight: '700' },
  notice: { color: '#065F46', backgroundColor: '#D1FAE5', borderRadius: 8, padding: 12, marginBottom: 12 },
  noticeText: { color: '#92400E', backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, marginTop: 12, lineHeight: 19 },
  balanceRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  balanceCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 16, minHeight: 95, justifyContent: 'center' },
  balance: { color: '#111827', fontSize: 20, fontWeight: '800', marginTop: 6 },
  sectionTitle: { color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  bankSaved: { paddingVertical: 6 },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6C63FF', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10, marginTop: 8 },
  secondaryButtonText: { color: '#5B52E8', fontWeight: '700', fontSize: 13 },
  selectedBank: { color: '#374151', fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 9, color: '#111827', paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, marginTop: 12 },
  primaryButton: { alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#6C63FF', paddingVertical: 13, marginTop: 12 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  withdrawalBox: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 16, paddingTop: 14 },
  commissionNote: { color: '#6B7280', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10, marginTop: 4 },
  modal: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 18, paddingTop: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeText: { color: '#6C63FF', fontWeight: '700' },
  bankOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
});
