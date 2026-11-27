import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { localApi } from './local-api';
import { ApiError } from './errors';

export { ApiError } from './errors';

/** Standalone APK: the backend runs entirely on the phone. */
export const IS_LOCAL_MODE = true;

const CONFIGURED = String(
  Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api'
).replace(/\/$/, '');

let cachedBase: Promise<string> | null = null;

export function getBaseUrl(): Promise<string> {
  if (!cachedBase) {
    cachedBase = AsyncStorage.getItem('buddy.apiUrl').then((saved) =>
      (saved || CONFIGURED).replace(/\/$/, '')
    );
  }
  return cachedBase;
}

export async function setBaseUrl(url: string) {
  const clean = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(clean)) throw new Error('URL must start with http:// or https://');
  await AsyncStorage.setItem('buddy.apiUrl', clean);
  cachedBase = Promise.resolve(clean);
}

export const getToken = () => AsyncStorage.getItem('buddy.token');
export const setToken = (token: string | null) =>
  token ? AsyncStorage.setItem('buddy.token', token) : AsyncStorage.removeItem('buddy.token');

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  token?: string | null;
};

export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  if (IS_LOCAL_MODE) {
    const token = options.token !== undefined ? options.token : await getToken();
    return localApi(path, { ...options, token }) as Promise<T>;
  }
  const [base, token] = await Promise.all([getBaseUrl(), options.token !== undefined ? Promise.resolve(options.token) : getToken()]);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and server URL in Profile → Server settings.', 0);
  }
  const text = await response.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-json response */ }
  if (!response.ok) throw new ApiError(json.error || `Request failed (${response.status})`, response.status);
  return json as T;
}

export function websocketUrl(token: string): Promise<string> {
  return getBaseUrl().then((base) =>
    base.replace(/^http/, 'ws').replace(/\/api$/, '') + `/ws?token=${encodeURIComponent(token)}`
  );
}
