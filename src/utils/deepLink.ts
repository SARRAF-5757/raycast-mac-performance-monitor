import { open } from "@raycast/api";

export async function openApp(): Promise<void> {
  try {
    await open("macperfmonitor://open");
  } catch {
    await open("/Applications/Mac Performance Monitor.app");
  }
}
