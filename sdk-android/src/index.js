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

const FastPush = {
  /**
   * Configure FastPush SDK.
   * Call this once in your App entry (e.g., App.js or index.js).
   *
   * @param {Object} options
   * @param {string} options.serverUrl       - FastPush server URL (e.g., "https://fastpush.example.com")
   * @param {string} options.deploymentKey   - App deployment key from dashboard
   * @param {string} [options.appVersion]    - Native app version (default: auto-detected)
   * @param {string} [options.deviceId]      - Unique device ID (default: random UUID per install)
   */
  configure(options) {
    if (!options.serverUrl) throw new Error('serverUrl is required');
    if (!options.deploymentKey) throw new Error('deploymentKey is required');
    _config = options;
  },

  /**
   * Check if a new update is available.
   * Returns update info object or null.
   */
  async checkForUpdate() {
    assertConfigured();
    assertNativeModule();
    const appVersion = _config.appVersion || Platform.Version?.toString() || '1.0.0';
    const deviceId = _config.deviceId || getOrCreateDeviceId();
    const update = await NativeFastPush.checkForUpdate(appVersion, deviceId);
    return update;
  },

  /**
   * Download and apply an update.
   * For JS bundle: applies immediately, call reloadApp() to take effect.
   * For APK: launches the system installer.
   *
   * @param {Object} update - The update object from checkForUpdate()
   * @param {Function} [onProgress] - Progress callback (0-100)
   */
  async downloadAndApply(update, onProgress) {
    assertConfigured();
    assertNativeModule();
    const deviceId = _config.deviceId || getOrCreateDeviceId();

    let progressListener;
    if (onProgress && emitter) {
      progressListener = emitter.addListener('FastPushDownloadProgress', onProgress);
    }

    try {
      const updateWithDevice = { ...update, deviceId };
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
   */
  async sync(options = {}) {
    assertConfigured();
    assertNativeModule();
    const { onProgress, onUpdateAvailable, reloadOnSuccess = true } = options;

    const update = await FastPush.checkForUpdate();
    if (!update) return { status: 'up_to_date' };

    if (onUpdateAvailable) onUpdateAvailable(update);

    const result = await FastPush.downloadAndApply(update, onProgress);

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
    const deviceId = _config?.deviceId || getOrCreateDeviceId();
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

function getOrCreateDeviceId() {
  // In a real app, use a persistent UUID (e.g., react-native-device-info or AsyncStorage)
  // This is a simple fallback
  return 'device-' + Math.random().toString(36).slice(2);
}

export default FastPush;
