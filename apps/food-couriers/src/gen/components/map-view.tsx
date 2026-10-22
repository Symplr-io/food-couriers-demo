/**
 * Live map surface — GENERATED, do not edit.
 *
 * The design's own chrome (search bar, centre pin, address sheet) renders as
 * this component's children, over the tiles: the picture the designer drew is
 * replaced, everything drawn on top of it is not.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Text, View } from 'react-native';
import { env } from '../env';

/** Resolved once, at module scope: a missing native module must degrade, not
 * red-screen. See the generator's emit/map.ts for why this is a require. */
let RNMaps: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNMaps = require('react-native-maps');
} catch {
  RNMaps = null;
}
const MapViewNative = RNMaps?.default ?? null;
const MarkerNative = RNMaps?.Marker ?? null;
const PROVIDER_GOOGLE = RNMaps?.PROVIDER_GOOGLE ?? undefined;

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapMarker extends MapCoordinate {
  title?: string;
  description?: string;
}

export interface MapViewProps {
  /**
   * Starting centre. Absent ⇒ the device's position when it arrives, else a
   * world view — never a hardcoded city.
   *
   * `| null` because these are the props a saved location BINDS to, and every
   * field of a generated response schema is `.optional().nullable()` — so a
   * user who has saved nothing yet supplies `null`, not `undefined`. Typed
   * without it, the one screen this widget exists for did not compile.
   */
  latitude?: number | null;
  longitude?: number | null;
  /** 1 (world) … 20 (building). */
  zoom?: number | null;
  provider?: 'google' | 'default';
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  interactive?: boolean;
  markers?: MapMarker[];
  /** Where the design's pin sits relative to the middle of the map, as
   * fractions of its box. The pin is what the user aims, so every coordinate
   * this widget reads or reports is the one UNDER IT. */
  centerOffset?: { x: number; y: number };
  /** Fires with the coordinate under the centre after every settled gesture —
   * the centre is what the design's pin marks. */
  onCenterChange?: (c: MapCoordinate) => void;
  /** Whatever is typed in the design's own search field. The map geocodes it
   * and re-centres, so the two widgets need no wiring between them. */
  searchQuery?: string;
  /** The address the design printed under the map — where it opens when no
   * coordinate has been saved yet. */
  initialAddress?: string;

  /**
   * The street address under the pin, after every settled move — so the
   * design's own address line reads out the place currently selected rather
   * than the one last saved.
   */
  onAddressChange?: (address: string) => void;
  geocode?: boolean;
  style?: any;
  testID?: string;
  children?: React.ReactNode;
}

/** Zoom level → the latitude span react-native-maps wants. 360 / 2^zoom is the
 * Web-Mercator identity every tile server uses, so a zoom that reads one way
 * in the designer reads the same way on the device. */
function deltaFor(zoom: number): number {
  const z = Math.min(20, Math.max(1, zoom));
  return 360 / Math.pow(2, z);
}

const WORLD: MapCoordinate = { latitude: 0, longitude: 0 };

/**
 * Did this build get a Google Maps key into the NATIVE config?
 *
 * Stamped at generate time, because it is a build fact and nothing at runtime
 * can see it: the key that matters to react-native-maps lives in
 * AndroidManifest.xml, not in the JS bundle. Reading the JS env var instead
 * conflated two different keys and suppressed a perfectly good map.
 *
 * It matters because a keyless Android build does not degrade — the native
 * view throws `IllegalStateException: API key not found` from inside the
 * mount and takes the app down. False here means take the placeholder rung.
 */
const HAS_NATIVE_KEY = false;

/**
 * The Geocoding API, both directions, on the key the app already carries.
 *
 * Not gated on anything: a map with no address line still has a search box,
 * and the two directions are the same endpoint. Every failure is SILENT by
 * design — a half-typed query has no result yet, and an address is decoration
 * over a map that is already showing the right place, so an error at either
 * would interrupt someone who has done nothing wrong. An empty answer simply
 * leaves the map and the address line as they were.
 *
 * NOTE: the Geocoding API is billed and must be enabled on the same Cloud
 * project as the map key. A key that renders tiles can still return
 * REQUEST_DENIED here, which is exactly why neither caller treats silence as
 * an error.
 */
/**
 * STATIC member access, plus env() for the rncli target.
 *
 * `env()` bottoms out in `process.env['EXPO_PUBLIC_' + k]`, and
 * babel-preset-expo cannot inline a COMPUTED access — so on a release Expo
 * build it resolves to '' while the identical value works elsewhere. The
 * emitted API client already reads credentials this way for the same reason.
 * Device-verified: with only env() the geocoder silently had no key.
 */
