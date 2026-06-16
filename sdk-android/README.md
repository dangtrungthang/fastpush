# react-native-fastpush

SDK React Native (Android) cho [FastPush](../README.md) — hệ thống OTA update tự host (tương tự CodePush). Hỗ trợ:

- Cập nhật JS bundle qua mạng (OTA), không cần submit lại Store.
- Cập nhật APK toàn phần (native update) qua installer hệ thống.
- Auto-rollback khi app crash ngay sau khi áp dụng bản update.
- Theo dõi rollout %, báo cáo trạng thái download/install về server.
- Tương thích cả Old Architecture (Bridge) và New Architecture (TurboModules, RN 0.76+).

> Hiện chỉ hỗ trợ **Android**. iOS chưa có trong package này.

## Cài đặt

Yêu cầu: `react-native >= 0.71`, Node.js >= 16.

### Qua npm (đã publish)

```bash
npm install react-native-fastpush
# hoặc
yarn add react-native-fastpush
```

Với React Native >= 0.60, autolinking sẽ tự nhận diện package qua `react-native.config.js` đi kèm — không cần `react-native link`.

### Local / chưa publish (dùng trong monorepo FastPush)

```json
// package.json của app RN
"dependencies": {
  "react-native-fastpush": "file:../fastpush/sdk-android"
}
```

```bash
npm install
cd android && ./gradlew clean   # rebuild lại native sau khi link package mới
```

## Cấu hình native (Android)

### 1. `MainApplication.kt` — đăng ký package & config server

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

        FastPushConfig.serverUrl = "https://your-fastpush-server.com"
        FastPushConfig.deploymentKey = "your-deployment-key-from-dashboard"
        // ...
    }
}
```

`deploymentKey` lấy từ `fastpush app list` (CLI) hoặc dashboard, gắn với 1 app cụ thể.

### 2. `MainActivity.kt` — trỏ tới bundle đã download (nếu có)

```kotlin
import com.fastpush.FastPushConfig
import com.fastpush.UpdateManager

class MainActivity : ReactActivity() {

    override fun getMainComponentName() = "YourApp"

