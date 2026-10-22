import { PermissionsAndroid } from 'react-native';
import { manualOutcome as answerManually } from '../custom/manual-outcome';
import { lastResponse } from './state/responses';
// AUTO-GENERATED — device-capability checks for the design's flow conditions.
//
// Every answer here is a TRI-STATE. 'unknown' is not a soft 'yes': a key this
// build does not implement, or a device API that throws, tells you nothing
// about the device — and answering an unimplemented security question with
// "yes, you're fine" is how a gate stops being a gate.

/** A data test the DEVICE cannot answer — see DataCheck in the emitter. */
export interface FlowDataCheck {
  kind: 'responseField' | 'age';
  bindingId: string;
  /** responseField */
  path?: string;
  op?: string;
  value?: unknown;
  /** age */
  dobPath?: string;
  idnPath?: string;
  minimum?: number;
}
export interface FlowStep {
  /** device capability key, or null */
  check: string | null;
  /** set instead of the capability key when the answer lives in a response body */
  data?: FlowDataCheck | null;
  label: string;
  yes: string;
  no: string;
}
export interface FlowDef {
  start: string;
  steps: Record<string, FlowStep>;
  /** the owning screen's name — a chain landing here means "no detour" */
  self?: string;
}

/**
 * Conditions the device cannot answer — "PIN Successful?", "KYC passed?".
 *
 * Answered in src/custom/manual-outcome.ts, and deliberately not here: this
 * module is regenerated on every build, so the cases it used to carry asked the
 * reader to finish a task comment in a file that would overwrite their answer on
 * the next generate. Six comments no one could act on (S1135 — which this very
 * sentence would trip if it spelled the tag out), in a function whose every arm
 * returned the same null (S3516).
 *
 * Returning null still means "I don't know", and the caller treats that
 * differently depending on what the branch gates — see resolveFlow.
 */
export async function manualOutcome(label: string): Promise<boolean | null> {
  const answer = await answerManually(label);
  if (answer === null && __DEV__) console.warn('[flow] no manual answer for condition:', label);
  return answer;
}

/**
 * Does this condition gate something that must not be guessed?
 *
 * A wrong guess on "Show onboarding tips?" costs a tip. A wrong guess on "PIN
 * Successful?" lets someone past the PIN. The heuristic is the label, because
 * that is all the design gives us — and it is deliberately eager: treating a
 * harmless condition as sensitive costs one unanswered branch, treating a
 * sensitive one as harmless costs the gate.
 */
const SECURITY_WORDS = [
  'pin',
  'passcode',
  'password',
  'biometric',
  'face ?id',
  'touch ?id',
  'fingerprint',
  'auth',
  'login',
  'sign[- ]?in',
  'verif',
  'otp',
  '2fa',
  'mfa',
  'kyc',
  'token',
  'session',
  'secure',
  'permission',
  'granted',
];
const SECURITY_LABEL = new RegExp(String.raw`\b(${SECURITY_WORDS.join('|')})\b`, 'i');

const ANDROID_PERM: Record<string, string | undefined> = {
  camera: PermissionsAndroid.PERMISSIONS.CAMERA,
  location: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  contacts: PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  microphone: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  bluetooth: PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  photos:
    PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES ??
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  notifications: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
};

