package com.ordina.app.music

import android.content.Context
import android.os.Build
import android.provider.MediaStore

data class ShortAudioTrack(
    val id: Long,
    val title: String,
    val artist: String,
    val durationMs: Int
)

fun getShortAudioFiles(context: Context): List<ShortAudioTrack> {
    val resultList = mutableListOf<ShortAudioTrack>()

    val collectionUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    }

    val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.DURATION
    )

    val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND " +
                    "${MediaStore.Audio.Media.DURATION} > 0 AND " +
                    "${MediaStore.Audio.Media.DURATION} <= ?"
    
    val selectionArgs = arrayOf("25000")
    val sortOrder = "${MediaStore.Audio.Media.DURATION} DESC"

    context.contentResolver.query(
        collectionUri, 
        projection, 
        selection, 
        selectionArgs, 
        sortOrder
    )?.use { cursor ->
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)

        while (cursor.moveToNext()) {
            val id = cursor.getLong(idColumn)
            val title = cursor.getString(titleColumn) ?: "Без названия"
            val artist = cursor.getString(artistColumn) ?: "Неизвестен"
            val durationMs = cursor.getInt(durationColumn)

            resultList.add(ShortAudioTrack(id, title, artist, durationMs))
        }
    }

    return resultList
}