const MAPS_KEY = env('GOOGLE_MAPS_API_KEY') || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

async function geocodeApi(query: string): Promise<any> {
  if (!MAPS_KEY) return null;
  try {
    const res = await fetch(
      'https://maps.googleapis.com/maps/api/geocode/json?' +
        query +
        '&key=' +
        encodeURIComponent(MAPS_KEY),
    );
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Text → a coordinate, for the design's search box.
 *
 * NOT called `geocode`: the component takes a `geocode` BOOLEAN prop (the
 * address-line switch), and destructuring it shadows a module function of the
 * same name — so the call inside the effect resolved to a boolean and the
 * search silently never ran on exactly the apps that had geocoding on. Caught
 * by typechecking a generated app; the generator's own typecheck cannot see
 * inside an emitted template.
 */
async function lookUpPlace(text: string): Promise<MapCoordinate | null> {
  const body = await geocodeApi('address=' + encodeURIComponent(text));
  const loc = body?.results?.[0]?.geometry?.location;
  return typeof loc?.lat === 'number' && typeof loc?.lng === 'number'
    ? { latitude: loc.lat, longitude: loc.lng }
    : null;
}

/**
 * Which of Google's results a person should be shown.
 *
 * NOT results[0]. Google orders by specificity, and where it has no mapped
 * street address for a point it leads with a PLUS CODE — so the line under the
 * map read "RMJF+H8X, Go Vap, Ho Chi Minh" instead of a street. Precise, and
 * useless to read. Skip plus codes, prefer the kinds that name a place a
 * person recognises, and fall back to the first of anything rather than
 * nothing: a plus code still beats an empty line.
 *
 * Mirrored by the studio's render/geocodePick, which this cannot import — it
 * is app code, not studio code. Change both.
 */
const ADDRESS_KINDS = ['street_address', 'premise', 'subpremise', 'route', 'establishment'];

/**
 * A LEADING plus code, which the types filter alone does not catch: Google
 * types "CFRJ+WV3, Freedom Wy, Lekki" as a ROUTE and simply begins the
 * formatted address with the code, because the point has no street number.
 * The alphabet is Open Location Code's own (no vowels), which is what keeps a
 * real address containing a plus from matching.
 */
const LEADING_PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3},?\s*/;

function stripPlusCode(address: string): string {
  const without = address.replace(LEADING_PLUS_CODE, '').trim();
  // a code with nothing after it is still a place, and beats an empty line
  return without === '' ? address : without;
}

function pickAddress(results: any[]): string {
  const usable = (results ?? []).filter((r: any) => typeof r?.formatted_address === 'string');
  const named = usable.filter(
    (r: any) =>
      !(r.types ?? []).includes('plus_code') && !LEADING_PLUS_CODE.test(r.formatted_address),
  );
  for (const want of ADDRESS_KINDS) {
    const hit = named.find((r: any) => (r.types ?? []).includes(want));
    if (hit) return hit.formatted_address;
  }
  return stripPlusCode((named[0] ?? usable[0])?.formatted_address ?? '');
}

/** A coordinate → the street address under it, for the design's address line. */
async function reverseGeocode(c: MapCoordinate): Promise<string> {
  const body = await geocodeApi('latlng=' + c.latitude + ',' + c.longitude);
  return pickAddress(body?.results);
}

export function MapView(props: MapViewProps) {
  const {
    latitude,
    longitude,
    zoom: zoomProp,
    provider = 'google',
    mapType = 'standard',
    showsUserLocation = false,
    followsUserLocation = false,
    interactive = true,
    markers,
    centerOffset,
    initialAddress,
    onCenterChange,
    searchQuery,
    onAddressChange,
    geocode = false,
    style,
    testID,
    children,
  } = props;

  const zoom = typeof zoomProp === 'number' ? zoomProp : 15;
  const hasStart = typeof latitude === 'number' && typeof longitude === 'number';
  const start: MapCoordinate = hasStart
    ? { latitude: latitude as number, longitude: longitude as number }
    : WORLD;
  const delta = deltaFor(hasStart ? zoom : 2);

  /**
   * Camera centre ⇄ the point under the pin.
   *
   * A pin picker moves the map under a marker that never moves, so the place
   * the user is choosing is beneath the PIN — and a design that lays a sheet
   * across the bottom aims its pin well above the middle of the map. Every
   * read and every move goes through these two, so the coordinate shown and
   * the coordinate stored can never be different points.
   *
   * y is subtracted going out because screen-y grows downward while latitude
   * grows upward; the deltas are the region's own, so the conversion is exact
   * at whatever zoom the map is at.
   */
  const ox = centerOffset?.x ?? 0;
  const oy = centerOffset?.y ?? 0;
  /** camera centre → the coordinate the pin is over */
  const underPin = useCallback(
    (c: MapCoordinate, d: number): MapCoordinate =>
      ox === 0 && oy === 0 ? c : { latitude: c.latitude - oy * d, longitude: c.longitude + ox * d },
    [ox, oy],
  );
  /** a place the pin should end up over → where to put the camera */
  const cameraFor = useCallback(
    (c: MapCoordinate, d: number): MapCoordinate =>
      ox === 0 && oy === 0 ? c : { latitude: c.latitude + oy * d, longitude: c.longitude - ox * d },
    [ox, oy],
  );

  /** No Maps key on Android means the native view cannot mount at all —
   * see the note beside the placeholder below. Declared here because the
   * camera mover consults it. */
  const keyless = Platform.OS === 'android' && !HAS_NATIVE_KEY;

  const mapRef = useRef<any>(null);
  const centreRef = useRef<MapCoordinate>(start);
  const [granted, setGranted] = useState(Platform.OS !== 'android');
  /** Bumped when a gesture settles: the address effect watches THIS rather
   * than the centre ref, because a ref changing is not a render. */
  const [tick, bump] = useState(0);
  /** The device position has only ever to RECENTRE once. Without this latch a
   * follow-me map fights the user: every position update yanks the camera back
   * from wherever they just panned to. */
  const followedRef = useRef(false);

  // Android asks at runtime; iOS is granted by the Info.plist string alone.
  useEffect(() => {
    let alive = true;
    if (Platform.OS !== 'android' || !(showsUserLocation || followsUserLocation)) return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
      .then((r) => {
        if (alive) setGranted(r === PermissionsAndroid.RESULTS.GRANTED);
      })
      .catch(() => {
        if (alive) setGranted(false);
      });
    return () => {
      alive = false;
    };
  }, [showsUserLocation, followsUserLocation]);

  const report = useCallback(
    (c: MapCoordinate) => {
      centreRef.current = c;
      onCenterChange?.(c);
    },
    [onCenterChange],
  );

  /**
   * Move the camera, from anywhere: a search hit, a saved location arriving
   * from an API, or the device's first fix. ONE mover, because they are the
   * same act and the reasons they must not fight each other are subtle.
   */
  const goTo = useCallback(
    (c: MapCoordinate, z?: number) => {
      const d = deltaFor(z ?? zoom);
      // `c` is where the PIN should end up, so the camera goes elsewhere
      const cam = cameraFor(c, d);
      mapRef.current?.animateToRegion(
        { latitude: cam.latitude, longitude: cam.longitude, latitudeDelta: d, longitudeDelta: d },
        400,
      );
      // the plate has no camera to animate; report the move so downstream
      // behaves identically with and without the native module
      if (!MapViewNative || keyless) report(c);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [zoom, report, cameraFor],
  );

  // The address trails the centre by a beat on purpose: geocoding every frame
  // of a pan would burn the quota and paint an address for a place the user is
  // already past.
  useEffect(() => {
    if (!geocode || !onAddressChange) return;
    let alive = true;
    const t = setTimeout(() => {
      void reverseGeocode(centreRef.current).then((a) => {
        if (alive && a) onAddressChange(a);
      });
    }, 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // centreRef is a ref, so the settle callback below drives this through
    // its own state bump rather than through the ref itself.
  }, [geocode, onAddressChange, tick]);

  /**
   * Open where the DESIGN said, until the user has somewhere of their own.
   *
   * Runs only with no bound coordinate: a saved location outranks the design's
   * sample, and once this has moved the camera the follow-me latch leaves it
   * alone. One geocode, on first mount.
   */
  useEffect(() => {
    if (hasStart || !initialAddress) return;
    let alive = true;
    void lookUpPlace(initialAddress).then((c) => {
      if (alive && c && !followedRef.current) {
        followedRef.current = true;
        goTo(c);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddress, hasStart]);

  // Report the starting point once, so a screen that saves "the location" has
  // one before the user touches anything.
  useEffect(() => {
    onCenterChange?.(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A coordinate that arrives LATE still has to move the map.
   *
   * react-native-maps reads `initialRegion` exactly once, at mount. The saved
   * location this screen is for arrives from an API a moment after that, so
   * binding it to the props alone put the right number in the tree and left
   * the camera over the ocean — the whole "come back and see your place"
   * feature, silently doing nothing.
   *
   * The epsilon is what stops it fighting the user: every settled gesture
   * publishes the new centre, which can come straight back in as a prop, and
   * without a tolerance that round trip re-animates forever. ~1e-6 degrees is
   * about 10cm — far below anything a person can pan to on purpose.
   */
  useEffect(() => {
    // typeof, not an undefined check: a coordinate that has never been saved
    // arrives from its binding as null, and null is not a place to move to
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    const cur = centreRef.current;
    if (Math.abs(cur.latitude - latitude) < 1e-6 && Math.abs(cur.longitude - longitude) < 1e-6)
      return;
    goTo({ latitude, longitude });
  }, [latitude, longitude, goTo]);

  /**
   * The design's own search box, made to work.
   *
   * Typed text is geocoded and the map moves — a debounce, because this fires
   * on every keystroke and the geocoder is billed per call. Failure is silent
   * for the same reason the address lookup's is: a half-typed query has no
   * result yet, and a map that flashed an error at every letter would be
   * unusable.
   */
  useEffect(() => {
    const q = (searchQuery ?? '').trim();
    if (q.length < 3) return;
    let alive = true;
    const t = setTimeout(() => {
      void lookUpPlace(q).then((c) => {
        if (alive && c) goTo(c);
      });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [searchQuery, goTo]);

  const region = useMemo(
    () => ({
      latitude: start.latitude,
      longitude: start.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    }),
    [start.latitude, start.longitude, delta],
  );

  /**
   * NO KEY ON ANDROID IS A CRASH, not a grey grid.
   *
   * react-native-maps has no non-Google provider on Android, so a MapView
   * mounted without `com.google.android.geo.API_KEY` throws
   * `IllegalStateException: API key not found` from inside the mount — which
   * Fabric turns into "addViewAt: failed to insert view" and the app dies on
   * that screen. Device-verified; this comment used to claim it degraded to an
   * empty grid, and it does not.
   *
   * So an unkeyed build takes the placeholder rung deliberately. The screen
   * still renders, the design's chrome still shows over it, and the starting
   * coordinate is still published — the app is walkable and says what is
   * missing, instead of closing.
   */

  if (!MapViewNative || keyless) {
    // Tier 2 — no native module (Expo Go without a dev build, or the web
    // target), or no Maps key to mount one with. The design's chrome still
    // renders over the plate, and the starting coordinate was already
    // reported, so the screen still works.
    return (
      <View testID={testID} style={[{ backgroundColor: '#e8ebe6', overflow: 'hidden' }, style]}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 26 }}>🗺</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
            {keyless
              ? 'No Google Maps key — set GOOGLE_MAPS_API_KEY and rebuild'
              : 'Map preview — install a dev build to see live tiles'}
          </Text>
        </View>
        {children}
      </View>
    );
  }

  return (
    <View testID={testID} style={[{ overflow: 'hidden' }, style]}>
      <MapViewNative
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        // Google on Android, which has no other provider; the platform's own on
        // iOS, where asking for Google costs the whole build (see app.json) and
        // buys nothing this screen uses.
        provider={provider === 'google' && Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={mapType}
        initialRegion={region}
        showsUserLocation={showsUserLocation && granted}
        showsMyLocationButton={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        onRegionChangeComplete={(r: any) => {
          report(underPin({ latitude: r.latitude, longitude: r.longitude }, r.latitudeDelta));
          bump((n) => n + 1);
        }}
        onPress={(e: any) => {
          // Tapping a spot PICKS it: the map moves so the design's pin lands
          // on what was tapped. goTo takes the place the pin should end up
          // over, so the centre offset is already accounted for.
          const c = e?.nativeEvent?.coordinate;
          if (c && interactive) goTo({ latitude: c.latitude, longitude: c.longitude });
        }}
        onUserLocationChange={(e: any) => {
          const c = e?.nativeEvent?.coordinate;
          if (!c || followedRef.current) return;
          // An explicit starting point WINS over the device: it is the place
          // the user saved last time, and jumping off it is the bug this
          // whole latch exists to prevent.
          if (hasStart || !followsUserLocation) {
            followedRef.current = true;
            return;
          }
          followedRef.current = true;
          goTo({ latitude: c.latitude, longitude: c.longitude });
        }}
      >
        {(markers ?? []).map((m, i) =>
          MarkerNative ? (
            <MarkerNative
              key={String(i)}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.title}
              description={m.description}
            />
          ) : null,
        )}
      </MapViewNative>
      {children}
    </View>
  );
}
