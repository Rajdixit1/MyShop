import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor wraps the built web app into native Android (APK/AAB) and
 * iOS (IPA) projects. Requires Android Studio / Xcode to produce binaries.
 */
const config: CapacitorConfig = {
  appId: 'com.rashandukaan.app',
  appName: 'Devanand Saw Kirana Store',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'always',
  },
  server: {
    // Point the native app at your machine while developing.
    // androidScheme: 'http',
    // url: 'http://192.168.1.X:5173',
    cleartext: true,
  },
}

export default config