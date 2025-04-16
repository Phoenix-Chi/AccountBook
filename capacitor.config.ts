import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chi.account_book',
  appName: 'account_book_chi',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
