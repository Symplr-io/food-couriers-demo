// SYMPLRV3 SCAFFOLD — yours to edit. The generator NEVER overwrites this file.
//
// Every crash path in the app calls this: render errors caught by the
// ErrorBoundary, uncaught JS errors, and unhandled promise rejections.
// It is a no-op until you wire an SDK, which is a deliberate choice — the DSN
// is yours and the SDK adds a native dependency.
//
// Sentry:
//
//   import * as Sentry from '@sentry/react-native';
//   Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN });
//   export function reportCrash(error: Error, context?: CrashContext): void {
//     Sentry.captureException(error, { extra: context });
//   }
//
// Firebase Crashlytics:
//
//   import crashlytics from '@react-native-firebase/crashlytics';
//   export function reportCrash(error: Error, context?: CrashContext): void {
//     if (context?.componentStack) crashlytics().log(context.componentStack);
//     crashlytics().recordError(error);
//   }
//
// Do NOT log the error to a server you also authenticate against without
// scrubbing first — a stack trace can carry tokens and form values.
export interface CrashContext {
  /** React component stack, when the error came from a render. */
  componentStack?: string;
  /** 'render' | 'uncaught' | 'unhandledRejection' — where it was caught. */
  source?: string;
  /** true when the JS engine is about to tear the app down. */
  fatal?: boolean;
}

export function reportCrash(_error: Error, _context?: CrashContext): void {
  // no-op until an SDK is wired above
}
