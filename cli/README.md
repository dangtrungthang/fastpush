# fastpush-cli

CLI để build và đẩy bản cập nhật OTA (over-the-air) cho ứng dụng React Native lên server [FastPush](https://github.com/) — tương tự CodePush nhưng tự host. Hỗ trợ đẩy JS bundle, đẩy APK, rollout theo %, rollback và xem metrics.

## Cài đặt

```bash
npm install -g fastpush-cli
```

Hoặc dùng trực tiếp qua `npx` không cần cài global:

```bash
npx fastpush-cli <command>
```

Yêu cầu: Node.js >= 14, đã cài `react-native-cli`/dự án React Native hợp lệ nếu muốn build bundle tự động (lệnh `release` gọi `npx react-native bundle` ngầm).

Kiểm tra cài đặt thành công:

```bash
fastpush --version
```

## Cấu hình server

Theo mặc định CLI gọi tới `http://localhost:3000`. Nếu server FastPush của bạn chạy ở domain khác, set lại trước khi dùng các lệnh khác:

```bash
fastpush server https://fastpush.example.com
```

Giá trị này được lưu tại `~/.fastpush/config.json` cùng với token đăng nhập, dùng chung cho mọi lệnh sau đó.

## Hướng dẫn sử dụng

### 1. Tạo tài khoản & đăng nhập

```bash
fastpush register --name "Thắng" --email you@example.com --password ******
fastpush login --email you@example.com --password ******
```

Có thể bỏ `--email`/`--password` để CLI hỏi qua prompt (ẩn password khi nhập).

### 2. Quản lý app

```bash
# Tạo app mới (platform: android | ios, mặc định android)
fastpush app create MyApp --platform android

# Liệt kê app & deployment key
fastpush app list

# Xem chi tiết 1 app theo ID
fastpush app info <appId>
```

`deploymentKey` trả về khi tạo app chính là key cần khai báo trong SDK Android (`FastPushConfig.deploymentKey`).

### 3. Đẩy bản cập nhật (release)

```bash
# Đẩy JS bundle (CLI tự build bằng `react-native bundle` rồi upload)
fastpush release \
  --app MyApp \
  --target-version "1.0.x" \
  --description "Fix login bug" \
  --mandatory

# Đẩy file đã build sẵn (bundle.zip hoặc .apk) thay vì build lại
fastpush release \
  --app MyApp \
  --target-version "1.0.x" \
  --type apk \
  --file ./android/app/build/outputs/apk/release/app-release.apk
```

Các option của `release`:

| Option | Mô tả | Mặc định |
| --- | --- | --- |
| `--app <name>` | Tên app (bắt buộc) | — |
| `--target-version <version>` | Version native app áp dụng, hỗ trợ semver range kiểu `"1.0.x"` (bắt buộc) | — |
| `--entry-file <file>` | Entry file khi build bundle | `index.js` |
| `--platform <platform>` | `android` hoặc `ios` | `android` |
| `--description <desc>` | Ghi chú release | — |
| `--mandatory` | Đánh dấu bắt buộc cập nhật | `false` |
| `--type <type>` | `bundle` (OTA JS) hoặc `apk` (native) | `bundle` |
| `--file <path>` | Upload file có sẵn, bỏ qua bước build | — |

Khi build tự động, CLI tạo thư mục `.fastpush/` trong project để chứa bundle + assets trước khi zip và upload — có thể thêm `.fastpush/` vào `.gitignore`.

### 4. Rollout dần dần / Promote / Rollback

```bash
# Đẩy release nhưng chỉ áp dụng cho 10% thiết bị
fastpush release --app MyApp --target-version "1.0.x"
fastpush promote --app MyApp --version 5 --rollout 10

# Theo dõi ổn định rồi tăng dần
fastpush promote --app MyApp --version 5 --rollout 50
fastpush promote --app MyApp --version 5 --rollout 100

# Có lỗi → rollback ngay về release active trước đó
fastpush rollback --app MyApp
```

### 5. Xem lịch sử & metrics

```bash
fastpush history --app MyApp   # danh sách release: version, type, size, downloads, mandatory, status, ngày tạo
fastpush metrics --app MyApp   # rollout%, downloads, installs, failures, install rate cho 5 release active gần nhất
```

## Xử lý lỗi thường gặp

**`✗ Login failed: ...` / mọi lệnh trả lỗi 401**
Token chưa có hoặc đã hết hạn. Chạy lại `fastpush login`. Token lưu tại `~/.fastpush/config.json` — xóa file này nếu cần đăng nhập lại từ đầu.

**`✗ Failed: request to http://localhost:3000/... failed`**
CLI đang gọi sai địa chỉ server. Kiểm tra server đã set đúng chưa: `cat ~/.fastpush/config.json`, hoặc set lại bằng `fastpush server <url>`.

**`App "<name>" not found. Run "fastpush app list" to see your apps.`**
Tên app trong `--app` phải khớp **chính xác** (case-sensitive) với tên hiển thị ở `fastpush app list`, không phải App ID.

**`--app is required` / `--target-version is required`**
Các lệnh `release`, `history`, `rollback`, `promote`, `metrics` yêu cầu cờ tương ứng — xem lại bảng option ở trên hoặc dùng `fastpush <command> --help`.

**Build bundle lỗi (`npx react-native bundle` thất bại) khi chạy `release`**
Lệnh này chạy ngay trong thư mục hiện tại của project RN, nên phải:
- Chạy `fastpush release` từ root của project React Native (chỗ có `index.js`/`package.json`).
- Đảm bảo `node_modules` đã cài (`npm install`) và `--entry-file` đúng tên file entry thực tế.
- Nếu vẫn lỗi, build bundle thủ công rồi dùng `--file` để upload file đã build, bỏ qua bước build tự động của CLI.

**Upload thất bại / timeout với file lớn (APK)**
Kiểm tra server có giới hạn dung lượng upload (body size limit) phù hợp, và đường dẫn `--file` tồn tại, đúng quyền đọc.

**`Release v... published!` nhưng app không nhận update**
- Kiểm tra `--target-version` trên CLI có khớp với `appVersion` mà SDK trên thiết bị gửi lên không (CLI hỗ trợ pattern dạng `"1.0.x"`).
- Kiểm tra `rolloutPercent` của release — nếu đang rollout thấp, không phải mọi thiết bị đều nhận được; dùng `fastpush promote --rollout 100` để áp dụng cho toàn bộ.
- Kiểm tra release có `isDisabled`/đã bị rollback chưa qua `fastpush history --app MyApp`.

## Liên quan

- SDK client cho React Native Android: [`react-native-fastpush`](../sdk-android/README.md)
