import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chi.account_book',
  appName: '鹏记',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
