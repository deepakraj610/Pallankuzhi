# Android app (standalone)

The Android app is the same React UI wrapped with [Capacitor](https://capacitorjs.com). It is
**offline and standalone**: there is no server and no login. The game engine and AI run on the
device (`src/engine/`, a TypeScript port of the Python engine, kept in step by a parity test),
and games and stats are saved in the app's local storage.

It is selected by the `standalone` Vite mode (`.env.standalone` sets `VITE_STANDALONE=true`).
The normal web build (`npm run build`) still talks to the FastAPI backend with accounts.

## Build the APK

Needs JDK 17 and the Android SDK (platform 36 and build-tools 35 are what the project is set up
for; `android/local.properties` points at the SDK).

```
npm install
npm run android:apk      # web build in standalone mode -> cap sync -> gradle assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`
(a copy lives at the repository root as `Pallankuzhi.apk`).

It is signed with the Android **debug** key, which is fine for installing on your own devices
(enable "install unknown apps" for whatever app opens the file). For Play Store distribution,
create a release keystore and build `assembleRelease` / a bundle instead.

## Launcher icon and splash

`python scripts/generate_android_icons.py` redraws the icons and splash screens into
`android/app/src/main/res/`.

## Keeping the engine in step with the backend

`src/engine/__fixtures__/parity.json` is generated from the Python engine. After changing the rules
in `backend/app/services/game_engine.py`, regenerate it from `backend/` and port the change:

```
python scripts/generate_engine_parity.py
```
