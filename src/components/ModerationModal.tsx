import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, ShieldCheck, UserX, AlertOctagon, Trash2, Clock, 
  Check, Filter, UserCheck, MessageSquare, AlertTriangle, UserMinus, 
  Ban, Shield, UserPlus, Search, RefreshCw
} from 'lucide-react';
import { Report, UserProfile } from '../types';

interface ModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  reports: Report[];
  isSuperAdmin?: boolean;
  moderatorsList?: string[];
  moderators?: string[];
  allUsers?: UserProfile[];
  onAction: (data: {
    action: 'ban_dms_temporary' | 'warning' | 'delete_message_with_warning' | 'delete_group_with_warning' | 'delete_account_with_warning' | 'ban_account_email' | 'dismiss';
    reportId?: string;
    targetUid?: string;
    targetEmail?: string;
    targetGroupId?: string;
    targetMessageId?: string;
    chatId?: string;
    durationHours?: number;
    warningText?: string;
    reason?: string;
  }) => void;
  onAssignModerator: (targetUid: string, isModerator: boolean) => void;
  onRefreshReports: () => void;
}

export const ModerationModal: React.FC<ModerationModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  reports,
  isSuperAdmin: propIsSuperAdmin,
  moderatorsList,
  moderators,
  allUsers = [],
  onAction,
  onAssignModerator,
  onRefreshReports
}) => {
  const effectiveModerators = moderatorsList || moderators || [];
  const [activeTab, setActiveTab] = useState<'reports' | 'moderators'>('reports');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Action Dialog state
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'ban_dms' | 'warn' | 'del_msg' | 'del_group' | 'del_account' | 'ban_email' | 'dismiss' | null;
    report?: Report | null;
    targetUid?: string;
    targetEmail?: string;
  }>({ open: false, type: null });

  const [durationHours, setDurationHours] = useState(24);
  const [warningText, setWarningText] = useState('');
  const [actionReason, setActionReason] = useState('');

  // Moderator management state
  const [modSearch, setModSearch] = useState('');

  const isSuperAdmin = propIsSuperAdmin || 
    currentUser?.uid === 'le6qifgHZsV99qTBzSe3VZpYVlE2' || 
    currentUser?.email === 'ordinalyzm25@gmail.com' || 
    currentUser?.username === 'MEGAKPYIIIuTeJIb' || 
    currentUser?.role === 'admin' || 
    currentUser?.isAdmin === true;

  if (!isOpen) return null;

  const filteredReports = reports.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const handleOpenAction = (type: any, report: Report) => {
    let defaultReason = report.reasonCategoryTitle;
    let defaultWarning = `Нарушение регламента: ${report.reasonCategoryTitle}.`;
    
    if (type === 'ban_dms') {
      defaultReason = `Спам и нежелательные сообщения (${report.reasonCategoryTitle})`;
    } else if (type === 'warn') {
      defaultWarning = `Официальное предупреждение: обнаружены нарушения (${report.reasonCategoryTitle}). При повторении аккаунт будет заблокирован.`;
    } else if (type === 'del_msg') {
      defaultWarning = `Ваше сообщение удалено модератором за нарушение: ${report.reasonCategoryTitle}.`;
    }

    setActionDialog({
      open: true,
      type,
      report,
      targetUid: report.targetType === 'message' ? report.messageContext?.senderId : report.targetId,
      targetEmail: report.targetType === 'user' ? allUsers.find(u => u.uid === report.targetId)?.email : undefined
    });
    setActionReason(defaultReason);
    setWarningText(defaultWarning);
    setDurationHours(24);
  };

  const handleExecuteAction = () => {
    if (!actionDialog.type) return;

    if (actionDialog.type === 'ban_dms') {
      onAction({
        action: 'ban_dms_temporary',
        reportId: actionDialog.report?.id,
        targetUid: actionDialog.targetUid,
        durationHours,
        reason: actionReason
      });
    } else if (actionDialog.type === 'warn') {
      onAction({
        action: 'warning',
        reportId: actionDialog.report?.id,
        targetUid: actionDialog.targetUid,
        warningText,
        reason: actionReason
      });
    } else if (actionDialog.type === 'del_msg') {
      onAction({
        action: 'delete_message_with_warning',
        reportId: actionDialog.report?.id,
        targetMessageId: actionDialog.report?.targetId,
        targetUid: actionDialog.targetUid,
        chatId: actionDialog.report?.chatId,
        warningText,
        reason: actionReason
      });
    } else if (actionDialog.type === 'del_group') {
      onAction({
        action: 'delete_group_with_warning',
        reportId: actionDialog.report?.id,
        targetGroupId: actionDialog.report?.targetId,
        targetUid: actionDialog.targetUid,
        warningText,
        reason: actionReason
      });
    } else if (actionDialog.type === 'del_account') {
      onAction({
        action: 'delete_account_with_warning',
        reportId: actionDialog.report?.id,
        targetUid: actionDialog.targetUid,
        warningText,
        reason: actionReason
      });
    } else if (actionDialog.type === 'ban_email') {
      onAction({
        action: 'ban_account_email',
        reportId: actionDialog.report?.id,
        targetUid: actionDialog.targetUid,
        targetEmail: actionDialog.targetEmail,
        reason: actionReason
      });
    } else if (actionDialog.type === 'dismiss') {
      onAction({
        action: 'dismiss',
        reportId: actionDialog.report?.id
      });
    }

    setActionDialog({ open: false, type: null });
    setSelectedReport(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Центр безопасности и модерации</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  {isSuperAdmin ? 'Администратор' : 'Модератор'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Рассмотрение жалоб по законодательству РФ и управление санкциями
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefreshReports}
              title="Обновить список жалоб"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50/50 dark:bg-zinc-900/40">
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Жалобы пользователей
            {reports.filter(r => r.status === 'pending').length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500 text-white">
                {reports.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('moderators')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'moderators'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Команда модераторов ({effectiveModerators.length})
            </button>
          )}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'reports' ? (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Reports List */}
              <div className="w-full md:w-1/2 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                {/* Filter bar */}
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto text-xs">
                  <span className="text-zinc-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" />
                  </span>
                  {(['pending', 'all', 'resolved', 'dismissed'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        filterStatus === status
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {status === 'pending' && 'Ожидают проверки'}
                      {status === 'all' && 'Все жалобы'}
                      {status === 'resolved' && 'Приняты меры'}
                      {status === 'dismissed' && 'Отклонены'}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filteredReports.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 text-sm">
                      {filterStatus === 'pending' ? 'Нет активных жалоб. Все чисто! ✨' : 'Жалоб не найдено.'}
                    </div>
                  ) : (
                    filteredReports.map((report) => {
                      const isSelected = selectedReport?.id === report.id;
                      return (
                        <div
                          key={report.id}
                          onClick={() => setSelectedReport(report)}
                          className={`p-4 cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-blue-50/60 dark:bg-blue-950/20 border-l-4 border-blue-600' 
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-red-600 dark:text-red-400 truncate">
                              {report.reasonCategoryTitle}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              report.status === 'pending'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : report.status === 'resolved'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                            }`}>
                              {report.status === 'pending' ? 'Ожидает' : report.status === 'resolved' ? 'Решена' : 'Отклонена'}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-0.5">
                            <div>
                              <span className="text-zinc-400">Цель: </span>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {report.targetType === 'message' ? 'Сообщение' : report.targetType === 'user' ? 'Пользователь' : 'Группа/Канал'}
                                {report.targetName ? ` (${report.targetName})` : ''}
                              </span>
                            </div>
                            <div className="truncate text-zinc-500">
                              <span className="text-zinc-400">От: </span>
                              {report.reporterName}
                            </div>
                            {report.messageContext?.text && (
                              <p className="line-clamp-1 italic text-zinc-400 text-[11px] mt-1 bg-zinc-100/60 dark:bg-zinc-800/40 p-1.5 rounded">
                                «{report.messageContext.text}»
                              </p>
                            )}
                          </div>

                          <div className="text-[10px] text-zinc-400 mt-2 flex justify-between items-center">
                            <span>{new Date(report.createdAt).toLocaleString('ru-RU')}</span>
                            {report.resolutionAction && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[140px]">
                                {report.resolutionAction}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Selected Report Inspection & Action Desk */}
              <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30">
                {selectedReport ? (
                  <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                        Категория нарушения
                      </span>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                        {selectedReport.reasonCategoryTitle}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Заявитель: <strong className="text-zinc-700 dark:text-zinc-300">{selectedReport.reporterName}</strong> ({new Date(selectedReport.createdAt).toLocaleString('ru-RU')})
                      </p>
                    </div>

                    {/* Context Box */}
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Контекст жалобы
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                        <div>
                          <strong>Объект:</strong> {selectedReport.targetType === 'message' ? 'Сообщение в чате' : selectedReport.targetType === 'user' ? 'Профиль пользователя' : 'Сообщество'}
                        </div>
                        {selectedReport.targetName && (
                          <div><strong>Имя / название:</strong> {selectedReport.targetName}</div>
                        )}
                        {selectedReport.description && (
                          <div className="mt-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs">
                            <span className="text-zinc-400 block mb-0.5 font-medium">Комментарий заявителя:</span>
                            {selectedReport.description}
                          </div>
                        )}
                        {selectedReport.messageContext && (
                          <div className="mt-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs">
                            <span className="text-red-500 block mb-1 font-semibold">
                              Текст проверяемого сообщения (автор {selectedReport.messageContext.senderName || selectedReport.messageContext.senderId}):
                            </span>
                            <div className="font-mono text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                              {selectedReport.messageContext.text || '(Медиафайл без текста)'}
                            </div>
                            {selectedReport.messageContext.fileUrl && (
                              <img 
                                src={selectedReport.messageContext.fileUrl} 
                                alt="Reported media" 
                                className="max-h-48 rounded-lg mt-2 object-cover border border-zinc-200 dark:border-zinc-700" 
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedReport.status !== 'pending' && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                        <strong>Итог рассмотрения:</strong> {selectedReport.resolutionAction}
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Модератор: {selectedReport.resolvedByName} ({new Date(selectedReport.resolvedAt || '').toLocaleString('ru-RU')})
                        </div>
                      </div>
                    )}

                    {/* Actions Panel */}
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Меры реагирования модератора
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenAction('ban_dms', selectedReport)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
                        >
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Запрет писать первым на N времени</span>
                        </button>

                        <button
                          onClick={() => handleOpenAction('warn', selectedReport)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Вынести предупреждение (варн)</span>
                        </button>

                        {selectedReport.targetType === 'message' && (
                          <button
                            onClick={() => handleOpenAction('del_msg', selectedReport)}
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            <span>Удалить сообщение + варн</span>
                          </button>
                        )}

                        {selectedReport.targetType === 'group' && (
                          <button
                            onClick={() => handleOpenAction('del_group', selectedReport)}
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            <span>Удалить группу/канал</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenAction('del_account', selectedReport)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
                        >
                          <UserX className="w-4 h-4 shrink-0" />
                          <span>Удалить аккаунт нарушителя</span>
                        </button>

                        <button
                          onClick={() => handleOpenAction('ban_email', selectedReport)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
                        >
                          <Ban className="w-4 h-4 shrink-0" />
                          <span>Удалить аккаунт и бан почты</span>
                        </button>

                        <button
                          onClick={() => handleOpenAction('dismiss', selectedReport)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors text-left col-span-1 sm:col-span-2"
                        >
                          <Check className="w-4 h-4 shrink-0" />
                          <span>Отклонить жалобу (нарушений не найдено)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                    <ShieldAlert className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Выберите жалобу из списка слева для изучения контекста и применения мер</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Moderators Management Tab (SuperAdmin only) */
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-2xl">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                  Назначение и управление модераторами
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Главный администратор Ордины может наделять доверенных пользователей полномочиями модерации (рассмотрение жалоб, вынесение предупреждений, удаление спама и нарушений).
                </p>
              </div>

              <div className="max-w-md relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Поиск по никнейму, имени или UID..."
                  value={modSearch}
                  onChange={(e) => setModSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allUsers
                  .filter(u => {
                    if (u.uid === currentUser.uid) return false;
                    if (!modSearch) return true;
                    const q = modSearch.toLowerCase();
                    return (u.username?.toLowerCase().includes(q) || 
                            u.displayName?.toLowerCase().includes(q) || 
                            u.email?.toLowerCase().includes(q) || 
                            u.uid.includes(q));
                  })
                  .slice(0, 20)
                  .map((user) => {
                    const isMod = effectiveModerators.includes(user.uid) || user.isModerator;
                    return (
                      <div
                        key={user.uid}
                        className="p-3.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <img
                            src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.displayName || user.uid}`}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                          <div className="truncate">
                            <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                              {user.displayName || 'Пользователь'}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                              @{user.username || user.uid.slice(0, 8)}
                            </div>
                          </div>
                        </div>

                        {isMod ? (
                          <button
                            onClick={() => onAssignModerator(user.uid, false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors flex items-center gap-1 shrink-0"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Снять модератора
                          </button>
                        ) : (
                          <button
                            onClick={() => onAssignModerator(user.uid, true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors flex items-center gap-1 shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Сделать модератором
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation / Parameters Dialog */}
      {actionDialog.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {actionDialog.type === 'ban_dms' && 'Запрет писать первым'}
              {actionDialog.type === 'warn' && 'Официальное предупреждение'}
              {actionDialog.type === 'del_msg' && 'Удаление сообщения с предупреждением'}
              {actionDialog.type === 'del_group' && 'Удаление группы/канала'}
              {actionDialog.type === 'del_account' && 'Удаление аккаунта нарушителя'}
              {actionDialog.type === 'ban_email' && 'Удаление и пожизненный бан email'}
              {actionDialog.type === 'dismiss' && 'Отклонение жалобы'}
            </h3>

            {actionDialog.type === 'ban_dms' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Срок ограничения (часов)
                </label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white"
                >
                  <option value={1}>1 час</option>
                  <option value={6}>6 часов</option>
                  <option value={24}>24 часа (1 сутки)</option>
                  <option value={72}>72 часа (3 суток)</option>
                  <option value={168}>168 часов (7 дней)</option>
                  <option value={720}>720 часов (30 дней)</option>
                </select>
              </div>
            )}

            {(actionDialog.type === 'warn' || actionDialog.type === 'del_msg' || actionDialog.type === 'del_group') && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Текст предупреждения нарушителю
                </label>
                <textarea
                  value={warningText}
                  onChange={(e) => setWarningText(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white resize-none"
                />
              </div>
            )}

            {actionDialog.type !== 'dismiss' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Причина / ссылка на закон РФ
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setActionDialog({ open: false, type: null })}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow-sm"
              >
                Применить меру
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
