package com.fastpush

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

data class UpdateInfo(
    val id: String,
    val version: Int,
    val type: String,       // "bundle" | "apk"
    val hash: String,
    val fileSize: Long,
    val isMandatory: Boolean,
    val description: String?,
    val downloadUrl: String
)

class UpdateManager(
    private val context: Context,
    private val serverUrl: String,
    private val deploymentKey: String
) {
    companion object {
        private const val TAG = "FastPush"
        private const val PREFS = "fastpush_prefs"
        private const val KEY_CURRENT_HASH = "current_hash"
        private const val KEY_BUNDLE_PATH = "bundle_path"
        private const val KEY_CRASH_COUNT = "crash_count"
        private const val KEY_LAST_BUNDLE_HASH = "last_bundle_hash"
        private const val MAX_CRASHES = 3
    }

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val bundleDir = File(context.filesDir, "fastpush/bundles")

    init {
        bundleDir.mkdirs()
    }

    fun getCurrentBundlePath(): String? {
        val path = prefs.getString(KEY_BUNDLE_PATH, null)
        return if (path != null && File(path).exists()) path else null
    }

    // Called from MainActivity.getJSBundleFile()
    fun getJSBundleFile(): String? {
        recordAppStart()
        return getCurrentBundlePath()
    }

    private fun recordAppStart() {
        val lastHash = prefs.getString(KEY_LAST_BUNDLE_HASH, null)
        val currentHash = prefs.getString(KEY_CURRENT_HASH, null)
        if (currentHash != null && currentHash == lastHash) {
            // Same bundle booted — reset crash count
            prefs.edit().putInt(KEY_CRASH_COUNT, 0).apply()
        } else if (currentHash != null) {
            prefs.edit().putString(KEY_LAST_BUNDLE_HASH, currentHash).apply()
        }
    }

    // Call this from UncaughtExceptionHandler to auto-rollback on crashes
    fun notifyCrash() {
        val crashes = prefs.getInt(KEY_CRASH_COUNT, 0) + 1
        prefs.edit().putInt(KEY_CRASH_COUNT, crashes).apply()
        Log.w(TAG, "Crash recorded: $crashes/$MAX_CRASHES")
        if (crashes >= MAX_CRASHES) {
            Log.e(TAG, "Max crashes reached — rolling back to bundled JS")
            clearUpdate()
        }
    }

    fun clearUpdate() {
        bundleDir.listFiles()?.forEach { it.delete() }
        prefs.edit()
            .remove(KEY_BUNDLE_PATH)
            .remove(KEY_CURRENT_HASH)
            .remove(KEY_CRASH_COUNT)
            .remove(KEY_LAST_BUNDLE_HASH)
            .apply()
        Log.i(TAG, "Rolled back to bundled JS")
    }

    // Check for update from server
    fun checkForUpdate(
        appVersion: String,
        deviceId: String,
        callback: (UpdateInfo?) -> Unit
    ) {
        Thread {
            try {
                val currentHash = prefs.getString(KEY_CURRENT_HASH, "")
                val url = URL("$serverUrl/api/update/check")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000

                val body = JSONObject().apply {
                    put("deploymentKey", deploymentKey)
                    put("appVersion", appVersion)
                    put("currentHash", currentHash)
                    put("deviceId", deviceId)
                }.toString()

                conn.outputStream.use { it.write(body.toByteArray()) }

                val response = conn.inputStream.bufferedReader().readText()
                val json = JSONObject(response)
                conn.disconnect()

                if (!json.optBoolean("updateAvailable", false)) {
                    callback(null)
                    return@Thread
                }

                callback(
                    UpdateInfo(
                        id = json.getString("id"),
                        version = json.getInt("version"),
                        type = json.getString("type"),
                        hash = json.getString("hash"),
                        fileSize = json.getLong("fileSize"),
                        isMandatory = json.optBoolean("isMandatory", false),
                        description = json.optString("description").takeIf { it.isNotEmpty() },
                        downloadUrl = json.getString("downloadUrl")
                    )
                )
            } catch (e: Exception) {
                Log.e(TAG, "checkForUpdate failed: ${e.message}")
                callback(null)
            }
        }.start()
    }

    // Download bundle/APK with progress
    fun downloadUpdate(
        update: UpdateInfo,
        onProgress: ((Int) -> Unit)? = null,
        onComplete: (File?) -> Unit
    ) {
        Thread {
            try {
                val url = URL("$serverUrl${update.downloadUrl}")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 15_000
                conn.readTimeout = 60_000

                val ext = if (update.type == "apk") ".apk" else ".zip"
                val destFile = File(bundleDir, "update_v${update.version}$ext")

                val total = conn.contentLengthLong
                var downloaded = 0L

                conn.inputStream.use { input ->
                    FileOutputStream(destFile).use { output ->
                        val buf = ByteArray(8192)
                        var n: Int
                        while (input.read(buf).also { n = it } != -1) {
                            output.write(buf, 0, n)
                            downloaded += n
                            if (total > 0) {
                                onProgress?.invoke(((downloaded * 100) / total).toInt())
                            }
                        }
                    }
                }
                conn.disconnect()

                // Verify SHA256
                val actualHash = sha256(destFile)
                if (actualHash != update.hash) {
                    Log.e(TAG, "Hash mismatch! expected=${update.hash} got=$actualHash")
                    destFile.delete()
                    onComplete(null)
                    return@Thread
                }

                Log.i(TAG, "Download verified: v${update.version} hash=$actualHash")
                onComplete(destFile)
            } catch (e: Exception) {
                Log.e(TAG, "downloadUpdate failed: ${e.message}")
                onComplete(null)
            }
        }.start()
    }

    // Apply a downloaded JS bundle (extract zip → find .bundle file)
    fun applyBundle(zipFile: File, hash: String): Boolean {
        return try {
            val extractDir = File(bundleDir, "active")
            extractDir.deleteRecursively()
            extractDir.mkdirs()

            unzip(zipFile, extractDir)

            val bundleFile = extractDir.walkTopDown().find {
                it.isFile && (it.name.endsWith(".bundle") || it.name.endsWith(".jsbundle"))
            } ?: run {
                Log.e(TAG, "No .bundle file found in zip")
                return false
            }

            prefs.edit()
                .putString(KEY_BUNDLE_PATH, bundleFile.absolutePath)
                .putString(KEY_CURRENT_HASH, hash)
                .putInt(KEY_CRASH_COUNT, 0)
                .apply()

            Log.i(TAG, "Bundle applied: ${bundleFile.absolutePath}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "applyBundle failed: ${e.message}")
            false
        }
    }

    // Report install status to server
    fun reportStatus(
        releaseId: String,
        deviceId: String,
        status: String,
        appVersion: String
    ) {
        Thread {
            try {
                val url = URL("$serverUrl/api/update/report")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10_000

                val body = JSONObject().apply {
                    put("releaseId", releaseId)
                    put("deviceId", deviceId)
                    put("status", status)
                    put("appVersion", appVersion)
                }.toString()

                conn.outputStream.use { it.write(body.toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "reportStatus failed: ${e.message}")
            }
        }.start()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buf = ByteArray(8192)
            var n: Int
            while (fis.read(buf).also { n = it } != -1) {
                digest.update(buf, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun unzip(zipFile: File, destDir: File) {
        java.util.zip.ZipFile(zipFile).use { zip ->
            zip.entries().asSequence().forEach { entry ->
                val outFile = File(destDir, entry.name)
                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    zip.getInputStream(entry).use { input ->
                        FileOutputStream(outFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                }
            }
        }
    }
}
