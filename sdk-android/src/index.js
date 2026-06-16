import { NativeModules, NativeEventEmitter, Platform, TurboModuleRegistry } from 'react-native';

// Prefer TurboModuleRegistry (New Architecture) with fallback to legacy NativeModules bridge
const NativeFastPush =
  (TurboModuleRegistry && TurboModuleRegistry.get('FastPush')) ||
  NativeModules.FastPush ||
  null;

function assertNativeModule() {
  if (!NativeFastPush) {
    throw new Error(
      'react-native-fastpush: Native module not found. ' +
      'Run "npx react-native run-android" and ensure the package is linked. ' +
      'On React Native 0.76+ with New Architecture, enable the Bridge Interop Layer.'
    );
  }
}

const emitter = NativeFastPush ? new NativeEventEmitter(NativeFastPush) : null;

let _config = null;
let _cachedDeviceId = null;
let _cachedNativeAppVersion = null;

const FastPush = {
  /**
   * Configure FastPush SDK.
   * Call this once in your App entry (e.g., App.js or index.js).
   *
   * @param {Object} options
   * @param {string} options.serverUrl       - FastPush server URL (e.g., "https://fastpush.example.com")
   * @param {string} options.deploymentKey   - App deployment key from dashboard
   * @param {string} [options.appVersion]    - Native app version (default: auto-detected from the installed package)
   * @param {string} [options.deviceId]      - Unique device ID (default: stable ANDROID_ID-based device identifier)
   */
  configure(options) {
    if (!options.serverUrl) throw new Error('serverUrl is required');
    if (!options.deploymentKey) throw new Error('deploymentKey is required');
    _config = options;
  },

  /**
   * Check if a new update is available.
   * Returns update info object or null.
   *
   * @param {string} [deviceId] - Override the device ID for this check.
   *                              If omitted, falls back to configure({ deviceId })
   *                              or the auto-detected device identifier.
   */
  async checkForUpdate(deviceId) {
    assertConfigured();
    assertNativeModule();
    const appVersion = _config.appVersion || (await getNativeAppVersion());
    const resolvedDeviceId = deviceId || _config.deviceId || (await getOrCreateDeviceId());
    const update = await NativeFastPush.checkForUpdate(appVersion, resolvedDeviceId);
    return update;
  },

  /**
   * Download and apply an update.
   * For JS bundle: applies immediately, call reloadApp() to take effect.
   * For APK: launches the system installer.
   *
   * @param {Object} update - The update object from checkForUpdate()
   * @param {Function} [onProgress] - Progress callback (0-100)
   * @param {string} [deviceId] - Override the device ID for this download.
   */
  async downloadAndApply(update, onProgress, deviceId) {
    assertConfigured();
    assertNativeModule();
    const resolvedDeviceId = deviceId || _config.deviceId || (await getOrCreateDeviceId());

    let progressListener;
    if (onProgress && emitter) {
      progressListener = emitter.addListener('FastPushDownloadProgress', onProgress);
    }

    try {
      const updateWithDevice = { ...update, deviceId: resolvedDeviceId };
      const result = await NativeFastPush.downloadAndApply(JSON.stringify(updateWithDevice));
      return result;
    } finally {
      progressListener?.remove();
    }
  },

  /**
   * Sync: check for update and apply automatically.
   * The most common way to use FastPush.
   *
   * @param {Object} [options]
   * @param {Function} [options.onProgress]          - Download progress callback
   * @param {Function} [options.onUpdateAvailable]   - Called with update info before download
   * @param {boolean}  [options.reloadOnSuccess]     - Reload app after bundle applied (default: true)
   * @param {string}   [options.deviceId]            - Override the device ID for this sync
   */
  async sync(options = {}) {
    assertConfigured();
    assertNativeModule();
    const { onProgress, onUpdateAvailable, reloadOnSuccess = true, deviceId } = options;

    const update = await FastPush.checkForUpdate(deviceId);
    if (!update) return { status: 'up_to_date' };

    if (onUpdateAvailable) onUpdateAvailable(update);

    const result = await FastPush.downloadAndApply(update, onProgress, deviceId);

    if (result === 'bundle_applied' && reloadOnSuccess) {
      await FastPush.reloadApp();
    }

    return { status: result, update };
  },

  /**
   * Report install status to server.
   * Called automatically by downloadAndApply — only needed for custom flows.
   */
  async reportStatus(releaseId, status, appVersion = '1.0.0') {
    assertNativeModule();
    const deviceId = _config?.deviceId || (await getOrCreateDeviceId());
    return NativeFastPush.reportStatus(releaseId, deviceId, status, appVersion);
  },

  /**
   * Get the current downloaded bundle path, or null if using bundled JS.
   */
  async getCurrentBundlePath() {
    assertNativeModule();
    return NativeFastPush.getCurrentBundlePath();
  },

  /**
   * Clear the downloaded update and revert to the bundled JS on next launch.
   */
  async clearUpdate() {
    assertNativeModule();
    return NativeFastPush.clearUpdate();
  },

  /**
   * Reload the app to apply a downloaded bundle.
   */
  async reloadApp() {
    assertNativeModule();
    return NativeFastPush.reloadApp();
  },

  /**
   * Listen for download progress events.
   * Returns an unsubscribe function.
   */
  onDownloadProgress(callback) {
    assertNativeModule();
    const sub = emitter.addListener('FastPushDownloadProgress', callback);
    return () => sub.remove();
  },
};

function assertConfigured() {
  if (!_config) throw new Error('Call FastPush.configure() before using the SDK.');
}

async function getOrCreateDeviceId() {
  if (_cachedDeviceId) return _cachedDeviceId;
  try {
    _cachedDeviceId = await NativeFastPush.getDeviceId();
  } catch {
    _cachedDeviceId = 'device-' + Math.random().toString(36).slice(2);
  }
  return _cachedDeviceId;
}

async function getNativeAppVersion() {
  if (_cachedNativeAppVersion) return _cachedNativeAppVersion;
  try {
    _cachedNativeAppVersion = await NativeFastPush.getNativeAppVersion();
  } catch {
    _cachedNativeAppVersion = Platform.Version?.toString() || '1.0.0';
  }
  return _cachedNativeAppVersion;
}

export default FastPush;
