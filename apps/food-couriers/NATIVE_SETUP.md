# Native SDK setup

Most SDK requirements below are ALREADY applied to app.json (config plugins, permissions, Info.plist). Run `npx expo prebuild` to materialize native projects. Anything listed under "Manual steps" still needs your attention.

## Android permissions

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```
_Applied via app.json `android.permissions`._

## iOS Info.plist

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your location is used to centre the map and to confirm the place you pick.</string>
```
_Applied via app.json `ios.infoPlist`._

## Manual steps

### Google Maps

- No GOOGLE_MAPS_API_KEY is set on the default environment, so the map ships without a key: Android renders an empty grid and iOS falls back to Apple Maps. Add the key in the designer's Environments panel and regenerate, or set it by hand in app.json (ios.config.googleMapsApiKey + android.config.googleMaps.apiKey) and in android/app/src/main/AndroidManifest.xml (com.google.android.geo.API_KEY).

