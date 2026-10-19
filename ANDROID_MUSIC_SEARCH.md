# Рекомендация для поиска музыки на Android (Kotlin)

Ниже представлен изолированный метод на Kotlin, который решает исключительно задачу поиска, фильтрации по времени (строго до 25 секунд) и загрузки метаданных в список из системного хранилища Android MediaStore:

\`\`\`kotlin
import android.content.Context
import android.os.Build
import android.provider.MediaStore

// Простая модель для хранения данных о найденном файле
data class ShortAudioTrack(
    val id: Long,
    val title: String,
    val artist: String,
    val durationMs: Int
)

/**
 * Ищет в памяти телефона аудиофайлы длительностью строго до 25 секунд.
 * Требует предварительно полученного разрешения на чтение памяти.
 */
fun getShortAudioFiles(context: Context): List<ShortAudioTrack> {
    val resultList = mutableListOf<ShortAudioTrack>()

    // 1. Определяем URI коллекции в зависимости от версии Android
    val collectionUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    }

    // 2. Указываем, какие столбцы из БД нам нужны
    val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.DURATION
    )

    // 3. ФИЛЬТР: файл должен быть музыкой И его длительность должна быть > 0 и <= 25 000 мс (25 секунд)
    val selection = "\${MediaStore.Audio.Media.IS_MUSIC} != 0 AND " +
                    "\${MediaStore.Audio.Media.DURATION} > 0 AND " +
                    "\${MediaStore.Audio.Media.DURATION} <= ?"
    
    // Передаем значение 25000 в качестве аргумента фильтра (безопасный способ против SQL-инъекций)
    val selectionArgs = arrayOf("25000")

    // Сортировка по убыванию длительности (сначала самые длинные из коротких)
    val sortOrder = "\${MediaStore.Audio.Media.DURATION} DESC"

    // 4. Выполняем запрос к системной картотеке
    context.contentResolver.query(
        collectionUri, 
        projection, 
        selection, 
        selectionArgs, 
        sortOrder
    )?.use { cursor ->
        
        // Получаем индексы столбцов
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)

        // Читаем базу данных построчно
        while (cursor.moveToNext()) {
            val id = cursor.getLong(idColumn)
            val title = cursor.getString(titleColumn) ?: "Без названия"
            val artist = cursor.getString(artistColumn) ?: "Неизвестен"
            val durationMs = cursor.getInt(durationColumn)

            // Добавляем объект в итоговый список
            resultList.add(ShortAudioTrack(id, title, artist, durationMs))
        }
    }

    return resultList
}
\`\`\`
