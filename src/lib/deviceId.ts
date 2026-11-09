/** A resettable browser installation ID. Never a hardware Device ID. */
export function browserDeviceId(): string | null {
  try {
    const key = "dostup_device_id";
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return null;
  }
}
