// src/components/PrivacyPolicyModal.tsx
import React from 'react';
import { X, Shield, Lock, FileText, CheckCircle2, Scale, Database, EyeOff, Trash2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pt-safe pb-safe">
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Политика конфиденциальности и защиты данных</h2>
              <p className="text-xs text-zinc-400">Платформа «Ордина» • Редакция 2026 г. (152-ФЗ, GDPR & Zero-Knowledge)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-zinc-300 leading-relaxed mobile-sheet-scroll bg-zinc-950">
          
          {/* Section 1 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">1</span>
              1. Общие положения и правовой статус
            </h3>
            <p>
              1.1. Настоящая Политика конфиденциальности и обработки персональных данных (далее — «Политика») регулирует отношения по обработке, защите и обеспечению конфиденциальности информации при использовании программного комплекса и платформы защищенной связи «Ордина» (далее — «Сервис»).
            </p>
            <p>
              1.2. Настоящий документ разработан в строгом соответствии с требованиями Федерального закона РФ от 27.07.2006 № 152-ФЗ «О персональных данных», Федерального закона РФ от 27.07.2006 № 149-ФЗ «Об информации, информационных технологиях и о защите информации», а также общепринятыми международными стандартами конфиденциальности и регламентом GDPR.
            </p>
            <p>
              1.3. Принципом архитектуры Сервиса является <strong>суверенитет пользовательских данных (Data Sovereignty)</strong>, применение сквозного криптографического шифрования (End-to-End Encryption) и минимизация серверного сбора метаданных (Zero-Knowledge Architecture).
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">2</span>
              2. Принципы обработки данных и архитектура сквозного шифрования
            </h3>
            <p>
              2.1. <strong>Сквозное шифрование (E2EE):</strong> Текстовые сообщения, голосовые записи, файлы и медиаданные шифруются на клиентском устройстве отправителя и могут быть расшифрованы исключительно на авторизованном устройстве получателя. Ни администрация Сервиса, ни промежуточные узлы сети не имеют технических средств или криптографических ключей для расшифровки или инспекции передаваемого трафика.
            </p>
            <p>
              2.2. <strong>Mesh и Peer-to-Peer маршрутизация:</strong> При офлайн-передаче данных через Bluetooth Low Energy / Wi-Fi Direct сообщения циркулируют между устройствами в виде зашифрованных пакетов без фиксации IP-адресов на центральных серверах.
            </p>
            <p>
              2.3. <strong>Политика отсутствия логов (Zero-Log Policy):</strong> Сервис не сохраняет и не профилирует журнал звонков, историю геопозиционирования, социальные связи или содержимое прочитанных приватных сообщений.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">3</span>
              3. Состав обрабатываемой информации
            </h3>
            <div className="space-y-2 pl-2">
              <p>
                <strong>3.1. Общедоступная учетная запись:</strong> выбранный псевдоним (username), отображаемое имя, аватар и текстовое поле «О себе» (bio), добровольно указанные пользователем.
              </p>
              <p>
                <strong>3.2. Аутентификационные маркеры:</strong> криптографический хэш учетных данных или одноразовые токены сессий (session tokens), необходимые для авторизации устройства.
              </p>
              <p>
                <strong>3.3. Технические параметры подключения:</strong> минимально необходимые сетевые заголовки для установления WebSocket-соединения (временный сокет-идентификатор), удаляемые при разрыве сессии.
              </p>
              <p className="text-amber-400/90 font-medium">
                Сервис <u>не запрашивает</u> и <u>не обрабатывает</u>: биометрические данные, паспортные сведения, финансовые реквизиты, историю браузера или данные сторонних приложений.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">4</span>
              4. Цели и правовые основания обработки (ст. 6 Федерального закона № 152-ФЗ)
            </h3>
            <p>
              Обработка данных производится исключительно в целях:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
              <li>Исполнения соглашения об использовании программного сервиса «Ордина» (ст. 6 п. 1 пп. 5 152-ФЗ);</li>
              <li>Предоставления сервиса автономной передачи данных и предотвращения спам-атак и попыток взлома узлов;</li>
              <li>Синхронизации зашифрованных локальных баз данных на устройствах владельца аккаунта.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">5</span>
              5. Права пользователя (Право на забвение и отзыв согласия)
            </h3>
            <p>
              В соответствии со статьями 14, 15 и 21 Федерального закона № 152-ФЗ пользователь имеет безоговорочное право:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
              <li><strong>Полное удаление аккаунта:</strong> в настройках профиля («Удалить аккаунт навсегда») все учетные данные, привязки и записи стираются безвозвратно со всех серверов и локальных хранилищ;</li>
              <li><strong>Мгновенное удаление сообщений:</strong> удаление любого сообщения или диалога приводит к немедленному стиранию из оперативной памяти сервера и локальных баз данных SQLite / IndexedDB собеседников;</li>
              <li><strong>Экспорт данных:</strong> получение локальной резервной копии переписки в зашифрованном или текстовом виде.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">6</span>
              6. Передача третьим лицам и трансграничная передача
            </h3>
            <p>
              6.1. Сервис <strong>не осуществляет продажу, возмездную передачу или предоставление</strong> персональных данных рекламным сетям, аналитическим трекерам или третьим лицам.
            </p>
            <p>
              6.2. В связи с архитектурой E2EE (сквозного шифрования) администрация Сервиса физически и технически лишена возможности предоставить содержимое зашифрованной переписки третьим лицам или организациям.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">7</span>
              7. Открытый исходный код и контакты
            </h3>
            <p>
              7.1. Исходный код клиентской и серверной частей мессенджера доступен для независимого аудита безопасности в публичном репозитории: <span className="font-mono text-amber-400">github.com/ordinalyzm/Ordina</span>.
            </p>
            <p>
              7.2. Вопросы, связанные с обработкой данных и реализацией прав субъектов персональных данных, принимаются через официальный интерфейс обратной связи или систему тикетов в мессенджере.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-zinc-800 bg-black flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0" />
            <span>Соответствует ФЗ № 152-ФЗ РФ и международным нормам защиты данных</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shadow-lg shadow-amber-500/20"
          >
            Принять и закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
