import React from 'react';
import { X, Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Политика конфиденциальности</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Мессенджер Ордина • Редакция от сентября 2026 г.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">1</span>
              1. Общие положения
            </h3>
            <p>
              1.1. Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональной информации пользователей платформы безопасного общения «Ордина» (далее — Сервис).
            </p>
            <p>
              1.2. Сервис разработан с приоритетом конфиденциальности, суверенного шифрования и децентрализованной доставки данных (включая технологии Mesh и P2P).
            </p>
            <p>
              1.3. Регистрация или фактическое использование Сервиса означает безоговорочное согласие пользователя с настоящей Политикой и указанными в ней условиями обработки информации. В случае несогласия пользователь обязан прекратить использование Сервиса.
            </p>
            <p>
              1.4. Сервис осуществляет деятельность в строгом соответствии с требованиями Федерального закона РФ № 152-ФЗ «О персональных данных», нормами международного права и стандартами кибербезопасности.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">2</span>
              2. Категории обрабатываемых данных
            </h3>
            <p>
              2.1. <strong>Учетные данные:</strong> псевдоним (username), отображаемое имя, адрес электронной почты (для авторизации), фото профиля (аватар) и статус, предоставляемые пользователем добровольно.
            </p>
            <p>
              2.2. <strong>Содержимое сообщений и медиа:</strong> текстовые сообщения, аудиозаписи, графические файлы и документы, передаваемые в рамках персональных чатов, групповых бесед и публичных каналов.
            </p>
            <p>
              2.3. <strong>Технические данные:</strong> идентификаторы активных сессий (Device ID), тип устройства, операционная система, версия клиента, ориентировочный сетевой регион (для маршрутизации в узлах связи).
            </p>
            <p>
              2.4. Сервис не осуществляет сбор биометрических данных, паспортных сведений, платежных реквизитов и иных специальных категорий персональных данных.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">3</span>
              3. Цели обработки данных
            </h3>
            <p>
              3.1. Обеспечение стабильного и бесперебойного функционирования систем обмена сообщениями, P2P- и Mesh-маршрутизации без зависимости от центральных магистралей.
            </p>
            <p>
              3.2. Аутентификация пользователя, синхронизация данных между авторизованными устройствами пользователя и восстановление доступа к учетной записи.
            </p>
            <p>
              3.3. Обеспечение безопасности платформы, пресечение спам-рассылок, фишинга, кибератак, а также рассмотрение жалоб пользователей модераторами.
            </p>
            <p>
              3.4. Оптимизация и повышение качества сжатия медиафайлов без потери детализации и читаемости информации.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">4</span>
              4. Правовые основания обработки
            </h3>
            <p>
              4.1. Обработка персональных данных осуществляется на основании ст. 6 Федерального закона № 152-ФЗ:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Согласие субъекта персональных данных на обработку его данных;</li>
              <li>Необходимость исполнения соглашения об использовании Сервиса между пользователем и платформой Ордина;</li>
              <li>Осуществление прав и законных интересов платформы и пользователей по защите от мошеннических действий и противоправного контента.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">5</span>
              5. Порядок сбора, хранения и защиты данных
            </h3>
            <p>
              5.1. <strong>Криптографическая защита:</strong> все сетевые соединения защищены современными протоколами TLS/WSS с применением анти-DPI обфускации трафика и сквозного шифрования.
            </p>
            <p>
              5.2. <strong>Автоматическая очистка:</strong> доставленные и прочитанные сообщения в личных чатах автоматически удаляются из серверных очередей, сохраняясь локально исключительно на авторизованных устройствах собеседников.
            </p>
            <p>
              5.3. <strong>Изоляция доступа:</strong> доступ к инфраструктуре строго регламентирован и защищен двухфакторной аутентификацией и аудитом действий.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">6</span>
              6. Передача данных третьим лицам
            </h3>
            <p>
              6.1. Сервис <strong>никогда не продает, не сдает в аренду и не передает</strong> персональные данные рекламным трекерам, аналитическим агрегаторам или сторонним корпорациям.
            </p>
            <p>
              6.2. Передача информации государственным органам возможна исключительно в случаях и порядке, прямо предусмотренных действующим законодательством Российской Федерации, на основании вступившего в силу законного судебного решения.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">7</span>
              7. Права пользователей
            </h3>
            <p>
              7.1. Пользователь имеет право в любой момент:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Получить сведения о составе и целях обработки своих данных;</li>
              <li>Изменить, дополнить или обновить персональные данные в настройках профиля;</li>
              <li>Отозвать согласие и полностью удалить свою учетную запись и все связанные данные из Сервиса;</li>
              <li>Подать жалобу модераторам на нарушение своих прав или правил безопасности платформы.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">8</span>
              8. Заключительные положения
            </h3>
            <p>
              8.1. Сервис вправе вносить изменения в настоящую Политику конфиденциальности при изменении законодательства или модернизации архитектуры Сервиса.
            </p>
            <p>
              8.2. Новая редакция вступает в силу с момента ее публикации в интерфейсе мессенджера Ордина.
            </p>
            <p>
              8.3. По всем вопросам, связанным с соблюдением конфиденциальности и модерацией, пользователи могут обращаться в официальный канал поддержки или к модераторам платформы.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Соответствует 152-ФЗ и международным регламентам
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
