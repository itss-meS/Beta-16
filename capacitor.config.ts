import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beta16.finance',
  appName: 'Beta-16',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
