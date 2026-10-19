import { MusicTrack, MusicPlaylist } from '../types';

export const DEFAULT_PUBLIC_TRACKS: MusicTrack[] = [
  {
    id: 'track_classical_vivaldi_summer',
    title: '«Времена года» — Гроза (Лето, Presto)',
    artist: 'Антонио Вивальди / John Harrison, violin',
    genre: 'Классика',
    duration: 159,
    fileSize: 3009285,
    fileUrl: '/music/vivaldi_summer.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Antonio Vivaldi (1723), Концерт № 2 соль минор, RV 315',
    licenseType: 'public_domain',
    createdAt: '2025-01-01T00:00:00.000Z',
    likes: 124,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты жанра «Классика»]:
🎻 Соло-скрипка (виртуозные пассажи престо)
🎻 Струнный оркестр: первые и вторые скрипки, альты, виолончели, контрабасы
🎹 Клавесин (basso continuo)

[Музыкальное описание]:
Бушующая летняя гроза, раскаты грома в струнных басах и молнии в стремительных пассажах скрипки.`
  },
  {
    id: 'track_classical_vivaldi_spring',
    title: '«Времена года» — Весна (Allegro)',
    artist: 'Антонио Вивальди / John Harrison, violin',
    genre: 'Классика',
    duration: 216,
    fileSize: 4200000,
    fileUrl: '/music/vivaldi_spring.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Antonio Vivaldi (1723), Концерт № 1 ми мажор, RV 269',
    licenseType: 'public_domain',
    createdAt: '2025-01-02T00:00:00.000Z',
    likes: 98,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎻 Скрипичный квинтет
🎹 Клавесин
🐦 Имитация пения птиц и журчания весенних ручьев.`
  },
  {
    id: 'track_classical_vivaldi_winter',
    title: '«Времена года» — Зима (Allegro non molto)',
    artist: 'Антонио Вивальди / John Harrison, violin',
    genre: 'Классика',
    duration: 209,
    fileSize: 3900000,
    fileUrl: '/music/vivaldi_winter.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1517824806704-9040b037703b?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Antonio Vivaldi (1723), Концерт № 4 фа минор, RV 297',
    licenseType: 'public_domain',
    createdAt: '2025-01-03T00:00:00.000Z',
    likes: 87,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎻 Скрипичное пиццикато (капли холодного дождя)
🎻 Стремительные пассажи ледяного ветра`
  },
  {
    id: 'track_classical_beethoven_moonlight',
    title: '«Лунная соната» (Соната № 14)',
    artist: 'Людвиг ван Бетховен / Фортепиано',
    genre: 'Классика',
    duration: 360,
    fileSize: 6633329,
    fileUrl: '/music/beethoven_moonlight.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1520523839898-507127027c8e?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Ludwig van Beethoven (1801), Op. 27 No. 2',
    licenseType: 'public_domain',
    createdAt: '2025-01-04T00:00:00.000Z',
    likes: 145,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎹 Концертный рояль
Непрерывные триоли в басовом регистре и задумчивая мелодия в верхнем голосе.`
  },
  {
    id: 'track_classical_tchaikovsky_sugarplum',
    title: '«Щелкунчик» — Танец феи Драже',
    artist: 'П. И. Чайковский / Симфонический оркестр',
    genre: 'Классика',
    duration: 114,
    fileSize: 1894439,
    fileUrl: '/music/tchaikovsky_sugarplum.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1543584756-8f40a802e14f?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Пётр Ильич Чайковский (1892), Балет «Щелкунчик»',
    licenseType: 'public_domain',
    createdAt: '2025-01-05T00:00:00.000Z',
    likes: 93,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🔔 Челеста (кристальное волшебное звучание)
🎻 Басс-кларнет и струнная группа оркестра`
  },
  {
    id: 'track_classical_mozart_serenade',
    title: '«Маленькая ночная серенада» (Allegro)',
    artist: 'В. А. Моцарт / Оркестр',
    genre: 'Классика',
    duration: 345,
    fileSize: 11000000,
    fileUrl: '/music/mozart_serenade.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Wolfgang Amadeus Mozart (1787), Serenade No. 13 in G major, K. 525',
    licenseType: 'public_domain',
    createdAt: '2025-01-06T00:00:00.000Z',
    likes: 118,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎻 Струнный ансамбль: скрипки, альты, виолончели
Знаменитая торжественная вступительная тема эпохи венского классицизма.`
  },
  {
    id: 'track_classical_chopin_nocturne',
    title: 'Ноктюрн ми-бемоль мажор (Op. 9 No. 2)',
    artist: 'Фредерик Шопен / Фортепиано',
    genre: 'Классика',
    duration: 203,
    fileSize: 3287356,
    fileUrl: '/music/chopin_nocturne_op9.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1520523839898-507127027c8e?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Frédéric Chopin (1832), Nocturne Op. 9 No. 2',
    licenseType: 'public_domain',
    createdAt: '2025-01-07T00:00:00.000Z',
    likes: 156,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎹 Концертный рояль
Нежная романтическая кантилена и знаменитые утончённые пассажи великого польского романтика.`
  },
  {
    id: 'track_classical_debussy_clair',
    title: '«Лунный свет» (Clair de Lune)',
    artist: 'Клод Дебюсси / Фортепиано',
    genre: 'Классика',
    duration: 304,
    fileSize: 15740765,
    fileUrl: '/music/debussy_clair_de_lune.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Claude Debussy (1905), Бергамасская сюита (Suite bergamasque)',
    licenseType: 'public_domain',
    createdAt: '2025-01-08T00:00:00.000Z',
    likes: 184,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎹 Фортепиано (импрессионизм)
Поэтичная звуковая акварель, мерцание лунного света и воздушная полифония.`
  },
  {
    id: 'track_classical_bach_air',
    title: 'Ария из оркестровой сюиты № 3 (Air)',
    artist: 'И. С. Бах / Струнный оркестр',
    genre: 'Классика',
    duration: 260,
    fileSize: 2758350,
    fileUrl: '/music/bach_air.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Johann Sebastian Bach (1731), Сюита для оркестра № 3 ре мажор, BWV 1068',
    licenseType: 'public_domain',
    createdAt: '2025-01-09T00:00:00.000Z',
    likes: 142,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎻 Струнный оркестр и генерал-бас (basso continuo)
Возвышенная, парящая мелодия скрипок поверх неспешного шагающего баса.`
  },
  {
    id: 'track_classical_satie_gymnopedie',
    title: 'Гимнопедия № 1 (Gymnopédie No. 1)',
    artist: 'Эрик Сати / Фортепиано',
    genre: 'Классика',
    duration: 205,
    fileSize: 1571628,
    fileUrl: '/music/satie_gymnopedie.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Erik Satie (1888), 3 Gymnopédies',
    licenseType: 'public_domain',
    createdAt: '2025-01-10T00:00:00.000Z',
    likes: 129,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎹 Фортепиано (минимализм)
Медитативное, меланхоличное покачивание аккордов и чистая хрупкая мелодия.`
  },
  {
    id: 'track_jazz_maple_rag',
    title: 'Maple Leaf Rag (Регтайм & Джаз)',
    artist: 'Скотт Джоплин / Фортепиано',
    genre: 'Джаз / Блюз',
    duration: 148,
    fileSize: 3673778,
    fileUrl: '/music/joplin_maple_rag.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'system_ordina',
    uploaderName: 'Ordina Music',
    isPublic: true,
    originalAuthorNotice: 'Scott Joplin (1899), Классический американский регтайм',
    licenseType: 'public_domain',
    createdAt: '2025-01-11T00:00:00.000Z',
    likes: 112,
    likedBy: ['system_ordina'],
    lyrics: `[Характерные инструменты]:
🎹 Синкопированное фортепиано
Задорный ритм шагающего баса и виртуозная синкопированная мелодия эпохи зарождения джаза.`
  }
];

