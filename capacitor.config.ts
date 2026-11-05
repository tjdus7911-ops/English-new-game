import type { CapacitorConfig } from '@capacitor/cli';

/** Android 앱 래퍼. 화면 방향은 런타임에 @capacitor/screen-orientation 으로 경로별 고정 (src/app/orientation.tsx) */
const config: CapacitorConfig = {
  appId: 'com.honjaenglish.mansion',
  appName: '수상한 저택의 상속자',
  webDir: 'dist',
  android: { backgroundColor: '#7FB35E' },
};

export default config;
