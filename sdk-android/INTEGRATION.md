# Tích hợp FastPush SDK vào React Native Android

## 1. Cài đặt

Copy thư mục `sdk-android` vào project hoặc link local:

```bash
# Trong package.json của RN app
"dependencies": {
  "react-native-fastpush": "file:../fastpush/sdk-android"
}
```

## 2. Android — MainActivity.kt

```kotlin
package com.yourapp

import com.fastpush.FastPushConfig
import com.fastpush.UpdateManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName() = "YourApp"

    // ① Override getJSBundleFile — redirect to downloaded bundle if available
    override fun getJSBundleFile(): String? {
        return UpdateManager(this, FastPushConfig.serverUrl!!, FastPushConfig.deploymentKey!!)
            .getJSBundleFile()
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

## 3. MainApplication.kt

```kotlin
import com.fastpush.FastPushConfig
import com.fastpush.FastPushPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {

        override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
            add(FastPushPackage())   // ← thêm dòng này
        }

        // ...
    }

    override fun onCreate() {
        super.onCreate()

        // ② Cấu hình FastPush
        FastPushConfig.serverUrl = "https://your-fastpush-server.com"
        FastPushConfig.deploymentKey = "your-deployment-key-from-dashboard"

        // ...
    }
}
```

## 4. Auto-rollback khi crash

```kotlin
// Trong MainApplication.onCreate()
val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
    UpdateManager(this, FastPushConfig.serverUrl!!, FastPushConfig.deploymentKey!!)
        .notifyCrash()
    defaultHandler?.uncaughtException(thread, throwable)
}
```

## 5. Sử dụng JS API

### Cách đơn giản nhất — sync tự động

```js
// App.js hoặc index.js
import FastPush from 'react-native-fastpush';
import DeviceInfo from 'react-native-device-info'; // optional

FastPush.configure({
  serverUrl: 'https://your-fastpush-server.com',
  deploymentKey: 'your-deployment-key',
  appVersion: DeviceInfo.getVersion(), // e.g., "1.0.0"
  deviceId: DeviceInfo.getUniqueIdSync(),
});

// Gọi khi app khởi động
useEffect(() => {
  FastPush.sync({
    onUpdateAvailable: (update) => {
      console.log(`Update v${update.version} available: ${update.description}`);
    },
    onProgress: (percent) => {
      console.log(`Downloading: ${percent}%`);
    },
  });
}, []);
```

### Kiểm soát thủ công

```js
// Kiểm tra update
const update = await FastPush.checkForUpdate();

if (!update) {
  console.log('Already up to date');
  return;
}

if (update.isMandatory) {
  // Bắt buộc update — show dialog không có nút cancel
  await FastPush.downloadAndApply(update, (progress) => {
    setProgress(progress);
  });
  await FastPush.reloadApp();
} else {
  // Cho user chọn
  Alert.alert(
    'Update Available',
    update.description || `Version ${update.version} is available`,
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Update Now',
        onPress: async () => {
          await FastPush.downloadAndApply(update);
          await FastPush.reloadApp();
        },
      },
    ]
  );
}
```

### APK update (full native update)

```js
const update = await FastPush.checkForUpdate();

if (update?.type === 'apk') {
  // Hiển thị dialog download
  Alert.alert(
    'Major Update Required',
    'A new version of the app is available. Please update to continue.',
    [{
      text: 'Download & Install',
      onPress: () => FastPush.downloadAndApply(update, setProgress),
    }]
  );
}
```

## 6. CLI deploy (từ máy dev)

```bash
# Push JS bundle (OTA — không cần publish lên Store)
fastpush release \
  --app MyApp \
  --target-version "1.0.x" \
  --description "Fix login bug" \
  --mandatory

# Push APK (full native update)
fastpush release \
  --app MyApp \
  --target-version "1.0.x" \
  --type apk \
  --file ./android/app/build/outputs/apk/release/app-release.apk

# Rollout dần dần — bắt đầu 10%, tăng dần
fastpush release --app MyApp --target-version "1.0.x" --rollout 10
# ... theo dõi metrics ...
fastpush promote --app MyApp --version 5 --rollout 50
fastpush promote --app MyApp --version 5 --rollout 100

# Nếu có lỗi — rollback ngay
fastpush rollback --app MyApp

# Xem metrics
fastpush metrics --app MyApp
```
