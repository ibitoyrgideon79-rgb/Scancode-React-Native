# ScanCode Mobile

Expo merchant app for creating storefronts, activating QR codes, tracking paid sales, and managing merchant payouts.

## Run on a device

Set `EXPO_PUBLIC_API_URL` to the backend address the phone can reach, then start Expo:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.25:8082"
npm start
```

Replace the example address with your development computer's LAN IP. The phone and computer must be on the same network, and the backend port must be reachable through the computer's firewall. For an Android emulator, use `http://10.0.2.2:8082`; for a physical phone, `localhost` points to the phone and will not reach the computer. For production, use the HTTPS API URL.

The app also defaults to `http://localhost:8082` when `EXPO_PUBLIC_API_URL` is unset, which is suitable only when the backend is reachable at localhost from the app runtime.

## Merchant payments

Open a published storefront from the dashboard and choose **Manage sales & wallet** to review paid orders, paid requests, tips, and balances. Orders can be confirmed, completed, or rejected/cancelled with a refund request. Paid requests can be acknowledged or rejected with a refund. Completing an order releases its balance less ScanCode's 0.5% order commission; tips and paid requests have no ScanCode commission.

Bank verification and withdrawals are available only when enabled by the backend. Commerce checkout and payout server flags remain disabled until the required Paystack approvals are in place.

## Validation

```powershell
npx tsc --noEmit
```
