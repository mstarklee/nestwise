import { api } from './api-client';

export type ReminderOutcome = 'on' | 'not_installed' | 'denied' | 'unsupported';

/** True in the installed app (Home Screen), where iPhone allows web push. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replaceAll('-', '+').replaceAll('_', '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * "Turn on reminders" (TRD §8.3). Call it only from a button tap: iPhone asks for permission only then, and only in
 * the installed app. It subscribes this device and sends the subscription to the server.
 */
export async function turnOnReminders(): Promise<ReminderOutcome> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !publicKey) return 'unsupported';
  if (!isStandalone()) return 'not_installed';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = subscription.toJSON();
  await api('POST', '/api/v1/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return 'on';
}
