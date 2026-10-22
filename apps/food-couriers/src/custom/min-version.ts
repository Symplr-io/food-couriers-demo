// SYMPLRV3 SCAFFOLD — yours to edit. The generator NEVER overwrites this file.
//
// The minimum app version the operator will allow to run, fetched at launch.
// Return null when you have no answer — the gate then falls back to the
// build-time EXPO_PUBLIC_MIN_APP_VERSION, which can only stop builds older
// than the one it shipped in.
//
// Firebase Remote Config (already a dependency when notifications are on):
//
//   import remoteConfig from '@react-native-firebase/remote-config';
//   export async function checkMinVersion(): Promise<string | null> {
//     await remoteConfig().setDefaults({ min_app_version: '0.0.0' });
//     await remoteConfig().fetchAndActivate();
//     return remoteConfig().getValue('min_app_version').asString() || null;
//   }
//
// …or your own API:
//
//   export async function checkMinVersion(): Promise<string | null> {
//     const r = await fetch(env('API_BASE_URL') + '/app-config');
//     return (await r.json())?.minAppVersion ?? null;
//   }
//
// Throwing is safe: the gate treats an unreachable source as "no opinion" and
// does NOT block the user. It never fails closed on a network error.
export async function checkMinVersion(): Promise<string | null> {
  return null;
}
