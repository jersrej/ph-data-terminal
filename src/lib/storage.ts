/**
 * localStorage that cannot throw. Private browsing, blocked site data and
 * storage quotas all make the real API fail; preferences then simply do not persist.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