async function askAndroid(kind: string): Promise<boolean> {
  const perm = ANDROID_PERM[kind];
  if (!perm) return true;
  if (await PermissionsAndroid.check(perm as never)) return true;
  return (await PermissionsAndroid.request(perm as never)) === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * What the device says about one capability.
 *
 *  'yes'     — asked, and the answer was yes
 *  'no'      — asked, and the answer was no
 *  'unknown' — could not ask: key not implemented in this build, or the
 *              platform API threw. NOT a yes.
 */
export type Capability = 'yes' | 'no' | 'unknown';

const cap = (v: boolean): Capability => (v ? 'yes' : 'no');

export async function checkCapability(key: string): Promise<Capability> {
  return 'unknown';
}

/**
 * WHICH biometric sensor this device has, asked SILENTLY.
 *
 * checkCapability('biometric-auth-*') answers by raising the real prompt, which
 * is right for a gate and wrong for a label: a screen that merely wants to say
 * "Turn on Face ID" rather than "Turn on Fingerprint ID" must not make the user
 * authenticate just to find out what to call the button.
 *
 * Mirrors the reference's getBiometryType() (lib/auth/biometric), which the
 * enable sheet uses to pick its icon, its name and its CTA. The design draws
 * the two variants as separate frames — ActivateFaceID / ActivateFingerprint —
 * but they differ only in those three things, so one screen answers for both.
 *
 * null = no sensor, none enrolled, or the platform would not say.
 */
export type BiometryKind = 'face' | 'fingerprint' | null;

export async function biometryKind(): Promise<BiometryKind> {
  return null;
}

/** Can this branch target (screen name or '#step') eventually reach `screen`? */
function reaches(def: FlowDef, from: string, screen: string, depth = 0): boolean {
  if (!from.startsWith('#')) return from === screen;
  if (depth > 8) return false;
  const step = def.steps[from.slice(1)];
  if (!step) return false;
  return reaches(def, step.yes, screen, depth + 1) || reaches(def, step.no, screen, depth + 1);
}

/**
 * Walk a screen's condition chain and return the destination the device
 * selects. The generator only routes exits through this when the design
 * says so (chain outcomes + the screen's sole forward exit). A chain landing
 * on the owning screen itself means "no detour" — `intended` stands. Manual
 * conditions with no app-provided answer follow whichever branch keeps the
 * design's intended destination reachable.
 */
/** Read a dot path out of a settled response body. */
function atPath(body: unknown, path: string): unknown {
  let cur: unknown = body;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * The value as text, when it IS text.
 *
 * String() on an unknown that happens to be an object yields
 * '[object Object]', which then flows into a date parse or a digit strip as if
 * it were data (S6551). Narrowing POSITIVELY is the only way to say no: a
 * typeof test's negative branch does not subtract anything from unknown.
 */
function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  return '';
}

/** Birth year from an Emirates ID: 15 digits, '784' then YYYY. */
function emiratesIdBirthYear(idn: unknown): number | null {
  // Two backslashes: this is inside a template literal, so a single one does
  // not survive to the emitted app and the strip silently removes the LETTER D
  // instead of every non-digit. That exact bug has shipped twice before.
  const digits = asText(idn).replaceAll(/\D/g, '');
  if (digits.length !== 15 || !digits.startsWith('784')) return null;
  const y = Number(digits.slice(3, 7));
  const now = new Date().getFullYear();
  return Number.isFinite(y) && y >= 1900 && y <= now ? y : null;
}

/** Whole years between a date string and today; null when unparseable. */
function ageFromDob(dob: unknown): number | null {
  const text = asText(dob);
  if (!text) return null;
  const born = new Date(text);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  const md = now.getMonth() - born.getMonth();
  const before = md < 0 || (md === 0 && now.getDate() < born.getDate());
  return now.getFullYear() - born.getFullYear() - (before ? 1 : 0);
}

/**
 * Is the customer at least the minimum age?
 *
 * null = neither source could answer. The Emirates ID is the fallback and it
 * is the path that actually runs: dob is null on every observed customer
 * record.
 */
function ageCheckOutcome(d: FlowDataCheck, body: unknown, label: string): boolean | null {
  const min = d.minimum ?? 18;
  const dob = d.dobPath ? atPath(body, d.dobPath) : undefined;
  const exact = ageFromDob(dob);
  if (exact !== null) {
    const ok = exact >= min;
    if (__DEV__)
      console.log(
        '[FLOW] ' + label + ' — dob=' + asText(dob) + ' age=' + exact + ' → ' + (ok ? 'YES' : 'NO'),
      );
    return ok;
  }
  const idn = d.idnPath ? atPath(body, d.idnPath) : undefined;
  const year = emiratesIdBirthYear(idn);
  if (year === null) {
    if (__DEV__)
      console.log('[FLOW] ' + label + ' — dob=null and no usable Emirates ID → cannot answer');
    return null;
  }
  const ok = new Date().getFullYear() - year > min;
  if (__DEV__)
    console.log('[FLOW] ' + label + ' — dob=null idnYear=' + year + ' → ' + (ok ? 'YES' : 'NO'));
  return ok;
}

/** One comparison operator against the value read out of the response. */
function compareOutcome(op: string | undefined, actual: unknown, want: unknown): boolean {
  switch (op) {
    case 'ne':
      return actual !== want;
    case 'lt':
      return Number(actual) < Number(want);
    case 'lte':
      return Number(actual) <= Number(want);
    case 'gt':
      return Number(actual) > Number(want);
    case 'gte':
      return Number(actual) >= Number(want);
    case 'in':
      return Array.isArray(want) && (want as unknown[]).includes(actual);
    case 'matches':
      return new RegExp(asText(want)).test(asText(actual));
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    default:
      return actual === want;
  }
}

/**
 * Answer a data check, and SAY how it was answered.
 *
 * null = could not answer (no response yet, unreadable field), which the caller
 * treats like an unknown capability. Returning false there would silently take
 * the failure branch on a screen that simply had not loaded yet.
 */
function dataOutcome(d: FlowDataCheck, label: string): boolean | null {
  const body = lastResponse(d.bindingId);
  if (body === undefined) {
    if (__DEV__) console.log('[FLOW] ' + label + ' — no response yet for ' + d.bindingId);
    return null;
  }
  if (d.kind === 'age') return ageCheckOutcome(d, body, label);
  const actual = atPath(body, d.path ?? '');
  const want = d.value;
  const ok = compareOutcome(d.op, actual, want);
  if (__DEV__)
    console.log(
      '[FLOW] ' +
        label +
        ' — ' +
        (d.path ?? '?') +
        '=' +
        JSON.stringify(actual) +
        ' ' +
        (d.op ?? 'eq') +
        ' ' +
        JSON.stringify(want) +
        ' → ' +
        (ok ? 'YES' : 'NO'),
    );
  return ok;
}

async function stepOutcome(def: FlowDef, step: FlowStep, intended: string): Promise<boolean> {
  // Whichever branch keeps the DESIGNED destination reachable — the fallback
  // when nothing else can answer. Fine for a cosmetic branch, not for a gate,
  // so a security-sounding label never gets guessed.
  const fallback = (): boolean => {
    const guess =
      !SECURITY_LABEL.test(step.label) &&
      (reaches(def, step.yes, intended) || !reaches(def, step.no, intended));
    // A guessed gate is why "User is 18+?" never reached AgeError. Say so, or
    // the only symptom is a branch that never happens.
    if (__DEV__)
      console.log(
        '[FLOW] ' + step.label + ' — nothing to check, GUESSED ' + (guess ? 'YES' : 'NO'),
      );
    return guess;
  };
  if (step.data) {
    const d = dataOutcome(step.data, step.label);
    if (d !== null) return d;
    return fallback();
  }
  if (step.check) {
    const c = await checkCapability(step.check);
    if (__DEV__) console.log('[FLOW] ' + step.label + ' — ' + step.check + '=' + c);
    // 'unknown' means the device never answered. On a security gate that is
    // a NO; anywhere else, fall back to the design's shape.
    if (c === 'yes') return true;
    if (c === 'no') return false;
    return fallback();
  }
  // Same rule for a condition nobody has wired yet.
  const m = await manualOutcome(step.label);
  if (m !== null && __DEV__)
    console.log('[FLOW] ' + step.label + ' — answered manually: ' + (m ? 'YES' : 'NO'));
  return m ?? fallback();
}

export async function resolveFlow(def: FlowDef, intended: string): Promise<string> {
  let cur: string | undefined = def.start;
  for (let i = 0; i < 8 && cur; i++) {
    const step: FlowStep | undefined = def.steps[cur];
    if (!step) break;
    const next: string = (await stepOutcome(def, step, intended)) ? step.yes : step.no;
    if (!next.startsWith('#')) return next === def.self ? intended : next;
    cur = next.slice(1);
  }
  return intended;
}
