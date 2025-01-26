import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        typescript: false,
        ref: false,
        memo: false,
        titleProp: true,
      },
    }),
    electron({
      entry: 'src/main.js'
    })
  ]
})