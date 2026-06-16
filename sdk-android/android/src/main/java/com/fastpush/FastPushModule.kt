package com.fastpush

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.File

class FastPushModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FastPush"

    private fun getManager(): UpdateManager? {
        val serverUrl = FastPushConfig.serverUrl ?: run {
            return null
        }
        val deploymentKey = FastPushConfig.deploymentKey ?: run {
            return null
        }
        return UpdateManager(reactContext, serverUrl, deploymentKey)
    }

    @ReactMethod
    fun checkForUpdate(appVersion: String, deviceId: String, promise: Promise) {
        val manager = getManager() ?: run {
            promise.reject("NOT_CONFIGURED", "FastPush not configured. Call FastPush.configure() first.")
            return
        }

        manager.checkForUpdate(appVersion, deviceId) { update ->
            if (update == null) {
                promise.resolve(null)
            } else {
                val map = Arguments.createMap().apply {
                    putString("id", update.id)
                    putInt("version", update.version)
                    putString("type", update.type)
                    putString("hash", update.hash)
                    putDouble("fileSize", update.fileSize.toDouble())
                    putBoolean("isMandatory", update.isMandatory)
                    putString("description", update.description)
                    putString("downloadUrl", update.downloadUrl)
                }
                promise.resolve(map)
            }
        }
    }

    @ReactMethod
    fun downloadAndApply(updateJson: String, promise: Promise) {
        val manager = getManager() ?: run {
            promise.reject("NOT_CONFIGURED", "FastPush not configured.")
            return
        }

        val json = JSONObject(updateJson)
        val update = UpdateInfo(
            id = json.getString("id"),
            version = json.getInt("version"),
            type = json.getString("type"),
            hash = json.getString("hash"),
            fileSize = json.getLong("fileSize"),
            isMandatory = json.optBoolean("isMandatory", false),
            description = json.optString("description").takeIf { it.isNotEmpty() },
            downloadUrl = json.getString("downloadUrl")
        )

        // Report downloading
        val deviceId = json.optString("deviceId", "")
        manager.reportStatus(update.id, deviceId, "downloading", "")

        manager.downloadUpdate(
            update,
            onProgress = { percent ->
                sendEvent("FastPushDownloadProgress", percent)
            }
        ) { file ->
            if (file == null) {
                manager.reportStatus(update.id, deviceId, "failed", "")
                promise.reject("DOWNLOAD_FAILED", "Download failed or hash mismatch")
                return@downloadUpdate
            }

            if (update.type == "apk") {
                installApk(file)
                promise.resolve("apk_install_started")
            } else {
                val applied = manager.applyBundle(file, update.hash)
                if (applied) {
                    manager.reportStatus(update.id, deviceId, "installed", "")
                    promise.resolve("bundle_applied")
                } else {
                    manager.reportStatus(update.id, deviceId, "failed", "")
                    promise.reject("APPLY_FAILED", "Failed to apply bundle")
                }
            }
        }
    }

    @ReactMethod
    fun reportStatus(releaseId: String, deviceId: String, status: String, appVersion: String, promise: Promise) {
        val manager = getManager() ?: run {
            promise.reject("NOT_CONFIGURED", "FastPush not configured.")
            return
        }
        manager.reportStatus(releaseId, deviceId, status, appVersion)
        promise.resolve(null)
    }

    @ReactMethod
    fun getDeviceId(promise: Promise) {
        val manager = getManager() ?: run {
            promise.reject("NOT_CONFIGURED", "FastPush not configured.")
            return
        }
        promise.resolve(manager.getDeviceId())
    }

    @ReactMethod
    fun getNativeAppVersion(promise: Promise) {
        val manager = getManager() ?: run {
            promise.reject("NOT_CONFIGURED", "FastPush not configured.")
            return
        }
        promise.resolve(manager.getNativeAppVersion())
    }

    @ReactMethod
    fun getCurrentBundlePath(promise: Promise) {
        val manager = getManager()
        promise.resolve(manager?.getCurrentBundlePath())
    }

    @ReactMethod
    fun clearUpdate(promise: Promise) {
        getManager()?.clearUpdate()
        promise.resolve(null)
    }

    // Reload app with the downloaded bundle.
    // Kills the process and relaunches — forces MainApplication to reinit with new bundle.
    @ReactMethod
    fun reloadApp() {
        reactContext.runOnUiQueueThread {
            reactContext.currentActivity?.let { activity ->
                val intent = activity.packageManager
                    .getLaunchIntentForPackage(activity.packageName)
                    ?: return@runOnUiQueueThread
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                activity.startActivity(intent)
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
    }

    private fun installApk(apkFile: File) {
        val activity: Activity = reactContext.currentActivity ?: return
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fastpush.provider",
                apkFile
            )
        } else {
            Uri.fromFile(apkFile)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!activity.packageManager.canRequestPackageInstalls()) {
                val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(settingsIntent)
                return
            }
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        reactContext.startActivity(intent)
    }

    private fun sendEvent(eventName: String, data: Any) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
