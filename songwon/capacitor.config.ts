import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.songwon.korean',
  appName: 'Songwon Korean',
  webDir: 'out',
  server: {
    url: 'https://song-based-language-learning.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#FAF7F2',
  },
};

export default config;
