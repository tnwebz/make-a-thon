import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skillforge.offline',
  appName: 'SkillForge Offline',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
