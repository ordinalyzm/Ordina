// src/components/MusicPlayerModal.tsx
// Mobile-first YouTube Music & Yandex Music style player with Genre Encyclopedia and Beginner Mode support
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Volume2, Volume1, VolumeX, Plus, Music, Disc, Heart, Search, Upload, 
  Globe, User, ListMusic, ShieldAlert, Check, Sparkles, AlertCircle,
  Share2, ArrowUpRight, FolderPlus, Radio, Flame, Trash2, Clock,
  Maximize2, Minimize2, AudioLines, FileText, ChevronRight,
  Compass, Home, Library, ListPlus, Sliders, ExternalLink, Info,
  Headphones, Guitar, Drum, Music2, Sparkle, Pin
} from 'lucide-react';
import { MusicTrack, MusicPlaylist } from '../types';
import { checkTextProfanity } from '../utils/profanityFilter';
import { uploadFileToFirestore } from '../lib/fileStorage';
import { scanDeviceAudio, readDeviceAudioData, isMusicLibraryAvailable } from '../lib/musicLibrary';
import { DEFAULT_PUBLIC_TRACKS } from '../utils/defaultMusic';
import { safeLocalStorageSet } from '../utils/safeStorage';

export interface MusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { uid: string; displayName?: string; photoURL?: string } | null;
  // Shared audio state
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  playbackMode: 'sequential' | 'shuffle';
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  currentTime: number;
  duration: number;
  playbackSpeed?: number;
  sleepTimerRemaining?: number | null;
  playlist?: MusicTrack[];
  isWaveMode?: boolean;
  waveMood?: string;
  onPlayTrack: (track: MusicTrack, playlist?: MusicTrack[]) => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (vol: number) => void;
  onSetPlaybackMode: (mode: 'sequential' | 'shuffle') => void;
  onSetRepeatMode: (mode: 'off' | 'all' | 'one') => void;
  onSetPlaybackSpeed?: (speed: number) => void;
  onSetSleepTimer?: (minutes: number | null) => void;
  onAddToQueue?: (track: MusicTrack, playNext?: boolean) => void;
  onRemoveFromQueue?: (trackId: string) => void;
  onReorderQueue?: (tracks: MusicTrack[]) => void;
  onStartMyWave?: (allTracks: MusicTrack[], mood?: string) => void;
  onStopMyWave?: () => void;
  // Tracks & Playlists state
  tracks: MusicTrack[];
  playlists: MusicPlaylist[];
  onSaveTrack: (track: MusicTrack) => Promise<void>;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onSavePlaylist: (playlist: MusicPlaylist) => Promise<void>;
  onToggleLikeTrack: (trackId: string) => void;
  onShareTrackToChat?: (track: MusicTrack) => void;
  subscriptions?: string[];
  onToggleSubscribe?: (uploaderId: string) => void;
  subscriberCounts?: Record<string, number>;
  onReportSong?: (track: MusicTrack) => void;
  onPinTrackToProfile?: (track: any) => void;
  pinnedTrackId?: string;
  initialSearch?: string;
  initialArtist?: string;
  onOpenUserProfile?: (userIdOrName: string) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export interface GenreEncyclopediaEntry {
  genre: string;
  icon: string;
  instruments: string[];
  masterpieces: { title: string; artist: string; note?: string }[];
  bpm: string;
  vibe: string;
  description: string;
}

export const GENRE_ENCYCLOPEDIA: Record<string, GenreEncyclopediaEntry> = {
  'Классика': {
    genre: 'Классика',
    icon: '🎻',
    instruments: ['Скрипка', 'Виолончель', 'Рояль / Фортепиано', 'Альт', 'Контрабас', 'Гобой', 'Флейта', 'Валторна', 'Литавры', 'Клавесин'],
    masterpieces: [
      { title: '«Времена года» (Гроза / Лето)', artist: 'Антонио Вивальди', note: 'Эталон барочного скрипичного концерта' },
      { title: '«Симфония № 5» (Та-да-да-дам)', artist: 'Людвиг ван Бетховен', note: 'Монументальная классическая гармония' },
      { title: '«Щелкунчик» (Танец феи Драже)', artist: 'П. И. Чайковский', note: 'Волшебная челеста и оркестровое изящество' },
      { title: '«Лунная соната»', artist: 'Людвиг ван Бетховен', note: 'Глубокая фортепианная лирика' },
      { title: '«Полет шмеля»', artist: 'Н. А. Римский-Корсаков', note: 'Виртуозное скоростное оркестровое исполнение' }
    ],
    bpm: '40–165 BPM',
    vibe: 'Величественный, глубокий, гармоничный, академический',
    description: 'Основа мировой музыки. Симфонический оркестр, полифония, богатейший динамический диапазон от пианиссимо до мощного тутти.'
  },
  'Рок': {
    genre: 'Рок',
    icon: '🎸',
    instruments: ['Электрогитары (Distortion / Overdrive)', 'Бас-гитара', 'Акустические барабаны', 'Клавишные / Орган Hammond'],
    masterpieces: [
      { title: '«Герой асфальта»', artist: 'Ария', note: 'Золотая классика отечественного хэви-метала и хард-рока' },
      { title: '«Группа крови»', artist: 'Кино', note: 'Культовый пост-панк и русский рок' },
      { title: '«Bohemian Rhapsody»', artist: 'Queen', note: 'Рок-опера с гитарными риффами Брайана Мэя' },
      { title: '«Smoke on the Water»', artist: 'Deep Purple', note: 'Один из самых узнаваемых гитарных риффов в истории' },
      { title: '«Лесник»', artist: 'Король и Шут', note: 'Панк-рок и сказочный фолк-драйв' },
      { title: '«Back In Black»', artist: 'AC/DC', note: 'Эталон жесткого гитарного грува' }
    ],
    bpm: '110–145 BPM',
    vibe: 'Драйвовый, бунтарский, мощный, эмоциональный',
    description: 'Энергичный ритм с акцентом на вторую и четвертую доли (бэкбит), плотный перегруз электрогитар, соло-партии и пронзительный вокал.'
  },
  'Фонк': {
    genre: 'Фонк',
    icon: '🏎️',
    instruments: ['808 Cowbell (перегруженный колокол)', 'Искаженный 808 Sub-Bass', 'Драм-машина Roland TR-808', 'Мемфис-акапеллы (Memphis Rap Chops)'],
    masterpieces: [
      { title: '«Murder In My Mind»', artist: 'Kordhell', note: 'Главный мировой гимн дрифт-фонка' },
      { title: '«Metamorphosis»', artist: 'Interworld', note: 'Темный гипнотический 808 бас и колокольчики' },
      { title: '«Close Eyes»', artist: 'DVRST', note: 'Мелодичный атмосферный фонк' },
      { title: '«GigaChad Theme (Phonk Remix)»', artist: 'g3ox_em', note: 'Вирусный интернет-феномен' }
    ],
    bpm: '140–165 BPM',
    vibe: 'Ночной, агрессивный, подпольный, адреналин и дрифт',
    description: 'Жанр, зародившийся из мемфис-рэпа 90-х и ставший саундтреком ночного дрифта. Характеризуется грязным басом и пронзительным колокольчиком 808 Cowbell.'
  },
  'Lo-Fi': {
    genre: 'Lo-Fi',
    icon: '☕',
    instruments: ['Электропианино Rhodes', 'Винтажный винил (треск иглы)', 'Приглушенные ударные Boom-Bap', 'Теплая акустическая гитара'],
    masterpieces: [
      { title: '«beats to relax/study to»', artist: 'Lofi Girl / ChilledCow', note: 'Главный символ всемирного лоу-фай движения' },
      { title: '«Affection»', artist: 'Jinsang', note: 'Ностальгический расслабляющий хип-хоп' },
      { title: '«Controlla»', artist: 'Idealism', note: 'Мягкий винил и нежные джазовые клавиши' },
      { title: '«Warm Rain & Coffee»', artist: 'Lofi Chillhop Collective', note: 'Идеальный саундтрек для концентрации' }
    ],
    bpm: '70–88 BPM',
    vibe: 'Уютный, ламповый, спокойный, для учебы и отдыха',
    description: 'Низкобюджетное аналоговое звучание с намеренным сохранением несовершенств: треска пластинки, детонации магнитофонной ленты и теплого баса.'
  },
  'Поп': {
    genre: 'Поп',
    icon: '🎙️',
    instruments: ['Синтезаторы', 'Драм-машины', 'Обработанный поп-вокал (Autotune, Harmonizer)', 'Электрогитара', 'Бас-синтезатор'],
    masterpieces: [
      { title: '«Billie Jean»', artist: 'Michael Jackson', note: 'Безупречный поп-фанк бас и вокал' },
      { title: '«Blinding Lights»', artist: 'The Weeknd', note: 'Синти-поп хит мирового масштаба' },
      { title: '«Седая ночь»', artist: 'Юрий Шатунов / Ласковый май', note: 'Бессмертный советский и российский евродиско-хит' },
      { title: '«Shape of You»', artist: 'Ed Sheeran', note: 'Акустический поп с луп-станцией' }
    ],
    bpm: '100–128 BPM',
    vibe: 'Танцевальный, запоминающийся, светлый, припевный',
    description: 'Музыка, ориентированная на максимальную запоминаемость мелодии (хука), танцевальный ритм и кристальную чистоту современного сведения.'
  },
  'Хип-хоп / Рэп': {
    genre: 'Хип-хоп / Рэп',
    icon: '🎤',
    instruments: ['Сэмплер Akai MPC', '808 Sub-Bass', 'Hi-Hat трели', 'Виниловый скретч', 'Плотная бочка (Kick)'],
    masterpieces: [
      { title: '«Lose Yourself»', artist: 'Eminem', note: 'Оскароносный гимн целеустремленности' },
      { title: '«California Love»', artist: '2Pac ft. Dr. Dre', note: 'Золотая эра вест-кост джи-фанка' },
      { title: '«Город дорог»', artist: 'Centr / Баста / Гуф', note: 'Фундаментальный русский хип-хоп 2000-х' },
      { title: '«Gangsta\'s Paradise»', artist: 'Coolio', note: 'Атмосферный хор и легендарный речитатив' }
    ],
    bpm: '85–95 (Бум-бэп) / 130–150 (Трэп) BPM',
    vibe: 'Качающий, ритмичный, уличный, рифмованный',
    description: 'Культура ритмичного речитатива (флоу) поверх сэмплированного бита или плотного трэп-баса.'
  },
  'Электроника': {
    genre: 'Электроника',
    icon: '⚡',
    instruments: ['Аналоговые синтезаторы (Juno-106, Minimoog)', 'Драм-машины (Roland TR-909)', 'Арпеджиаторы', 'Вокодер'],
    masterpieces: [
      { title: '«Around the World»', artist: 'Daft Punk', note: 'Французский фильтр-хаус и вечный бас' },
      { title: '«Resonance»', artist: 'HOME', note: 'Синтвейв шедевр ностальгической электроники' },
      { title: '«Breathe»', artist: 'The Prodigy', note: 'Взрывной брейкбит и биг-бит 90-х' },
      { title: '«Animals»', artist: 'Martin Garrix', note: 'Энергичный клубный EDM гимн' }
    ],
    bpm: '120–135 BPM',
    vibe: 'Футуристичный, неоновый, космический, клубный',
    description: 'Электронный пульсирующий звук с развитием трека через нарастания (билд-апы) и взрывные падения (дропы).'
  },
  'Инди': {
    genre: 'Инди',
    icon: '🌿',
    instruments: ['Полуакустическая гитара', 'Винтажные аналоговые клавиши', 'Живой бас', 'Ксилофон', 'Мечтательный реверберированный вокал'],
    masterpieces: [
      { title: '«Do I Wanna Know?»', artist: 'Arctic Monkeys', note: 'Тягучий гитарный инди-рок с мощным риффом' },
      { title: '«Somebody That I Used to Know»', artist: 'Gotye', note: 'Акустический арт-поп и ксилофон' },
      { title: '«Sweater Weather»', artist: 'The Neighbourhood', note: 'Атмосферный инди-поп о юности' }
    ],
    bpm: '95–125 BPM',
    vibe: 'Меланхоличный, независимый, искренний, романтичный',
    description: 'Самобытный звук независимых музыкантов, свободный от коммерческих шаблонов крупных лейблов.'
  },
  'Метал': {
    genre: 'Метал',
    icon: '🤘',
    instruments: ['7-струнные гитары', 'Хай-гейн дисторшн', 'Двойная бас-бочка (кардан)', 'Агрессивный бас', 'Экстрим-вокал (гроул/скрим)'],
    masterpieces: [
      { title: '«Master of Puppets»', artist: 'Metallica', note: 'Вершина трэш-метала со сложными сменами темпа' },
      { title: '«Я свободен»', artist: 'Кипелов', note: 'Величайшая рок-метал баллада на русском языке' },
      { title: '«The Trooper»', artist: 'Iron Maiden', note: 'Галопирующий бас Стива Харриса' },
      { title: '«Du Hast»', artist: 'Rammstein', note: 'Индастриал-метал с железным машинным ритмом' }
    ],
    bpm: '130–220+ BPM',
    vibe: 'Взрывной, экстремальный, бушующий, виртуозный',
    description: 'Скоростные риффы, двойная педаль ударных, предельный перегруз усилителей и невероятная концертная мощь.'
  },
  'Джаз / Блюз': {
    genre: 'Джаз / Блюз',
    icon: '🎷',
    instruments: ['Саксофон (альт/тенор)', 'Труба', 'Рояль', 'Контрабас (пиццикато)', 'Полуакустическая гитара (Gibson ES)', 'Щеточки на барабане'],
    masterpieces: [
      { title: '«Take Five»', artist: 'The Dave Brubeck Quartet', note: 'Легендарный джаз в нестандартном размере 5/4' },
      { title: '«What a Wonderful World»', artist: 'Louis Armstrong', note: 'Хриплый теплый вокал и труба Сачмо' },
      { title: '«The Thrill Is Gone»', artist: 'B.B. King', note: 'Королевский блюз и гитара Люсиль' },
      { title: '«Autumn Leaves»', artist: 'Miles Davis', note: 'Прохладный модальный джаз' }
    ],
    bpm: '60–180 BPM',
    vibe: 'Изысканный, дымный, импровизационный, душевный',
    description: 'Свинг, блюзовая сетка, септаккорды и искусство спонтанной живой импровизации прямо на сцене.'
  },
  'R&B / Соул': {
    genre: 'R&B / Соул',
    icon: '✨',
    instruments: ['Электроорган Wurlitzer', 'Духовая секция', 'Слэп-бас', 'Бэк-вокальные гармонии', 'Мягкий грув'],
    masterpieces: [
      { title: '«Superstition»', artist: 'Stevie Wonder', note: 'Фанковый клавинет и соул-энергия' },
      { title: '«Hit the Road Jack»', artist: 'Ray Charles', note: 'Классика ритм-н-блюза' },
      { title: '«Stand by Me»', artist: 'Ben E. King', note: 'Искренняя душевная гармония' }
    ],
    bpm: '70–105 BPM',
    vibe: 'Чувственный, бархатный, глубокий, вокальный',
    description: 'Чувственный вокал с мелизмами, глубокие эмоции, богатая гармония и согревающий ритм.'
  },
  'Саундтрек': {
    genre: 'Саундтрек',
    icon: '🎬',
    instruments: ['Полный симфонический оркестр', 'Taiko drums', 'Кинематографический брасс', 'Эпический хор', 'Синтезаторные пэды'],
    masterpieces: [
      { title: '«Time» (Интерстеллар)', artist: 'Hans Zimmer', note: 'Нарастающее космическое крещендо и орган' },
      { title: '«The Imperial March» (Звездные войны)', artist: 'John Williams', note: 'Грозная симфоническая мощь медных духовых' },
      { title: '«Requiem for a Dream»', artist: 'Clint Mansell / Kronos Quartet', note: 'Пронизывающие струнные' },
      { title: '«The Good, the Bad and the Ugly»', artist: 'Ennio Morricone', note: 'Свист, окарина и спагетти-вестерн' }
    ],
    bpm: 'Переменный (50–160 BPM)',
    vibe: 'Эпический, драматичный, кинематографичный, волнующий',
    description: 'Музыка великих историй кино. Создает масштаб, атмосферу и эмоциональный накал, переносящий в другие миры.'
  }
};

