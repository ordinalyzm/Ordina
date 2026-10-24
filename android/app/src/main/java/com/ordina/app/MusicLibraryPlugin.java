package com.ordina.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Читает аудиотеку устройства (Android MediaStore) для импорта в «Ордина Музыка».
 * Возвращает метаданные треков (название, автор, длительность) и, по запросу, содержимое файла.
 */
@CapacitorPlugin(
    name = "MusicLibrary",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class MusicLibraryPlugin extends Plugin {

    // Ограничение размера одного файла при выгрузке (25 МБ), чтобы не переполнять память
    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;

    private String requiredAudioPermission() {
        return Build.VERSION.SDK_INT >= 33
            ? Manifest.permission.READ_MEDIA_AUDIO
            : Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    private boolean hasAudioPermission() {
        return ContextCompat.checkSelfPermission(getContext(), requiredAudioPermission())
            == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void getAudioTracks(PluginCall call) {
        if (!hasAudioPermission()) {
            requestPermissionForAliases(new String[] { "audio", "storage" }, call, "audioPermissionCallback");
            return;
        }
        readAudioTracks(call);
    }

    @PermissionCallback
    private void audioPermissionCallback(PluginCall call) {
        if (hasAudioPermission()) {
            readAudioTracks(call);
        } else {
            call.reject("Нет разрешения на чтение аудио. Разрешите доступ к музыке в настройках приложения.");
        }
    }

    private void readAudioTracks(PluginCall call) {
        long minDurationMs = 25000L;
        Long minArg = call.getLong("minDurationMs");
        if (minArg != null) minDurationMs = minArg;

        JSArray tracks = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();

        String[] projection = new String[] {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.MIME_TYPE
        };

        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " +
            MediaStore.Audio.Media.DURATION + " >= ?";
        String[] selectionArgs = new String[] { String.valueOf(minDurationMs) };
        String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

        Cursor cursor = null;
        try {
            cursor = resolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            );

            if (cursor != null) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
                int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);

                while (cursor.moveToNext()) {
                    long id = cursor.getLong(idColumn);
                    String title = cursor.getString(titleColumn);
                    String artist = cursor.getString(artistColumn);
                    long duration = cursor.getLong(durationColumn);
                    long size = cursor.getLong(sizeColumn);
                    String mime = cursor.getString(mimeColumn);

                    if (title == null || title.trim().isEmpty()) title = "Без названия";
                    if (artist == null || artist.trim().isEmpty() || "<unknown>".equals(artist)) {
                        artist = "Неизвестный исполнитель";
                    }
                    if (mime == null || mime.isEmpty()) mime = "audio/mpeg";

                    JSObject track = new JSObject();
                    track.put("id", String.valueOf(id));
                    track.put("title", title);
                    track.put("artist", artist);
                    track.put("durationMs", duration);
                    track.put("size", size);
                    track.put("mimeType", mime);
                    track.put("tooLarge", size > MAX_FILE_SIZE);
                    tracks.put(track);
                }
            }
        } catch (Exception e) {
            call.reject("Не удалось прочитать аудиотеку: " + e.getMessage());
            return;
        } finally {
            if (cursor != null) cursor.close();
        }

        JSObject result = new JSObject();
        result.put("tracks", tracks);
        call.resolve(result);
    }

    @PluginMethod
    public void getAudioData(PluginCall call) {
        if (!hasAudioPermission()) {
            requestPermissionForAliases(new String[] { "audio", "storage" }, call, "audioDataPermissionCallback");
            return;
        }
        readAudioData(call);
    }

    @PermissionCallback
    private void audioDataPermissionCallback(PluginCall call) {
        if (hasAudioPermission()) {
            readAudioData(call);
        } else {
            call.reject("Нет разрешения на чтение аудио.");
        }
    }

    private void readAudioData(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) {
            call.reject("Не указан id трека");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, Long.parseLong(idStr));

        String mime = call.getString("mimeType", "audio/mpeg");

        InputStream input = null;
        ByteArrayOutputStream buffer = null;
        try {
            input = resolver.openInputStream(uri);
            if (input == null) {
                call.reject("Не удалось открыть файл трека");
                return;
            }

            buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            long total = 0;
            int read;
            while ((read = input.read(chunk)) != -1) {
                total += read;
                if (total > MAX_FILE_SIZE) {
                    call.reject("Файл больше 25 МБ и не может быть импортирован");
                    return;
                }
                buffer.write(chunk, 0, read);
            }

            String base64 = Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP);

            JSObject result = new JSObject();
            result.put("data", base64);
            result.put("mimeType", mime);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Не удалось прочитать файл трека: " + e.getMessage());
        } finally {
            try {
                if (input != null) input.close();
                if (buffer != null) buffer.close();
            } catch (Exception ignored) {}
        }
    }
}
