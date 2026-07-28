import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ordina.app',
  appName: 'ordina-app',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'ordina-production-71fa.up.railway.app',
      '*.up.railway.app',
      '*.railway.app',
      '*.run.app'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"]
    }
  }
};

export default config;
