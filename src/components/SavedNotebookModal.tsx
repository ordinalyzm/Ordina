import React from 'react';
import { ChatMediaModal } from './ChatMediaModal';
import { Message, UserProfile } from '../types';

export interface SavedNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  user?: UserProfile | null | any;
  messages: Message[];
  onSelectMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onOpenEditProfile?: () => void;
}

export const SavedNotebookModal: React.FC<SavedNotebookModalProps> = ({
  isOpen,
  onClose,
  profile: propProfile,
  user,
  messages,
  onSelectMessage,
  onDeleteMessage,
  onOpenEditProfile,
}) => {
  const profile = propProfile || user || null;

  return (
    <ChatMediaModal
      isOpen={isOpen}
      onClose={onClose}
      title={profile?.displayName || 'Мой блокнот'}
      subtitle={profile?.username ? `@${profile.username} • Личное хранилище` : 'Личный блокнот и хранилище'}
      photoURL={profile?.photoURL}
      isVerified={profile?.isVerified}
      messages={messages}
      onSelectMessage={onSelectMessage}
      onDeleteMessage={onDeleteMessage}
      onOpenEditProfile={onOpenEditProfile}
    />
  );
};
export default SavedNotebookModal;
