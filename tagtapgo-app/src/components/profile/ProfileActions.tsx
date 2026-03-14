/**
 * ProfileActions Component
 * Displays action buttons for profile management
 * Requirements: 7.3, 7.4, 7.5
 */

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface ProfileActionsProps {
  onEditProfile?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
  className?: string;
}

/**
 * ProfileActions Component
 * Displays action buttons for profile management with Ionicons
 */
export const ProfileActions: React.FC<ProfileActionsProps> = ({
  onEditProfile,
  onSettings,
  onLogout,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Edit Profile */}
      {onEditProfile && (
        <Button
          variant="secondary"
          size="lg"
          onClick={onEditProfile}
          className="w-full justify-start"
        >
          <Icon name="person" size="md" />
          <span>Edit Profile</span>
        </Button>
      )}
      
      {/* Settings */}
      {onSettings && (
        <Button
          variant="secondary"
          size="lg"
          onClick={onSettings}
          className="w-full justify-start"
        >
          <Icon name="settings" size="md" />
          <span>Settings</span>
        </Button>
      )}
      
      {/* Logout */}
      {onLogout && (
        <Button
          variant="ghost"
          size="lg"
          onClick={onLogout}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Icon name="close" size="md" />
          <span>Logout</span>
        </Button>
      )}
    </div>
  );
};
