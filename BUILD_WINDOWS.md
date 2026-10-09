# Build Windows Installer + Portable

This release kit contains the latest validated `src` folder, package manifests, Vite configuration, desktop icon and updated README.

1. Extract this ZIP to a new folder on your Windows computer.
2. Open the folder (the one containing `package.json`) in VS Code.
3. In the terminal, run `npm ci` (or `npm install` if your lockfile cannot be resolved).
4. Run `npm run electron:build`.
5. Find the **Setup** and **Portable** `.exe` files in `dist_electron/`.
6. Test both executables before publishing. Verify wallet loading, P&L, token hiding/re-adding, charts, farms, HEX DCA, and cache persistence.

**Important:** This kit has NOT been built or run on Windows in this environment. The source comes from the last web-tested v2.4.3.10 patch, and desktop-specific regression testing is still required. Do not publish the executables without testing.

## GitHub

Replace your repository's top-level `README.md` with the one included here. On GitHub, also set the repository's **About → Website** field to `https://pulsechain-dashboard.com/`. Commit the changes before creating a new GitHub Release.
