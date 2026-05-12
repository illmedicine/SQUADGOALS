import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.squadren.app',
  appName: 'Squad REN',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false
  },
  plugins: {
    Geolocation: {
      // Permission strings live in AndroidManifest.xml after `cap add android`.
    }
  }
};

export default config;