const MUSIC_GENRES = [
  'Все жанры',
  'Поп',
  'Рок',
  'Хип-хоп / Рэп',
  'Электроника',
  'Lo-Fi',
  'Фонк',
  'Инди',
  'R&B / Соул',
  'Классика',
  'Саундтрек',
  'Джаз / Блюз',
  'Метал',
  'Другое'
];

const YOUTUBE_MOOD_CHIPS = [
  { id: 'all', label: 'Все' },
  { id: 'wave', label: '🌊 Моя волна', highlight: true },
  { id: 'relax', label: '☕ Релакс' },
  { id: 'energy', label: '⚡ Энергия' },
  { id: 'phonk', label: '🏎️ Фонк и Дрифт' },
  { id: 'drive', label: '🌃 В дорогу' },
  { id: 'focus', label: '🎧 Фокус / Lo-Fi' },
  { id: 'favorites', label: '❤️ Любимое' }
];

export const MusicPlayerModal: React.FC<MusicPlayerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentTrack,
  isPlaying,
  playbackMode,
  repeatMode,
  volume,
  currentTime,
  duration,
  playbackSpeed = 1.0,
  sleepTimerRemaining = null,
  playlist = [],
  isWaveMode = false,
  waveMood = 'all',
  onPlayTrack,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onSetVolume,
  onSetPlaybackMode,
  onSetRepeatMode,
  onSetPlaybackSpeed,
  onSetSleepTimer,
  onAddToQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onStartMyWave,
  onStopMyWave,
  tracks,
  playlists,
  onSaveTrack,
  onDeleteTrack,
  onSavePlaylist,
  onToggleLikeTrack,
  onShareTrackToChat,
  subscriptions = [],
  onToggleSubscribe,
  subscriberCounts = {},
  onReportSong,
  onPinTrackToProfile,
  pinnedTrackId,
  initialSearch,
  initialArtist,
  onOpenUserProfile,
  addToast,
}) => {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'library' | 'player' | 'channel'>('home');
  const [librarySubTab, setLibrarySubTab] = useState<'all' | 'liked' | 'playlists' | 'my' | 'public' | 'creator_studio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Все жанры');
  const [selectedMoodChip, setSelectedMoodChip] = useState('all');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Pin track modal confirmation
  const [pinModalTrack, setPinModalTrack] = useState<MusicTrack | null>(null);

  useEffect(() => {
    if (initialArtist) {
      setSearchQuery(initialArtist);
      setActiveTab('explore');
    } else if (initialSearch) {
      setSearchQuery(initialSearch);
      setActiveTab('explore');
    }
  }, [initialArtist, initialSearch]);

  // Genre Details Inspector Sheet/Modal
  const [inspectedGenre, setInspectedGenre] = useState<GenreEncyclopediaEntry | null>(null);

  // Fullscreen state: remembers preference
  const [isFullscreen, setIsFullscreen] = useState(() => {
    try {
      return localStorage.getItem('ordina_music_fullscreen') === 'true';
    } catch {
      return false;
    }
  });

  const toggleFullscreen = () => {
    setIsFullscreen(prev => {
      const next = !prev;
      safeLocalStorageSet('ordina_music_fullscreen', String(next));
      return next;
    });
  };

  // Player view sub-tab: 'lyrics' or 'queue'
  const [playerPanel, setPlayerPanel] = useState<'queue' | 'lyrics'>('queue');
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  // Upload Questionnaire Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'my' | 'public'>('my');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAudioDuration, setUploadAudioDuration] = useState<number>(0);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadGenre, setUploadGenre] = useState('Поп');
  const [uploadPlaylistName, setUploadPlaylistName] = useState('');
  const [uploadOriginalAuthor, setUploadOriginalAuthor] = useState('');
  const [uploadLicenseType, setUploadLicenseType] = useState('cover_remix');
  const [uploadConfirmedNoProfanity, setUploadConfirmedNoProfanity] = useState(false);
  const [uploadCoverFile, setUploadCoverFile] = useState<File | null>(null);
  const [uploadCoverPreview, setUploadCoverPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // New Playlist Modal State
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  // Add to Playlist picker state
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<MusicTrack | null>(null);

  // AI Music Scanner state
  const [showAiScannerModal, setShowAiScannerModal] = useState(false);
  const [isScanningPhoneMusic, setIsScanningPhoneMusic] = useState(false);
  const [isImportingScanned, setIsImportingScanned] = useState(false);
  const [scannedPhoneTracks, setScannedPhoneTracks] = useState<MusicTrack[]>([]);
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);

  const handleRunAiMusicScan = async () => {
    setShowAiScannerModal(true);
    setIsScanningPhoneMusic(true);
    setScannedPhoneTracks([]);
    setSelectedScanIds([]);
    try {
      if (!isMusicLibraryAvailable()) {
        addToast('Сканирование фонотеки доступно только в приложении на телефоне', 'info');
        return;
      }

      // 1. Читаем реальную аудиотеку устройства (треки длиннее 25 секунд)
      const deviceTracks = (await scanDeviceAudio(25000)).filter(t => !t.tooLarge);
      if (deviceTracks.length === 0) {
        addToast('Не найдено аудио длиннее 25 секунд на устройстве', 'info');
        return;
      }

      // 2. Определяем жанр и вайб через ИИ (по названию и автору)
      let analyzed: any[] = [];
      try {
        const res = await fetch('/api/music/ai-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: deviceTracks.map(t => ({ title: t.title, artist: t.artist }))
          })
        });
        if (res.ok) {
          const data = await res.json();
          analyzed = data.scannedTracks || [];
        }
      } catch {}

      // 3. Собираем предпросмотр: реальные данные телефона + жанр от ИИ
      const preview: MusicTrack[] = deviceTracks.map((t, idx) => {
        const ai = analyzed[idx] || {};
        return {
          id: `device_${t.id}`,
          title: t.title,
          artist: t.artist,
          genre: ai.genre || 'Не определён',
          fileUrl: '',
          duration: Math.round(t.durationMs / 1000),
          fileSize: t.size,
          coverUrl: ai.coverUrl,
          uploaderId: currentUser?.uid || 'user_guest',
          uploaderName: currentUser?.displayName || 'Мой канал',
          isPublic: false,
          createdAt: new Date().toISOString(),
          likes: 0,
          likedBy: [],
          deviceId: t.id,
          mimeType: t.mimeType,
          aiMood: ai.aiMood,
          aiBpm: ai.aiBpm,
          aiDescription: ai.aiDescription
        } as MusicTrack;
      });

      setScannedPhoneTracks(preview);
      setSelectedScanIds(preview.map(t => t.id));
    } catch (e: any) {
      addToast(e?.message || 'Не удалось просканировать музыку с телефона', 'error');
    } finally {
      setIsScanningPhoneMusic(false);
    }
  };

  const handleImportScannedTracks = async () => {
    const toImport = scannedPhoneTracks.filter(t => selectedScanIds.includes(t.id));
    if (toImport.length === 0) return;

    setIsImportingScanned(true);
    let imported = 0;
    let failed = 0;

    for (const t of toImport) {
      try {
        const fileData = await readDeviceAudioData((t as any).deviceId, (t as any).mimeType);
        if (!fileData) {
          failed++;
          continue;
        }
        const fileUrl = `data:${fileData.mimeType || 'audio/mpeg'};base64,${fileData.data}`;
        const track: MusicTrack = {
          ...t,
          fileUrl,
          uploaderId: currentUser?.uid || 'user_guest',
          uploaderName: currentUser?.displayName || 'Мой канал'
        };
        delete (track as any).deviceId;
        await onSaveTrack(track);
        imported++;
      } catch {
        failed++;
      }
    }

    setIsImportingScanned(false);
    addToast(
      failed > 0
        ? `Импортировано: ${imported}, не удалось: ${failed}`
        : `Успешно импортировано треков: ${imported} ✓`,
      imported > 0 ? 'success' : 'error'
    );
    if (imported > 0) setShowAiScannerModal(false);
  };

  // Seekbar scrub state
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragSeekTime, setDragSeekTime] = useState(0);

  // Format mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSubscribersCount = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return `${count} подписчиков`;
    if (mod10 === 1) return `${count} подписчик`;
    if (mod10 >= 2 && mod10 <= 4) return `${count} подписчика`;
    return `${count} подписчиков`;
  };

  // Safe non-empty tracks fallback (guarantees NO memory lapse)
  const safeTracks = useMemo(() => {
    if (Array.isArray(tracks) && tracks.length > 0) return tracks;
    return DEFAULT_PUBLIC_TRACKS;
  }, [tracks]);

  // Audio inspect helper
  const inspectAudioFile = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const objUrl = URL.createObjectURL(file);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(objUrl);
        resolve(audio.duration || 0);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Не удалось прочитать аудиофайл. Проверьте формат.'));
      };
      audio.src = objUrl;
    });
  };

  // Keyboard hotkeys
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        onSetVolume(volume > 0 ? 0 : 0.85);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + 5));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - 5));
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        onNextTrack();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        onPrevTrack();
      } else if (e.code === 'Escape') {
        if (inspectedGenre) {
          setInspectedGenre(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
          safeLocalStorageSet('ordina_music_fullscreen', 'false');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onTogglePlay, toggleFullscreen, onSetVolume, volume, onSeek, duration, currentTime, onNextTrack, onPrevTrack, isFullscreen, onClose, inspectedGenre]);

  // Handle file picker for track
  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('Аудиофайл слишком большой. Максимальный размер 25 МБ.');
      return;
    }

    try {
      setUploadError(null);
      const audioDur = await inspectAudioFile(file);
      
      if (audioDur < 25) {
        setUploadError(`Файл слишком короткий (${Math.round(audioDur)} сек.). Музыкальная библиотека принимает треки длительностью более 25 секунд.`);
        return;
      }

      setUploadFile(file);
      setUploadAudioDuration(audioDur);

      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      if (!uploadTitle) {
        if (cleanName.includes(' - ')) {
          const parts = cleanName.split(' - ');
          setUploadArtist(parts[0].trim());
          setUploadTitle(parts.slice(1).join(' - ').trim());
        } else {
          setUploadTitle(cleanName);
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'Ошибка обработки аудиофайла');
    }
  };

  // Handle Cover Art file
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('Обложка не должна превышать 5 МБ', 'error');
      return;
    }
    setUploadCoverFile(file);
    setUploadCoverPreview(URL.createObjectURL(file));
  };

  // Submit track upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !uploadFile) return;

    if (!uploadTitle.trim()) {
      setUploadError('Укажите название трека');
      return;
    }

    if (!uploadArtist.trim()) {
      setUploadError('Укажите исполнителя или автора трека');
      return;
    }

    if (uploadAudioDuration < 25) {
      setUploadError('Трек должен быть длительнее 25 секунд');
      return;
    }

    if (uploadTarget === 'public') {
      const titleCheck = checkTextProfanity(uploadTitle);
      if (titleCheck.hasProfanity) {
        setUploadError(titleCheck.reason || 'В названии обнаружена ненормативная лексика');
        return;
      }
      const artistCheck = checkTextProfanity(uploadArtist);
      if (artistCheck.hasProfanity) {
        setUploadError(artistCheck.reason || 'В имени исполнителя обнаружена ненормативная лексика');
        return;
      }
      if (!uploadConfirmedNoProfanity) {
        setUploadError('Подтвердите отсутствие нецензурной лексики для публикации в общую библиотеку');
        return;
      }
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      addToast('Загрузка аудиофайла в библиотеку...', 'info');

      const fileUrl = await uploadFileToFirestore(uploadFile, currentUser.uid);

      let coverUrl: string | undefined = undefined;
      if (uploadCoverFile) {
        coverUrl = await uploadFileToFirestore(uploadCoverFile, currentUser.uid);
      }

      let playlistId: string | undefined = undefined;
      if (uploadPlaylistName.trim()) {
        const existingPl = playlists.find(p => p.name.toLowerCase() === uploadPlaylistName.trim().toLowerCase());
        if (existingPl) {
          playlistId = existingPl.id;
        } else {
          const newPl: MusicPlaylist = {
            id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: uploadPlaylistName.trim(),
            userId: currentUser.uid,
            trackIds: [],
            createdAt: new Date().toISOString()
          };
          await onSavePlaylist(newPl);
          playlistId = newPl.id;
        }
      }

      const newTrack: MusicTrack = {
        id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: uploadTitle.trim(),
        artist: uploadArtist.trim(),
        genre: uploadGenre,
        duration: Math.round(uploadAudioDuration),
        fileSize: uploadFile.size,
        fileUrl,
        coverUrl,
        playlistId,
        playlistName: uploadPlaylistName.trim() || undefined,
        uploaderId: currentUser.uid,
        uploaderName: currentUser.displayName || 'Пользователь',
        isPublic: uploadTarget === 'public',
        originalAuthorNotice: uploadOriginalAuthor.trim() || undefined,
        licenseType: uploadLicenseType,
        hasProfanityWarning: false,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: []
      };

      await onSaveTrack(newTrack);

      if (playlistId) {
        const pl = playlists.find(p => p.id === playlistId);
        if (pl) {
          const updatedTrackIds = [...(pl.trackIds || []), newTrack.id];
          await onSavePlaylist({ ...pl, trackIds: updatedTrackIds });
        }
      }

      addToast(
        uploadTarget === 'public' 
          ? 'Трек успешно опубликован в общую библиотеку!' 
          : 'Трек добавлен в вашу библиотеку!', 
        'success'
      );

      // Reset form
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadAudioDuration(0);
      setUploadTitle('');
      setUploadArtist('');
      setUploadPlaylistName('');
      setUploadOriginalAuthor('');
      setUploadCoverFile(null);
      setUploadCoverPreview(null);
      setUploadConfirmedNoProfanity(false);
    } catch (err: any) {
      setUploadError(err.message || 'Ошибка загрузки трека');
      addToast('Ошибка загрузки трека', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Create New Playlist
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newPlaylistTitle.trim()) return;

    try {
      const newPl: MusicPlaylist = {
        id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: newPlaylistTitle.trim(),
        description: newPlaylistDesc.trim() || undefined,
        userId: currentUser.uid,
        trackIds: [],
        createdAt: new Date().toISOString()
      };
      await onSavePlaylist(newPl);
      addToast(`Плейлист "${newPl.name}" создан`, 'success');
      setShowNewPlaylistModal(false);
      setNewPlaylistTitle('');
      setNewPlaylistDesc('');
    } catch {
      addToast('Не удалось создать плейлист', 'error');
    }
  };

  // Add track to playlist helper
  const handleAddTrackToPlaylist = async (plId: string, trackId: string) => {
    const pl = playlists.find(p => p.id === plId);
    if (!pl) return;
    const trackIds = pl.trackIds || [];
    if (trackIds.includes(trackId)) {
      addToast('Трек уже есть в этом плейлисте', 'info');
      setAddToPlaylistTrack(null);
      return;
    }
    await onSavePlaylist({ ...pl, trackIds: [...trackIds, trackId] });
    addToast(`Трек добавлен в "${pl.name}"`, 'success');
    setAddToPlaylistTrack(null);
  };

  // User liked tracks
  const likedTracks = useMemo(() => {
    if (!currentUser) return [];
    return safeTracks.filter(t => t.likedBy?.includes(currentUser.uid));
  }, [safeTracks, currentUser]);

  const myTracks = useMemo(() => {
    if (!currentUser) return [];
    return safeTracks.filter(t => t.uploaderId === currentUser.uid);
  }, [safeTracks, currentUser]);

  const publicTracks = useMemo(() => {
    return safeTracks.filter(t => t.isPublic);
  }, [safeTracks]);

  // Mood filter handler
  const handleMoodChipClick = (chipId: string) => {
    setSelectedMoodChip(chipId);
    if (chipId === 'wave') {
      if (onStartMyWave) {
        onStartMyWave(safeTracks, 'all');
        addToast('🌊 Моя волна включена!', 'success');
      }
      return;
    }
    if (chipId === 'relax') {
      setSelectedGenre('Lo-Fi');
    } else if (chipId === 'energy') {
      setSelectedGenre('Рок');
    } else if (chipId === 'phonk') {
      setSelectedGenre('Фонк');
    } else if (chipId === 'drive') {
      setSelectedGenre('Электроника');
    } else if (chipId === 'focus') {
      setSelectedGenre('Lo-Fi');
    } else if (chipId === 'favorites') {
      setActiveTab('library');
      setLibrarySubTab('liked');
      setSelectedGenre('Все жанры');
    } else {
      setSelectedGenre('Все жанры');
    }
  };

  // Displayed tracks for library tab
  const displayedTracks = useMemo(() => {
    let list: MusicTrack[] = [];
    if (librarySubTab === 'liked') {
      list = likedTracks;
    } else if (librarySubTab === 'my') {
      list = myTracks;
    } else if (librarySubTab === 'public') {
      list = publicTracks;
    } else {
      list = safeTracks;
    }

    if (selectedGenre !== 'Все жанры') {
      list = list.filter(t => t.genre === selectedGenre);
    }

    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (pl) {
        list = list.filter(t => t.playlistId === pl.id || pl.trackIds?.includes(t.id));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.artist.toLowerCase().includes(q) || 
        t.genre.toLowerCase().includes(q) ||
        (t.playlistName && t.playlistName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [librarySubTab, likedTracks, myTracks, publicTracks, safeTracks, selectedGenre, selectedPlaylistId, searchQuery, playlists]);

  // Color generator for track covers
  const getTrackGradient = (title: string) => {
    const gradients = [
      'from-rose-600 via-orange-600 to-amber-500',
      'from-violet-700 via-purple-600 to-indigo-600',
      'from-emerald-600 via-teal-600 to-cyan-600',
      'from-fuchsia-600 via-pink-600 to-rose-500',
      'from-blue-600 via-cyan-600 to-sky-500',
      'from-amber-600 via-red-600 to-pink-600',
      'from-purple-700 via-indigo-600 to-blue-600'
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash += title.charCodeAt(i);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Quick picks: 8 popular tracks
  const quickPicks = useMemo(() => {
    return [...safeTracks].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 8);
  }, [safeTracks]);

  // "Моя волна" launcher trigger
  const triggerMyWave = (mood: string = 'all') => {
    if (onStartMyWave) {
      onStartMyWave(safeTracks, mood);
      addToast(`🌊 Моя волна запущена (${mood === 'all' ? 'Любое' : mood})`, 'success');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className={
          isFullscreen 
            ? "fixed inset-0 z-[10000] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden"
            : "fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none"
        }
        onClick={isFullscreen ? undefined : onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: isFullscreen ? 1 : 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className={
            isFullscreen 
              ? "w-full h-full flex flex-col bg-slate-950 text-white relative overflow-hidden"
              : "bg-slate-950 text-white rounded-none sm:rounded-3xl w-full max-w-6xl h-full sm:h-[94vh] flex flex-col shadow-2xl border-0 sm:border border-slate-800/80 overflow-hidden relative"
          }
          onClick={e => e.stopPropagation()}
        >
          {/* ======================================================== */}
          {/* 1. TOP HEADER BAR (APP-MATCHING TOP SAFE AREA CUTOUT)    */}
          {/* ======================================================== */}
          <header className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-20 pt-[calc(12px+env(safe-area-inset-top,0px))] pl-[max(env(safe-area-inset-left,0px),12px)] pr-[max(env(safe-area-inset-right,0px),12px)]">
            {/* Logo + Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-600/25 shrink-0">
                <Music size={18} className={isPlaying ? "animate-pulse" : ""} />
              </div>
              <div>
                <h1 className="font-black text-sm sm:text-base tracking-tight text-white flex items-center gap-1">
                  Ordina <span className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">Музыка</span>
                </h1>
                <p className="text-[10px] text-slate-400 hidden xs:block">
                  {safeTracks.length} треков • Pro
                </p>
              </div>
            </div>

            {/* Central Search Bar */}
            <div className="flex-1 max-w-xl mx-1 sm:mx-auto">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск треков, жанров..."
                  className="w-full bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-800 text-xs sm:text-sm text-white placeholder-slate-400 pl-8 sm:pl-9 pr-8 py-1.5 sm:py-2 rounded-full border border-slate-700/60 focus:border-red-500/60 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Right Top Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {currentUser && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all active:scale-95"
                  title="Загрузить трек"
                >
                  <Plus size={15} className="text-red-400" />
                  <span className="hidden md:inline">Загрузить</span>
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 hidden sm:block"
                title={isFullscreen ? "Свернуть в окно (F)" : "На весь экран (F)"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button
                onClick={onClose}
                className="p-2.5 rounded-full bg-slate-800/90 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition-all active:scale-95 flex items-center justify-center"
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* ======================================================== */}
          {/* 2. DESKTOP TABS & MOBILE MOOD CHIPS                      */}
          {/* ======================================================== */}
          <div className="border-b border-slate-800/80 bg-slate-900/60 px-3 sm:px-6 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 pl-[max(env(safe-area-inset-left,0px),12px)] pr-[max(env(safe-area-inset-right,0px),12px)]">
            {/* Desktop Tabs (Hidden on small mobile, where bottom nav is active) */}
            <nav className="hidden sm:flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
              {[
                { id: 'home', label: 'Главная', icon: Home },
                { id: 'explore', label: 'Навигатор & Жанры', icon: Compass },
                { id: 'library', label: 'Библиотека', icon: Library, count: safeTracks.length },
                { id: 'channel', label: 'Мой канал', icon: User },
                { id: 'player', label: 'Плеер & Очередь', icon: Disc, live: isPlaying }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={14} className={tab.live ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Mood Filter Chips (Horizontal swipe on mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0 touch-pan-x">
              {YOUTUBE_MOOD_CHIPS.map(chip => {
                const isSelected = selectedMoodChip === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => handleMoodChipClick(chip.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border shrink-0 ${
                      isSelected
                        ? 'bg-white text-black border-white font-bold shadow-sm'
                        : chip.highlight
                          ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700/50 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. MAIN BODY CONTENT TABS                                */}
          {/* ======================================================== */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 space-y-6 pb-[calc(140px+env(safe-area-inset-bottom,0px))]">
            {/* ------------------------------------------------------ */}
            {/* TAB 1: ГЛАВНАЯ (HOME) - "Моя волна" & Quick Picks      */}
            {/* ------------------------------------------------------ */}
            {activeTab === 'home' && (
              <div className="space-y-6 max-w-7xl mx-auto">
                
                {/* 🌊 YANDEX MUSIC "МОЯ ВОЛНА" HERO CARD */}
                <div className="relative overflow-hidden rounded-3xl p-5 sm:p-8 bg-gradient-to-r from-red-950/80 via-purple-950/70 to-slate-900 border border-red-500/20 shadow-2xl">
                  {/* Ambient glowing orbs */}
                  <div className="absolute top-0 right-0 w-60 h-60 bg-red-600/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
                  <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
                    <div className="space-y-2.5 text-center md:text-left max-w-xl">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold">
                        <Sparkles size={13} className="animate-spin" style={{ animationDuration: '6s' }} />
                        <span>Бесконечный поток «Моя волна»</span>
                      </div>
                      <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                        Музыка под ваше настроение
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Умный алгоритм непрерывно подбирает треки по выбранному вайбу без рекламы и остановок.
                      </p>

                      {/* Mood vibe buttons */}
                      <div className="flex flex-wrap gap-1.5 pt-1 justify-center md:justify-start">
                        {[
                          { id: 'all', label: '✨ Любое' },
                          { id: 'chill', label: '☕ Спокойное' },
                          { id: 'energy', label: '⚡ Драйв' },
                          { id: 'phonk', label: '🏎️ Фонк' },
                          { id: 'pop', label: '🎉 Бодрое' }
                        ].map(mood => (
                          <button
                            key={mood.id}
                            onClick={() => triggerMyWave(mood.id)}
                            className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all active:scale-95"
                          >
                            {mood.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Big Wave Action Button & Audio visualizer */}
                    <div className="flex flex-col items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          if (isWaveMode && isPlaying) {
                            onTogglePlay();
                          } else {
                            triggerMyWave('all');
                          }
                        }}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-amber-400 hover:from-red-500 hover:to-amber-300 text-white flex items-center justify-center shadow-xl shadow-red-600/40 transition-all active:scale-95 group relative"
                        title={isWaveMode && isPlaying ? "Пауза" : "Включить Мою волну"}
                      >
                        {isWaveMode && isPlaying ? (
                          <Pause size={28} className="fill-current" />
                        ) : (
                          <Play size={28} className="fill-current translate-x-1" />
                        )}
                        <div className="absolute inset-0 rounded-full border-2 border-red-400/40 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
                      </button>

                      <div className="text-center">
                        <span className="text-xs font-bold text-slate-200">
                          {isWaveMode ? 'Волна активна' : 'Включить волну'}
                        </span>
                        {/* Sound equalizer bars */}
                        <div className="flex items-end justify-center gap-1 h-3.5 mt-1">
                          {[40, 75, 100, 60, 90, 50, 80, 65].map((h, i) => (
                            <span 
                              key={i} 
                              className={`w-0.5 sm:w-1 bg-red-400 rounded-full transition-all duration-300 ${isPlaying && isWaveMode ? 'animate-pulse' : 'opacity-40'}`} 
                              style={{ height: isPlaying && isWaveMode ? `${h}%` : '25%' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ⚡ БЫСТРЫЙ ВЫБОР (QUICK PICKS - MOBILE COMPACT) */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-400">Быстрый выбор</p>
                      <h3 className="text-lg sm:text-xl font-black text-white">Рекомендации для вас</h3>
                    </div>
                    <button 
                      onClick={() => setActiveTab('explore')}
                      className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>Все жанры</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {quickPicks.map(track => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isLiked = currentUser && track.likedBy?.includes(currentUser.uid);
                      return (
                        <div
                          key={track.id}
                          className={`p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer border ${
                            isCurrent
                              ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/10'
                              : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/60 active:scale-[0.99]'
                          }`}
                          onClick={() => onPlayTrack(track, quickPicks)}
                        >
                          <div className={`w-12 h-12 rounded-xl overflow-hidden relative shrink-0 bg-gradient-to-tr ${getTrackGradient(track.title)} flex items-center justify-center shadow-md`}>
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Disc size={20} className={`text-white ${isCurrent && isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                            )}
                            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                              isCurrent ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                            }`}>
                              {isCurrent && isPlaying ? (
                                <Pause size={16} className="text-white fill-current" />
                              ) : (
                                <Play size={16} className="text-white fill-current translate-x-0.5" />
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p 
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (onOpenUserProfile) {
                                  onOpenUserProfile(track.uploaderId || track.artist);
                                }
                              }}
                              className="text-[11px] text-slate-400 hover:text-red-400 hover:underline cursor-pointer truncate"
                              title="Открыть профиль автора"
                            >
                              {track.artist}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {formatTime(track.duration)} • {track.genre}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onPinTrackToProfile && (track.duration === undefined || track.duration >= 25) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinModalTrack(track);
                                }}
                                className={`p-2 rounded-full transition-all shrink-0 ${
                                  pinnedTrackId === track.id ? 'text-amber-400 bg-amber-400/20' : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'
                                }`}
                                title={pinnedTrackId === track.id ? "Закреплен в вашем профиле" : "Закрепить в профиле (>25 сек)"}
                              >
                                <Pin size={15} className={pinnedTrackId === track.id ? "fill-current" : ""} />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLikeTrack(track.id);
                              }}
                              className={`p-2 rounded-full transition-all shrink-0 ${
                                isLiked ? 'text-red-500' : 'text-slate-500 hover:text-white'
                              }`}
                              title={isLiked ? "Вам нравится" : "Мне нравится"}
                            >
                              <Heart size={16} className={isLiked ? "fill-current" : ""} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* 🎶 ПОПУЛЯРНЫЕ ПЛЕЙЛИСТЫ */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Сборники и миксы</p>
                      <h3 className="text-lg sm:text-xl font-black text-white">Тематические плейлисты</h3>
                    </div>
                    {currentUser && (
                      <button
                        onClick={() => setShowNewPlaylistModal(true)}
                        className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                      >
                        <Plus size={14} />
                        <span>Создать</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {playlists.map(pl => {
                      const plTracks = safeTracks.filter(t => pl.trackIds?.includes(t.id) || t.playlistId === pl.id);
                      return (
                        <div
                          key={pl.id}
                          onClick={() => {
                            if (plTracks.length > 0) {
                              onPlayTrack(plTracks[0], plTracks);
                              addToast(`Воспроизведение плейлиста "${pl.name}"`, 'info');
                            } else {
                              addToast('В этом плейлисте пока нет треков', 'info');
                            }
                          }}
                          className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 transition-all cursor-pointer space-y-2 active:scale-[0.98]"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-tr from-slate-800 to-slate-700 shadow-md">
                            {pl.coverUrl ? (
                              <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <ListMusic size={32} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40">
                                <Play size={18} className="fill-current translate-x-0.5" />
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                              {pl.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              {pl.description || `${plTracks.length} треков`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

              </div>
            )}

            {/* ------------------------------------------------------ */}
            {/* TAB 2: НАВИГАТОР / ЭНЦИКЛОПЕДИЯ ЖАНРОВ                 */}
            {/* ------------------------------------------------------ */}
            {activeTab === 'explore' && (
              <div className="space-y-6 max-w-7xl mx-auto">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-400">Энциклопедия звука</p>
                  <h3 className="text-xl sm:text-2xl font-black text-white">Жанры музыки, инструменты и шедевры</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Нажмите на любой жанр, чтобы увидеть характерные инструменты и эталонные произведения (Вивальди, Ария, Queen, Daft Punk и др.)
                  </p>
                </div>

                {/* Genre Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {Object.values(GENRE_ENCYCLOPEDIA).map(entry => {
                    const count = safeTracks.filter(t => t.genre === entry.genre).length;
                    return (
                      <div
                        key={entry.genre}
                        onClick={() => setInspectedGenre(entry)}
                        className={`p-4 rounded-3xl bg-gradient-to-br ${getTrackGradient(entry.genre)} cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl relative overflow-hidden flex flex-col justify-between border border-white/10 min-h-[160px]`}
                      >
                        <div className="relative z-10 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{entry.icon}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md text-white font-mono font-bold">
                              {count} треков
                            </span>
                          </div>

                          <h4 className="font-black text-base text-white drop-shadow-sm flex items-center gap-1.5">
                            <span>{entry.genre}</span>
                            <Info size={14} className="opacity-70" />
                          </h4>

                          {/* Key Instruments preview */}
                          <p className="text-[11px] text-white/90 font-medium line-clamp-1">
                            🎵 {entry.instruments.slice(0, 3).join(', ')}...
                          </p>

                          {/* Famous work preview */}
                          <div className="pt-1">
                            <p className="text-[10px] uppercase font-bold text-white/70">Эталон:</p>
                            <p className="text-xs font-bold text-amber-200 truncate">
                              {entry.masterpieces[0]?.title} — {entry.masterpieces[0]?.artist}
                            </p>
                          </div>
                        </div>

                        {/* Subtle background disc */}
                        <Disc size={64} className="absolute -bottom-4 -right-4 text-white/15 pointer-events-none" />
                      </div>
                    );
                  })}
                </div>

                {/* Top 10 Chart */}
                <section className="space-y-3 pt-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Популярное</p>
                    <h3 className="text-lg sm:text-xl font-black text-white">Топ треков платформы</h3>
                  </div>

                  <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 divide-y divide-slate-800/60 overflow-hidden">
                    {[...safeTracks].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10).map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isLiked = currentUser && track.likedBy?.includes(currentUser.uid);
                      return (
                        <div
                          key={track.id}
                          className={`px-3.5 py-2.5 flex items-center gap-3 hover:bg-slate-800/60 transition-colors cursor-pointer ${
                            isCurrent ? 'bg-red-500/10' : ''
                          }`}
                          onClick={() => onPlayTrack(track, safeTracks)}
                        >
                          <span className={`w-5 text-center text-xs font-black ${
                            idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'
                          }`}>
                            {idx + 1}
                          </span>

                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <Disc size={18} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              {track.artist}
                            </p>
                          </div>

                          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                            {track.genre}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {onPinTrackToProfile && (track.duration === undefined || track.duration >= 25) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinModalTrack(track);
                                }}
                                className={`p-1.5 rounded-full transition-all shrink-0 ${
                                  pinnedTrackId === track.id ? 'text-amber-400 bg-amber-400/20' : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'
                                }`}
                                title={pinnedTrackId === track.id ? "Закреплен в вашем профиле" : "Закрепить в профиле (>25 сек)"}
                              >
                                <Pin size={15} className={pinnedTrackId === track.id ? "fill-current" : ""} />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLikeTrack(track.id);
                              }}
                              className={`p-1.5 rounded-full transition-colors ${
                                isLiked ? 'text-red-500' : 'text-slate-500 hover:text-white'
                              }`}
                            >
                              <Heart size={16} className={isLiked ? "fill-current" : ""} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* ------------------------------------------------------ */}
            {/* TAB 3: БИБЛИОТЕКА (LIBRARY)                            */}
            {/* ------------------------------------------------------ */}
            {activeTab === 'library' && (
              <div className="space-y-4 max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar touch-pan-x">
                    {[
                      { id: 'all', label: 'Все', count: safeTracks.length },
                      { id: 'liked', label: 'Мне нравится', count: likedTracks.length, icon: Heart },
                      { id: 'my', label: 'Мои треки', count: myTracks.length, icon: User },
                      { id: 'public', label: 'Общие', count: publicTracks.length, icon: Globe },
                      { id: 'creator_studio', label: 'Студия автора 🎬', count: myTracks.length, icon: Sparkles },
                    ].map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setLibrarySubTab(sub.id as any);
                          setSelectedPlaylistId(null);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                          librarySubTab === sub.id && !selectedPlaylistId
                            ? 'bg-white text-black font-extrabold shadow-sm'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{sub.label}</span>
                        {sub.id !== 'creator_studio' && <span className="ml-1 opacity-70">({sub.count})</span>}
                      </button>
                    ))}
                  </div>

                  {librarySubTab !== 'creator_studio' && (
                    <select
                      value={selectedGenre}
                      onChange={e => setSelectedGenre(e.target.value)}
                      className="bg-slate-800 text-xs font-bold text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      {MUSIC_GENRES.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  )}
                </div>

                {librarySubTab === 'creator_studio' ? (
                  <div className="space-y-6">
                    {/* YouTube Studio Channel Header */}
                    <div className="bg-gradient-to-r from-red-900/40 via-slate-900 to-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center gap-6">
                      <div className="w-20 h-20 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-400 font-black text-2xl shadow-lg shrink-0">
                        {currentUser?.displayName?.[0] || '🎬'}
                      </div>
                      <div className="flex-1 text-center md:text-left space-y-1">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                          <h2 className="text-lg font-black text-white">{currentUser?.displayName || 'Моя музыкальная студия'}</h2>
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">Автор</span>
                        </div>
                        <p className="text-xs text-slate-400">Управление треками, статистика прослушиваний и ИИ-сканер устройства</p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs font-semibold text-slate-300">
                          <div>👥 Подписчики: <span className="text-white font-bold">{formatSubscribersCount(subscriberCounts[currentUser?.uid || ''] || 0)}</span></div>
                          <div>🎵 Треков в студии: <span className="text-white font-bold">{myTracks.length}</span></div>
                          <div>❤️ Всего лайков: <span className="text-white font-bold">{myTracks.reduce((acc, t) => acc + (t.likes || 0), 0)}</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                        >
                          <Upload size={14} />
                          <span>Загрузить трек</span>
                        </button>
                        <button
                          onClick={handleRunAiMusicScan}
                          className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                        >
                          <Sparkles size={14} />
                          <span>ИИ-сканер музыки</span>
                        </button>
                      </div>
                    </div>

                    {/* My Tracks List in Studio */}
                    <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 space-y-4">
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Library size={16} className="text-red-500" />
                        <span>Выложенные треки и аналитика</span>
                      </h3>

                      <div className="divide-y divide-slate-800/80">
                        {myTracks.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 space-y-2">
                            <Music size={32} className="mx-auto text-slate-600" />
                            <p className="text-xs font-semibold">У вас пока нет загруженных треков</p>
                            <button
                              onClick={handleRunAiMusicScan}
                              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600/20 text-indigo-400 text-xs font-bold border border-indigo-500/30"
                            >
                              Запустить ИИ-сканер телефона
                            </button>
                          </div>
                        ) : (
                          myTracks.map((track) => (
                            <div key={track.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 px-3 rounded-2xl transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <img src={track.coverUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700" />
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                                  <p className="text-[11px] text-slate-400 truncate">{track.artist} • {track.genre}</p>
                                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1"><Heart size={10} className="text-red-500" /> {track.likes || 0} лайков</span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">{track.isPublic ? '🌍 Публичный' : '🔒 Только я'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => onPlayTrack(track, myTracks)}
                                  className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition-colors"
                                  title="Воспроизвести"
                                >
                                  <Play size={14} />
                                </button>
                                <button
                                  onClick={() => onDeleteTrack(track.id)}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Удалить трек"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden divide-y divide-slate-800/60">
                    {displayedTracks.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 space-y-2">
                        <Music size={36} className="mx-auto text-slate-600" />
                        <p className="text-xs font-semibold">Треки не найдены</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {displayedTracks.map((track, idx) => {
                          const isCurrent = currentTrack?.id === track.id;
                          const isLiked = currentUser && track.likedBy?.includes(currentUser.uid);
                          const isAdmin = Boolean(currentUser && (
                            currentUser.uid === 'system_ordina' || 
                            currentUser.uid === 'le6qifgHZsV99qTBzSe3VZpYVlE2' ||
                            currentUser.displayName === 'MEGAKPYIIIuTeJIb' ||
                            (currentUser as any).email === 'ordinalyzm25@gmail.com' ||
                            (currentUser as any).role === 'admin' ||
                            (currentUser as any).isAdmin === true
                          ));
                          const isOwner = currentUser && track.uploaderId === currentUser.uid;
                          const canDelete = isOwner || isAdmin;
                          const isSubscribed = track.uploaderId && subscriptions?.includes(track.uploaderId);

                          return (
                            <div
                              key={track.id}
                              className={`px-3.5 py-2.5 flex items-center gap-3 hover:bg-slate-800/60 transition-colors group cursor-pointer ${
                                isCurrent ? 'bg-red-500/10' : ''
                              }`}
                              onClick={() => onPlayTrack(track, displayedTracks)}
                            >
                              <div className="w-5 text-center text-xs font-mono text-slate-400 shrink-0">
                                {isCurrent && isPlaying ? (
                                  <AudioLines size={15} className="text-red-400 animate-pulse mx-auto" />
                                ) : (
                                  <span>{idx + 1}</span>
                                )}
                              </div>

                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative bg-slate-800">
                                {track.coverUrl ? (
                                  <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                                    <Disc size={18} />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                                  {track.title}
                                </h4>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (onOpenUserProfile) {
                                        onOpenUserProfile(track.uploaderId || track.artist);
                                      }
                                    }}
                                    className="text-[11px] text-slate-400 hover:text-red-400 hover:underline cursor-pointer truncate"
                                    title="Открыть профиль автора"
                                  >
                                    {track.artist}
                                  </p>
                                  {track.uploaderId && currentUser && track.uploaderId !== currentUser.uid && onToggleSubscribe && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleSubscribe(track.uploaderId!);
                                      }}
                                      className={`px-2 py-0.5 text-[9px] font-bold rounded-full transition-all flex items-center gap-1 shrink-0 ${
                                        isSubscribed
                                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                          : 'bg-red-600 hover:bg-red-500 text-white shadow-sm active:scale-95'
                                      }`}
                                      title={isSubscribed ? "Отписаться" : "Подписаться на автора"}
                                    >
                                      {isSubscribed ? <Check size={10} /> : <Plus size={10} />}
                                      <span>{isSubscribed ? 'Подписка' : 'Подписаться'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                                {track.genre}
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleLikeTrack(track.id);
                                }}
                                className={`p-1.5 rounded-full transition-colors ${
                                  isLiked ? 'text-red-500' : 'text-slate-500 hover:text-white'
                                }`}
                              >
                                <Heart size={16} className={isLiked ? "fill-current" : ""} />
                              </button>

                              {onAddToQueue && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToQueue(track);
                                    addToast(`«${track.title}» добавлен в очередь`, 'info');
                                  }}
                                  className="p-1.5 rounded-full text-slate-400 hover:text-white hidden sm:block"
                                  title="В очередь"
                                >
                                  <ListPlus size={16} />
                                </button>
                              )}

                              {onShareTrackToChat && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShareTrackToChat(track);
                                  }}
                                  className="p-1.5 rounded-full text-slate-400 hover:text-white"
                                  title="Отправить в чат"
                                >
                                  <Share2 size={16} />
                                </button>
                              )}

                              <span className="text-xs font-mono text-slate-400 w-11 text-right">
                                {formatTime(track.duration)}
                              </span>

                              {canDelete && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Удалить трек "${track.title}"?`)) {
                                      onDeleteTrack(track.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-full text-slate-500 hover:text-red-400"
                                  title="Удалить трек (Админ/Автор)"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------ */}
            {/* TAB 5: МОЙ КАНАЛ / МИНИ-ПРОФИЛЬ (YOUTUBE-STYLE)          */}
            {/* ------------------------------------------------------ */}
            {activeTab === 'channel' && (
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="bg-gradient-to-r from-red-950/70 via-slate-900 to-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-red-600 border-2 border-white/20 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                    {currentUser?.photoURL ? (
                      <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-1.5">
                    <h2 className="text-xl sm:text-2xl font-black text-white">{currentUser?.displayName || 'Мой Музыкальный Канал'}</h2>
                    <p className="text-xs text-red-400 font-mono">
                      @{currentUser?.uid ? currentUser.uid.slice(0, 10) : 'my_channel'} • {formatSubscribersCount(subscriberCounts[currentUser?.uid || ''] || 0)}
                    </p>
                    <p className="text-xs text-slate-300 max-w-lg">
                      Ваш персональный музыкальный канал на платформе Ordina. Публикуйте авторские треки, управляйте библиотекой и привлекайте аудиторию.
                    </p>
                    <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-2">
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center gap-1.5 transition-all"
                      >
                        <Upload size={14} />
                        <span>Загрузить новый трек</span>
                      </button>
                      <button
                        onClick={handleRunAiMusicScan}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                      >
                        <Sparkles size={14} />
                        <span>🤖 ИИ-сканер музыки (Телефон)</span>
                      </button>
                      {onOpenUserProfile && currentUser && (
                        <button
                          type="button"
                          onClick={() => onOpenUserProfile(currentUser.uid)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 shadow-sm"
                        >
                          <User size={14} />
                          <span>Профиль пользователя</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Выложено треков</p>
                    <p className="text-2xl font-black text-white mt-1">{tracks.filter(t => t.uploaderId === currentUser?.uid).length}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Лайков на треках</p>
                    <p className="text-2xl font-black text-red-400 mt-1">{tracks.filter(t => t.uploaderId === currentUser?.uid).reduce((acc, t) => acc + (t.likes || 0), 0)}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Подписчики</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{subscriberCounts[currentUser?.uid || ''] || 0}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <ListMusic size={16} className="text-red-400" />
                    <span>Треки на вашем канале ({tracks.filter(t => t.uploaderId === currentUser?.uid).length})</span>
                  </h3>
                  {tracks.filter(t => t.uploaderId === currentUser?.uid).length === 0 ? (
                    <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
                      <Music size={32} className="mx-auto text-slate-600 mb-2" />
                      <p className="text-xs text-slate-400">У вас пока нет загруженных треков.</p>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                      >
                        Загрузить трек
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tracks.filter(t => t.uploaderId === currentUser?.uid).map(track => (
                        <div key={track.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={track.coverUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-white text-xs truncate">{track.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist} • <span className="text-red-400">{track.genre}</span></p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onPlayTrack(track)}
                              className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center"
                            >
                              <Play size={14} className="fill-white" />
                            </button>
                            <button
                              onClick={() => onDeleteTrack(track.id)}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-400 flex items-center justify-center transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------ */}
            {/* TAB 4: ПЛЕЕР И ОЧЕРЕДЬ (NOW PLAYING & QUEUE & LYRICS)  */}
            {/* ------------------------------------------------------ */}
            {activeTab === 'player' && (
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Vinyl / Cover Art */}
                <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-4 py-2">
                  <div className="relative group">
                    <div className={`w-56 h-56 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl relative flex items-center justify-center bg-gradient-to-tr ${
                      currentTrack ? getTrackGradient(currentTrack.title) : 'from-slate-800 to-slate-700'
                    }`}>
                      {currentTrack?.coverUrl ? (
                        <img 
                          src={currentTrack.coverUrl} 
                          alt={currentTrack.title} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-white/90 p-4 text-center">
                          <Disc size={80} className={`stroke-[1.5] ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                          <span className="text-xs font-bold mt-3 opacity-80">{currentTrack?.genre || 'Ordina Music'}</span>
                        </div>
                      )}
                    </div>
                    {isPlaying && (
                      <div className="absolute -inset-2 rounded-3xl bg-red-600/20 blur-2xl -z-10 animate-pulse" />
                    )}
                  </div>

                  {/* Track Meta Details */}
                  <div className="text-center w-full max-w-md space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        {currentTrack?.genre || 'Аудио'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Lossless HQ
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white truncate" title={currentTrack?.title || 'Трек не выбран'}>
                      {currentTrack?.title || 'Трек не выбран'}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-400 truncate">
                      {currentTrack?.artist || 'Ordina Музыка'}
                    </p>
                  </div>
                </div>

                {/* Lyrics / Queue switcher */}
                <div className="lg:col-span-6 bg-slate-900/60 rounded-3xl border border-slate-800/80 p-4 flex flex-col h-[440px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPlayerPanel('queue')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          playerPanel === 'queue'
                            ? 'bg-white text-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ListMusic size={14} />
                        <span>Очередь ({playlist.length})</span>
                      </button>

                      <button
                        onClick={() => setPlayerPanel('lyrics')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          playerPanel === 'lyrics'
                            ? 'bg-white text-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText size={14} />
                        <span>Текст песни</span>
                      </button>
                    </div>

                    {currentTrack && currentUser && (
                      <button
                        onClick={() => onToggleLikeTrack(currentTrack.id)}
                        className={`p-2 rounded-full transition-all ${
                          currentTrack.likedBy?.includes(currentUser.uid)
                            ? 'text-red-500'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="Мне нравится"
                      >
                        <Heart size={18} className={currentTrack.likedBy?.includes(currentUser.uid) ? "fill-current" : ""} />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {playerPanel === 'queue' && (
                      <div className="space-y-1">
                        {playlist.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 text-xs">
                            Очередь пуста. Выберите трек или включите «Мою волну»!
                          </div>
                        ) : (
                          playlist.map((track, qIdx) => {
                            const isCurrent = currentTrack?.id === track.id;
                            return (
                              <div
                                key={`${track.id}_${qIdx}`}
                                onClick={() => onPlayTrack(track, playlist)}
                                className={`p-2 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                                  isCurrent ? 'bg-red-500/15 border border-red-500/30' : 'hover:bg-slate-800/60'
                                }`}
                              >
                                <span className="w-5 text-center text-xs font-mono text-slate-500">
                                  {isCurrent && isPlaying ? (
                                    <AudioLines size={14} className="text-red-400 animate-pulse mx-auto" />
                                  ) : (
                                    qIdx + 1
                                  )}
                                </span>
                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                                  {track.coverUrl ? (
                                    <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                      <Disc size={14} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                                    {track.title}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {formatTime(track.duration)}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {playerPanel === 'lyrics' && (
                      <div className="p-3 text-center">
                        {currentTrack?.lyrics ? (
                          <div className="space-y-3">
                            <pre className="font-sans text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {currentTrack.lyrics}
                            </pre>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(currentTrack.lyrics || '');
                                addToast('Текст скопирован', 'success');
                              }}
                              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-slate-800"
                            >
                              Скопировать
                            </button>
                          </div>
                        ) : (
                          <div className="p-10 text-center text-slate-500 space-y-2">
                            <FileText size={32} className="mx-auto text-slate-600" />
                            <p className="text-xs">Текст песни пока отсутствует</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* ======================================================== */}
          {/* 4. PERSISTENT PLAYER DOCK                                */}
          {/* ======================================================== */}
          <footer className="border-t border-slate-800/90 bg-slate-900/95 backdrop-blur-xl px-3 sm:px-6 py-2 sm:py-2.5 shrink-0 z-30 select-none pb-2 sm:pb-[calc(14px+env(safe-area-inset-bottom,0px))] pl-[max(env(safe-area-inset-left,0px),12px)] pr-[max(env(safe-area-inset-right,0px),12px)]">
            {/* Seekbar */}
            <div className="relative mb-1.5 group">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.5}
                value={isDraggingSeek ? dragSeekTime : (currentTime || 0)}
                onMouseDown={() => setIsDraggingSeek(true)}
                onTouchStart={() => setIsDraggingSeek(true)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDragSeekTime(val);
                  if (!isDraggingSeek) onSeek(val);
                }}
                onMouseUp={(e) => {
                  setIsDraggingSeek(false);
                  onSeek(Number((e.target as any).value));
                }}
                onTouchEnd={(e) => {
                  setIsDraggingSeek(false);
                  onSeek(Number((e.target as any).value));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5 mt-0.5">
                <span>{formatTime(isDraggingSeek ? dragSeekTime : currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              
              {/* Left Track Info */}
              <div 
                onClick={() => setActiveTab('player')}
                className="flex items-center gap-2.5 min-w-0 flex-1 sm:max-w-xs cursor-pointer group"
              >
                <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gradient-to-tr ${
                  currentTrack ? getTrackGradient(currentTrack.title) : 'from-slate-800 to-slate-700'
                } flex items-center justify-center shadow-md`}>
                  {currentTrack?.coverUrl ? (
                    <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc size={18} className={isPlaying ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-red-400">
                    {currentTrack?.title || 'Трек не выбран'}
                  </h4>
                  <p 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (onOpenUserProfile && currentTrack) {
                        onOpenUserProfile(currentTrack.uploaderId || currentTrack.artist);
                      }
                    }}
                    className="text-[10px] text-slate-400 hover:text-red-400 hover:underline cursor-pointer truncate"
                    title="Открыть страницу автора"
                  >
                    {currentTrack?.artist || 'Ordina Музыка'}
                  </p>
                </div>
              </div>

              {/* Center Playback Buttons */}
              <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
                <button
                  onClick={() => {
                    const next = playbackMode === 'shuffle' ? 'sequential' : 'shuffle';
                    onSetPlaybackMode(next);
                  }}
                  className={`p-2 rounded-full transition-colors flex items-center justify-center w-8 h-8 ${
                    playbackMode === 'shuffle' ? 'text-red-400 bg-red-500/20' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Перемешать треки"
                >
                  <Shuffle size={15} />
                </button>

                <button
                  onClick={onPrevTrack}
                  className="p-2 text-slate-300 hover:text-white rounded-full flex items-center justify-center w-8 h-8 active:scale-95"
                  title="Предыдущий трек"
                >
                  <SkipBack size={17} />
                </button>

                <button
                  onClick={onTogglePlay}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition-all"
                  title={isPlaying ? "Пауза" : "Воспроизведение"}
                >
                  {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current translate-x-0.5" />}
                </button>

                <button
                  onClick={onNextTrack}
                  className="p-2 text-slate-300 hover:text-white rounded-full flex items-center justify-center w-8 h-8 active:scale-95"
                  title="Следующий трек"
                >
                  <SkipForward size={17} />
                </button>

                <button
                  onClick={() => {
                    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
                    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
                    onSetRepeatMode(next);
                  }}
                  className={`p-2 rounded-full transition-colors flex items-center justify-center w-8 h-8 ${
                    repeatMode !== 'off' ? 'text-red-400 bg-red-500/20' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Режим повтора"
                >
                  {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
                </button>
              </div>

              {/* Right Tools */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="hidden sm:flex items-center gap-1.5">
                  <button
                    onClick={() => onSetVolume(volume > 0 ? 0 : 0.85)}
                    className="p-1.5 text-slate-400 hover:text-white"
                  >
                    {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={volume}
                    onChange={(e) => onSetVolume(Number(e.target.value))}
                    className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                {onSetPlaybackSpeed && (
                  <button
                    onClick={() => {
                      const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
                      const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                      onSetPlaybackSpeed(next);
                    }}
                    className="px-2 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800"
                    title="Скорость воспроизведения"
                  >
                    {playbackSpeed}x
                  </button>
                )}

                {onSetSleepTimer && (
                  <button
                    onClick={() => {
                      const next = sleepTimerRemaining ? null : 30;
                      onSetSleepTimer(next);
                      addToast(next ? 'Таймер сна: 30 минут' : 'Таймер сна отключен', 'info');
                    }}
                    className={`p-1.5 rounded-full ${sleepTimerRemaining ? 'text-red-400' : 'text-slate-400'}`}
                    title={sleepTimerRemaining ? `Таймер: ${Math.ceil(sleepTimerRemaining / 60)} мин` : "Таймер сна"}
                  >
                    <Clock size={16} />
                  </button>
                )}
              </div>

            </div>
          </footer>

          {/* ======================================================== */}
          {/* 5. MOBILE BOTTOM NAVIGATION (APP-MATCHING BOTTOM CUTOUT) */}
          {/* ======================================================== */}
          <div className="sm:hidden border-t border-slate-800 bg-slate-950 px-2 pt-1.5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pl-[max(env(safe-area-inset-left,0px),8px)] pr-[max(env(safe-area-inset-right,0px),8px)] flex items-center justify-around z-30 shrink-0">
            {[
              { id: 'home', label: 'Главная', icon: Home },
              { id: 'explore', label: 'Жанры', icon: Compass },
              { id: 'library', label: 'Библиотека', icon: Library },
              { id: 'channel', label: 'Канал', icon: User },
              { id: 'player', label: 'Плеер', icon: Disc, live: isPlaying }
            ].map(nav => {
              const Icon = nav.icon;
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id as any)}
                  className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                    isActive ? 'text-red-500 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon size={18} className={nav.live ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
                  <span className="text-[10px] mt-0.5">{nav.label}</span>
                </button>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* 6. GENRE ENCYCLOPEDIA INSPECTOR SHEET / MODAL            */}
          {/* ======================================================== */}
          <AnimatePresence>
            {inspectedGenre && (
              <div 
                className="fixed inset-0 z-[10020] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
                onClick={() => setInspectedGenre(null)}
              >
                <motion.div
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,16px)]"
                >
                  {/* Genre Header */}
                  <div className={`p-5 bg-gradient-to-r ${getTrackGradient(inspectedGenre.genre)} flex items-center justify-between text-white relative`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{inspectedGenre.icon}</span>
                      <div>
                        <h3 className="text-xl font-black">{inspectedGenre.genre}</h3>
                        <p className="text-xs text-white/80">{inspectedGenre.vibe}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setInspectedGenre(null)}
                      className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-xs sm:text-sm">
                    {/* Description */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Описание</h4>
                      <p className="text-slate-200 leading-relaxed">{inspectedGenre.description}</p>
                    </div>

                    {/* Characteristic Instruments */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Music2 size={14} className="text-red-400" />
                        <span>Характерные инструменты жанра</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectedGenre.instruments.map(inst => (
                          <span key={inst} className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-medium">
                            {inst}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Masterpieces Examples */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Известные шедевры и эталоны</span>
                      </h4>
                      <div className="space-y-2">
                        {inspectedGenre.masterpieces.map((work, wIdx) => (
                          <div key={wIdx} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                            <span className="text-red-400 font-bold text-xs mt-0.5">{wIdx + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-white text-xs">{work.title}</p>
                              <p className="text-[11px] text-amber-300 font-medium">{work.artist}</p>
                              {work.note && <p className="text-[10px] text-slate-400 mt-0.5">{work.note}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedGenre(inspectedGenre.genre);
                          setInspectedGenre(null);
                          setActiveTab('library');
                          setLibrarySubTab('all');
                        }}
                        className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all text-center"
                      >
                        Смотреть треки жанра ({safeTracks.filter(t => t.genre === inspectedGenre.genre).length})
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ======================================================== */}
          {/* 7. MODAL: UPLOAD TRACK                                   */}
          {/* ======================================================== */}
          {showUploadModal && (
            <div className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Upload size={18} className="text-red-400" />
                    <h3 className="font-black text-base text-white">Добавить трек в библиотеку</h3>
                  </div>
                  <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                {uploadError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Куда загрузить:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setUploadTarget('my')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          uploadTarget === 'my'
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <User size={14} />
                        <span>Своя библиотека</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadTarget('public')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          uploadTarget === 'public'
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <Globe size={14} />
                        <span>Общая библиотека</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Аудиофайл (&gt;25 сек, до 25 МБ):</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileSelect}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white cursor-pointer"
                    />
                    {Boolean(uploadAudioDuration) && (
                      <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                        Длительность: {formatTime(uploadAudioDuration)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Название трека:</label>
                      <input
                        type="text"
                        value={uploadTitle}
                        onChange={e => setUploadTitle(e.target.value)}
                        placeholder="Название"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Исполнитель:</label>
                      <input
                        type="text"
                        value={uploadArtist}
                        onChange={e => setUploadArtist(e.target.value)}
                        placeholder="Исполнитель"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Жанр:</label>
                    <select
                      value={uploadGenre}
                      onChange={e => setUploadGenre(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    >
                      {MUSIC_GENRES.filter(g => g !== 'Все жанры').map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Обложка (до 5 МБ):</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverSelect}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200 cursor-pointer"
                    />
                    {uploadCoverPreview && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden mt-2 border border-slate-700">
                        <img src={uploadCoverPreview} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  {uploadTarget === 'public' && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={uploadConfirmedNoProfanity}
                        onChange={e => setUploadConfirmedNoProfanity(e.target.checked)}
                        className="mt-0.5 rounded text-red-600 focus:ring-0"
                      />
                      <span className="text-[11px] text-slate-300">
                        Подтверждаю отсутствие ненормативной лексики и оскорблений в названии и контенте для общей библиотеки
                      </span>
                    </label>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !uploadFile}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      {isUploading ? 'Загрузка...' : 'Загрузить трек'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 8. MODAL: CREATE PLAYLIST                                */}
          {/* ======================================================== */}
          {showNewPlaylistModal && (
            <div className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base text-white">Новый плейлист</h3>
                  <button onClick={() => setShowNewPlaylistModal(false)} className="text-slate-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreatePlaylist} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Название плейлиста:</label>
                    <input
                      type="text"
                      value={newPlaylistTitle}
                      onChange={e => setNewPlaylistTitle(e.target.value)}
                      placeholder="Например: Мой любимый рок"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Описание:</label>
                    <textarea
                      value={newPlaylistDesc}
                      onChange={e => setNewPlaylistDesc(e.target.value)}
                      placeholder="Краткое описание..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 h-20 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewPlaylistModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={!newPlaylistTitle.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 9. MODAL: AI MUSIC SCANNER FOR PHONE                     */}
          {/* ======================================================== */}
          {showAiScannerModal && (
            <div className="fixed inset-0 z-[10020] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-white">ИИ-сканер музыки с телефона</h3>
                      <p className="text-[11px] text-slate-400">Gemini AI анализирует треки и подбирает жанры и вайб</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAiScannerModal(false)} className="text-slate-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                {isScanningPhoneMusic ? (
                  <div className="py-12 text-center space-y-3">
                    <Sparkles size={36} className="mx-auto text-indigo-400 animate-spin" />
                    <p className="text-xs font-bold text-white">ИИ сканирует аудиофайлы устройства...</p>
                    <p className="text-[11px] text-slate-400">Определяем жанры, настроение и качество звучания</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                      <span>Найдено треков: {scannedPhoneTracks.length}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedScanIds.length === scannedPhoneTracks.length) {
                            setSelectedScanIds([]);
                          } else {
                            setSelectedScanIds(scannedPhoneTracks.map(t => t.id));
                          }
                        }}
                        className="text-indigo-400 hover:underline text-[11px]"
                      >
                        {selectedScanIds.length === scannedPhoneTracks.length ? 'Снять все галочки' : 'Выбрать все'}
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1 divide-y divide-slate-800/60">
                      {scannedPhoneTracks.length === 0 && (
                        <div className="py-10 text-center text-slate-400 space-y-2">
                          <Music size={28} className="mx-auto text-slate-600" />
                          <p className="text-xs font-semibold">На телефоне не найдено аудио длиннее 25 секунд</p>
                          <p className="text-[11px] text-slate-500">Проверьте разрешение на доступ к музыке в настройках приложения</p>
                        </div>
                      )}
                      {scannedPhoneTracks.map(track => {
                        const isChecked = selectedScanIds.includes(track.id);
                        return (
                          <label
                            key={track.id}
                            className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                              isChecked ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-slate-800/40 border-slate-800 opacity-70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedScanIds(prev => [...prev, track.id]);
                                } else {
                                  setSelectedScanIds(prev => prev.filter(id => id !== track.id));
                                }
                              }}
                              className="mt-1 rounded text-indigo-600 focus:ring-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                                  {track.genre}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                              <p className="text-[10px] text-indigo-400/90 mt-1 italic">
                                🤖 Вайб: {track.aiMood} ({track.aiBpm}) — {track.aiDescription}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowAiScannerModal(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        disabled={selectedScanIds.length === 0}
                        onClick={handleImportScannedTracks}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-lg flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        <span>Импортировать выбранные ({selectedScanIds.length})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confirmation modal for Pinning Track to Profile */}
          {pinModalTrack && (
            <div 
              className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
              onClick={() => setPinModalTrack(null)}
            >
              <div 
                className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Pin size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Закрепить трек в профиле?</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Музыка <strong className="text-zinc-200">«{pinModalTrack.title}»</strong> ({pinModalTrack.artist}) будет видна всем в вашем профиле, и ее можно будет послушать прямо со страницы профиля.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setPinModalTrack(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onPinTrackToProfile) {
                        onPinTrackToProfile(pinModalTrack);
                      }
                      setPinModalTrack(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-colors"
                  >
                    Закрепить в профиль
                  </button>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MusicPlayerModal;