    override fun getJSBundleFile(): String? {
        return UpdateManager(this, FastPushConfig.serverUrl!!, FastPushConfig.deploymentKey!!)
            .getJSBundleFile()
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

Nếu bỏ qua bước này, app sẽ luôn chạy bundle đóng gói sẵn trong APK, JS bundle OTA sẽ không bao giờ được áp dụng.

### 3. Auto-rollback khi crash (khuyến nghị)

Thêm vào `MainApplication.onCreate()`, **sau** khi set `FastPushConfig`:

```kotlin
val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
    UpdateManager(this, FastPushConfig.serverUrl!!, FastPushConfig.deploymentKey!!)
        .notifyCrash()
    defaultHandler?.uncaughtException(thread, throwable)
}
```

Nếu app crash ngay sau khi nhận bundle mới, `UpdateManager` sẽ tự revert về bundle ổn định trước đó ở lần khởi động kế tiếp.

### 4. Quyền cài APK (chỉ cần nếu dùng update type `apk`)

Manifest của package đã tự khai báo `INTERNET`, `REQUEST_INSTALL_PACKAGES` và `FileProvider` — không cần khai báo thêm gì trong app. Lần đầu cài APK trên Android 8+, hệ thống sẽ tự mở màn hình "Cho phép cài đặt từ nguồn này" nếu app chưa được cấp quyền (SDK tự xử lý, xem phần Troubleshooting nếu màn hình không tự bật).

## Hướng dẫn sử dụng (JS API)

### Cách đơn giản nhất — `sync()` tự động

```js
// App.js hoặc index.js
import FastPush from 'react-native-fastpush';
import DeviceInfo from 'react-native-device-info'; // optional, để lấy version/deviceId thật

FastPush.configure({
  serverUrl: 'https://your-fastpush-server.com',
  deploymentKey: 'your-deployment-key',
  appVersion: DeviceInfo.getVersion(),       // ví dụ "1.0.0"
  deviceId: DeviceInfo.getUniqueIdSync(),
});

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

`sync()` tự check update → download → apply → reload app (nếu là bundle) trong 1 lệnh, trả về `{ status, update }` với `status` là `up_to_date | bundle_applied | apk_install_started`.

### Kiểm soát thủ công

```js
const update = await FastPush.checkForUpdate();

if (!update) {
  console.log('Already up to date');
  return;
}

if (update.isMandatory) {
  await FastPush.downloadAndApply(update, (progress) => setProgress(progress));
  await FastPush.reloadApp();
} else {
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

### Update APK (native update toàn phần)

```js
const update = await FastPush.checkForUpdate();

if (update?.type === 'apk') {
  Alert.alert(
    'Major Update Required',
    'A new version of the app is available. Please update to continue.',
    [{ text: 'Download & Install', onPress: () => FastPush.downloadAndApply(update, setProgress) }]
  );
}
```

### API reference

| Method | Mô tả |
| --- | --- |
| `configure({ serverUrl, deploymentKey, appVersion?, deviceId? })` | Khởi tạo SDK, gọi 1 lần khi app start. Bắt buộc trước mọi method khác. |
| `checkForUpdate()` | Trả về object update (`id, version, type, hash, fileSize, isMandatory, description, downloadUrl`) hoặc `null` nếu đã mới nhất. |
| `downloadAndApply(update, onProgress?)` | Download + áp dụng update. Bundle → ghi file, áp dụng sau `reloadApp()`. APK → mở installer hệ thống. |
| `sync(options?)` | check + download + apply + (tự reload nếu là bundle, mặc định `reloadOnSuccess: true`). |
| `onDownloadProgress(callback)` | Đăng ký lắng nghe tiến trình download, trả về hàm `unsubscribe`. |
| `getCurrentBundlePath()` | Đường dẫn bundle OTA hiện tại đang dùng, `null` nếu đang dùng bundle gốc trong APK. |
| `clearUpdate()` | Xoá bundle OTA đã tải, app sẽ quay lại bundle gốc ở lần khởi động kế tiếp. |
| `reloadApp()` | Kill & relaunch app để bundle mới có hiệu lực. |
| `reportStatus(releaseId, status, appVersion?)` | Báo cáo trạng thái cài đặt về server — bình thường không cần gọi tay, `downloadAndApply` đã tự gọi. |

### Deploy bản update từ CLI

Dùng kèm [`fastpush-cli`](../cli/README.md):

```bash
fastpush release --app MyApp --target-version "1.0.x" --description "Fix login bug" --mandatory
fastpush release --app MyApp --target-version "1.0.x" --type apk --file ./app-release.apk
fastpush rollback --app MyApp
```

## Xử lý lỗi thường gặp

**`Error: react-native-fastpush: Native module not found. ...`**
Native module chưa được link đúng cách. Kiểm tra:
- Đã thêm `add(FastPushPackage())` vào `MainApplication.kt` chưa.
- Đã rebuild native sau khi cài package: `cd android && ./gradlew clean && cd .. && npx react-native run-android` (autolinking không tự rebuild app đang chạy).
- Nếu dùng **New Architecture** (RN 0.76+) và vẫn lỗi, đảm bảo Bridge Interop Layer được enable (mặc định RN 0.76+ đã bật; nếu tắt thủ công trong `gradle.properties`, cần bật lại hoặc đợi bản TurboModule spec chính thức).

**`Call FastPush.configure() before using the SDK.`**
Gọi `checkForUpdate`/`sync`/`downloadAndApply` trước khi gọi `FastPush.configure(...)`. Đảm bảo `configure()` được gọi ở module-level hoặc trong effect chạy sớm nhất (ví dụ đầu `App.js`), trước mọi lệnh khác.

**`NOT_CONFIGURED` — "FastPush not configured. Call FastPush.configure() first."**
Lỗi tương tự ở native side: `FastPushConfig.serverUrl`/`deploymentKey` chưa được set trong `MainApplication.onCreate()` (khác với `configure()` ở JS — cả 2 nơi đều cần set).

**Update bundle áp dụng nhưng app không đổi gì sau khi reload**
Thiếu bước override `getJSBundleFile()` trong `MainActivity.kt` (mục Cấu hình native, bước 2) — không có bước này, app luôn load bundle gốc đóng gói trong APK, bỏ qua bundle OTA đã tải.

**`DOWNLOAD_FAILED` — "Download failed or hash mismatch"**
File tải về không khớp `hash` server trả — thường do mạng chập chờn giữa lúc tải hoặc release trên server bị build sai. Thử lại `checkForUpdate()`/`downloadAndApply()`; nếu lặp lại, build và đẩy lại release từ CLI.

**`APPLY_FAILED` — "Failed to apply bundle"**
Thường do thiếu quyền ghi vào storage app hoặc dung lượng máy đầy. Kiểm tra dung lượng trống trên thiết bị test.

**Cài APK: màn hình "cho phép cài app không rõ nguồn" hiện liên tục / không cài được**
Trên Android 8+ (`O+`), nếu app chưa được cấp `REQUEST_INSTALL_PACKAGES`, SDK tự mở `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` thay vì cài ngay — người dùng cần cấp quyền thủ công 1 lần rồi bấm "Download & Install" lại. Đây là hành vi bắt buộc của Android, không phải lỗi SDK.

**Build Gradle lỗi `Could not find com.facebook.react:react-native:...`**
Bản SDK hiện dùng artifact `com.facebook.react:react-android:+` (đổi tên từ `react-native` kể từ RN 0.71+ khi dùng New Architecture artifacts). Nếu project dùng RN < 0.71, cần hạ artifact tương ứng hoặc nâng cấp RN — package này yêu cầu `react-native >= 0.71` (xem `peerDependencies`).

**Lỗi version Kotlin/AGP không khớp khi build**
Từ bản hiện tại, module không tự khai báo `buildscript` riêng — nó dùng chung classpath Kotlin/AGP của app gốc. Đảm bảo `android/build.gradle` ở app có khai báo Kotlin plugin version tương thích (`kotlin-android` cùng version với toàn project).

**`minSdkVersion`/`compileSdkVersion` conflict**
Module yêu cầu `minSdkVersion 21`, `compileSdkVersion 35`, `targetSdkVersion 34`. Đảm bảo app gốc có `compileSdkVersion >= 35` (hoặc set `android.compileSdkVersion` qua `ext` để đồng bộ toàn project) để tránh lỗi merge manifest.

## Liên quan

- Hướng dẫn tích hợp chi tiết hơn (từng bước copy-paste): [`INTEGRATION.md`](./INTEGRATION.md)
- CLI để deploy release: [`fastpush-cli`](../cli/README.md)
