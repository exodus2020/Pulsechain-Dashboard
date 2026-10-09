
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react({
      exclude: /vendor[\\/]web3[\\/]/,
    }),
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
  ],
  server: {
    proxy: {
      '/__pcdw/pulsecoinlist/stats': {
        target: 'https://pulsecoinlist.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/stats',
        headers: {
          Referer: 'https://pulsecoinlist.com/',
          Origin: 'https://pulsecoinlist.com'
        }
      }
    }
  }
})
