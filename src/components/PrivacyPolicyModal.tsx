// src/components/PrivacyPolicyModal.tsx
import React from 'react';
import { X, Shield, Lock, FileText, CheckCircle2, Scale, Database, EyeOff, Trash2, Mail, ExternalLink, AlertTriangle } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 pt-[env(safe-area-inset-top,12px)] pb-[env(safe-area-inset-bottom,12px)]">
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">Политика конфиденциальности и обработки данных</h2>
              <p className="text-xs text-zinc-400 truncate">Соответствие 152-ФЗ, 149-ФЗ и 242-ФЗ РФ • Платформа «Ордина»</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors shrink-0"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-zinc-300 leading-relaxed bg-zinc-950 custom-scrollbar">
          
          {/* Section 1 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">1</span>
              1. Общие положения и правовые основания
            </h3>
            <p>
              1.1. Настоящая Политика обработки и защиты персональных данных (далее — «Политика») разработана в строгом соответствии с требованиями законодательства Российской Федерации:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
              <li>Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» (с изменениями и дополнениями);</li>
              <li>Федерального закона от 27.07.2006 № 149-ФЗ «Об информации, информационных технологиях и о защите информации»;</li>
              <li>Федерального закона от 21.07.2014 № 242-ФЗ в части требования локализации баз данных граждан РФ;</li>
              <li>Нормативных актов Роскомнадзора и уполномоченных органов государственной власти РФ.</li>
            </ul>
            <p>
              1.2. Оператором персональных данных является Администрация программного комплекса «Ордина». Контактный адрес электронной почты уполномоченного лица по защите персональных данных: <strong className="text-amber-400">ordinalyzm25@gmail.com</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">2</span>
              2. Принципы обработки и локализация данных в РФ (242-ФЗ)
            </h3>
            <p>
              2.1. <strong>Локализация баз данных:</strong> В соответствии со ст. 18 ч. 5 № 152-ФЗ и № 242-ФЗ, при сборе персональных данных граждан РФ обеспечивается запись, систематизация, накопление, хранение, уточнение (обновление, изменение) и извлечение данных с использованием баз данных, расположенных на территории Российской Федерации.
            </p>
            <p>
              2.2. <strong>Принцип минимизации (Data Minimization):</strong> Сервис собирает исключительно минимально необходимый объем сведений, требуемый для обмена сообщениями и функционирования сервиса.
            </p>
            <p>
              2.3. <strong>Защита от неизбирательной слежки:</strong> Сервис не передает, не продает и не предоставляет рекламным трекерам или третьим лицам пользовательские данные.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">3</span>
              3. Состав обрабатываемых данных (Открытый бета-тест)
            </h3>
            <div className="space-y-2 pl-2">
              <p>
                <strong>3.1. Общедоступные данные учетной записи:</strong> псевдоним (username), отображаемое имя (displayName), аватар, фоновое изображение профиля, дата рождения (birthday, по желанию пользователя, изначально пустое), закрепленный трек, закрепленный канал автора и текстовое поле «О себе» (bio), добровольно указываемые пользователем.
              </p>
              <p>
                <strong>3.2. Авторизационные маркеры:</strong> криптографические идентификаторы сессий и локальные ключи устройств, необходимые для защищенного доступа.
              </p>
              <p>
                <strong>3.3. Пользовательские материалы:</strong> отправленные в чаты сообщения, медиафайлы (фото, видео), аудиосообщения и треки в музыкальной библиотеке.
              </p>
              <p>
                <strong>3.4. Открытость и честность в открытом бета-тесте:</strong> Сервис не скрывает принципы работы: сообщения доставляются через открытые протоколы WebSockets/WebRTC, кэшируются на клиентском устройстве (IndexedDB/LocalStorage) и не продаются рекламным брокерам. Функция «Без звука» намеренно отключена для личных чатов и групп во избежание манипуляций и скрытой активности.
              </p>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Сервис категорически НЕ обрабатывает:
                </p>
                <p className="text-xs text-amber-200/90">
                  Паспортные данные, сведения о расовой и национальной принадлежности, политических взглядах, религиозных убеждениях, состоянии здоровья, интимной жизни, биометрические персональные данные и данные платежных карт.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">4</span>
              4. Специфика локального обмена через Mesh-сеть и Bluetooth (P2P)
            </h3>
            <p>
              4.1. Мессенджер поддерживает автономный децентрализованный режим обмена сообщениями (Mesh-сеть / Радар) через интерфейс Bluetooth Low Energy (BLE) при отсутствии доступа к глобальной сети Интернет.
            </p>
            <p>
              4.2. При локальной передаче сообщения транслируются непосредственно между узлами сети (P2P) в зашифрованном виде без сохранения на централизованных серверах, что исключает внешнюю компрометацию данных.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">5</span>
              5. Права субъекта персональных данных (ст. 14–17 № 152-ФЗ)
            </h3>
            <p>
              Субъект персональных данных имеет безусловное право:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li><strong>На доступ и уточнение:</strong> право требовать уточнения, изменения или обновления своих персональных данных через интерфейс профиля;</li>
              <li><strong>На уничтожение данных (ст. 21 № 152-ФЗ):</strong> пользователь может удалить любое отправленное сообщение «для всех» либо воспользоваться кнопкой «Удалить аккаунт навсегда» в настройках, что приводит к безвозвратному стиранию профиля;</li>
              <li><strong>На отзыв согласия:</strong> отзыв согласия на обработку осуществляется посредством направления письменного запроса оператору на электронную почту <span className="text-amber-400">ordinalyzm25@gmail.com</span> либо путем удаления учетной записи в приложении. Срок прекращения обработки не превышает 30 дней.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">6</span>
              6. Меры по обеспечению безопасности (ст. 19 № 152-ФЗ)
            </h3>
            <p>
              Оператор реализует предусмотренные законом правовые, организационные и технические меры:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
              <li>Шифрование данных при передаче с использованием протоколов TLS 1.3 / WSS;</li>
              <li>Криптографическая изоляция сессий и предотвращение несанкционированного доступа;</li>
              <li>Локальное хранилище IndexedDB / SafeStorage на устройстве пользователя с защитой от очистки;</li>
              <li>Постоянный аудит исходного кода и регулярное устранение уязвимостей.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">7</span>
              7. Контакты и направление обращений
            </h3>
            <p>
              По всем вопросам реализации прав субъекта персональных данных, сообщений об ошибках, предложениях и жалобах вы можете обращаться:
            </p>
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Администратор и оператор данных:</p>
                  <p className="text-xs text-amber-400 font-mono">ordinalyzm25@gmail.com</p>
                </div>
              </div>
              <a
                href="mailto:ordinalyzm25@gmail.com?subject=Запрос субъекта персональных данных по 152-ФЗ"
                className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black font-bold text-xs transition-colors text-center shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>Написать оператору</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-zinc-800 bg-black flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0" />
            <span>Соответствует ФЗ № 152-ФЗ, 149-ФЗ и 242-ФЗ РФ</span>
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

export default PrivacyPolicyModal;
