import type { CapacitorConfig } from '@capacitor/cli';

// Standalone app: the web build in dist/ is bundled into the APK and games run on the device.
const config: CapacitorConfig = {
  appId: 'com.pallankuzhi.app',
  appName: 'Pallankuzhi',
  webDir: 'dist',
  backgroundColor: '#faf5ff',
};

export default config;
