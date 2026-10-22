const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// withNativeWind compiles global.css and teaches Metro the .css extension.
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