export const DEFAULT_PUBLIC_PLAYLISTS: MusicPlaylist[] = [
  {
    id: 'pl_piano_relax',
    name: '🎹 Шедевры Фортепиано (Шопен, Дебюсси, Бетховен, Сати)',
    description: 'Ноктюрн Шопена, Лунный свет Дебюсси, Лунная соната Бетховена, Гимнопедия Сати и Регтайм',
    coverUrl: 'https://images.unsplash.com/photo-1520523839898-507127027c8e?w=600&auto=format&fit=crop&q=80',
    userId: 'system_ordina',
    trackIds: [
      'track_classical_chopin_nocturne',
      'track_classical_debussy_clair',
      'track_classical_beethoven_moonlight',
      'track_classical_satie_gymnopedie',
      'track_jazz_maple_rag'
    ],
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'pl_classical_masters',
    name: '🎻 Золотая Классика (Вивальди, Бах, Моцарт, Чайковский)',
    description: '«Времена года» (Гроза, Весна, Зима), Ария Баха, Маленькая ночная серенада и Танец феи Драже',
    coverUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600&auto=format&fit=crop&q=80',
    userId: 'system_ordina',
    trackIds: [
      'track_classical_vivaldi_summer', 
      'track_classical_vivaldi_spring', 
      'track_classical_vivaldi_winter', 
      'track_classical_bach_air', 
      'track_classical_mozart_serenade',
      'track_classical_tchaikovsky_sugarplum'
    ],
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'pl_focus_evening',
    name: '☕ Вечерний Уют & Спокойствие',
    description: 'Мягкое вдохновение для учёбы, чтения и отдыха под живое фортепиано и струнные',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    userId: 'system_ordina',
    trackIds: [
      'track_classical_debussy_clair',
      'track_classical_satie_gymnopedie',
      'track_classical_chopin_nocturne',
      'track_classical_bach_air',
      'track_classical_beethoven_moonlight'
    ],
    createdAt: '2025-01-01T00:00:00.000Z'
  }
];
