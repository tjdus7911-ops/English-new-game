import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 정적 호스팅(GitHub Pages 등) 어디에나 올릴 수 있도록 상대 경로 base
export default defineConfig({ base: './', plugins: [react()] });
