import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.realtravo.app',
  appName: 'Real Travo',
  webDir: 'dist',
  plugins: {
    Browser: {
      // Use in-app browser for OAuth and payment flows
    }
  }
};

export default config;