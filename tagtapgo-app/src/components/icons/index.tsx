/**
 * Icon System
 * Centralized icon exports using Ionicons from react-icons/io5
 * Provides consistent icon sizing and usage across the application
 */

import React from 'react';
import {
  IoHomeOutline,
  IoHome,
  IoTrophyOutline,
  IoTrophy,
  IoGiftOutline,
  IoGift,
  IoPersonOutline,
  IoPerson,
  IoChatbubbleOutline,
  IoChatbubble,
  IoSparklesOutline,
  IoSparkles,
  IoSettingsOutline,
  IoSettings,
  IoNotificationsOutline,
  IoNotifications,
  IoStarOutline,
  IoStar,
  IoStatsChartOutline,
  IoStatsChart,
  IoFlagOutline,
  IoFlag,
  IoCheckmarkOutline,
  IoCheckmark,
  IoCloseOutline,
  IoClose,
  IoArrowForwardOutline,
  IoArrowBackOutline,
  IoRefreshOutline,
  IoAddOutline,
  IoRemoveOutline,
  IoSearchOutline,
  IoCameraOutline,
  IoAttachOutline,
  IoHappyOutline,
  IoSendOutline,
  IoCalendarOutline,
  IoTimeOutline,
  IoLocationOutline,
  IoMailOutline,
  IoLockClosedOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoHeartOutline,
  IoHeart,
  IoShareOutline,
  IoBookmarkOutline,
  IoBookmark,
  IoFlameOutline,
  IoFlame,
  IoRibbonOutline,
  IoRibbon,
  IoSchoolOutline,
  IoSchool,
  IoPeopleOutline,
  IoPeople,
  IoAlertCircleOutline,
  IoInformationCircleOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoCashOutline,
  IoTrendingUpOutline,
  IoTrendingDownOutline,
  IoSnowOutline,
  IoFlashOutline,
  IoEllipseOutline,
  IoRocketOutline,
  IoRocket,
} from 'react-icons/io5';

// Export individual icons with semantic names
export { 
  IoHomeOutline as HomeIcon,
  IoHome as HomeIconFilled,
  IoTrophyOutline as TrophyIcon,
  IoTrophy as TrophyIconFilled,
  IoGiftOutline as GiftIcon,
  IoGift as GiftIconFilled,
  IoPersonOutline as PersonIcon,
  IoPerson as PersonIconFilled,
  IoChatbubbleOutline as ChatIcon,
  IoChatbubble as ChatIconFilled,
  IoSparklesOutline as AIIcon,
  IoSparkles as AIIconFilled,
  IoSettingsOutline as SettingsIcon,
  IoSettings as SettingsIconFilled,
  IoNotificationsOutline as NotificationIcon,
  IoNotifications as NotificationIconFilled,
  IoStarOutline as StarIcon,
  IoStar as StarIconFilled,
  IoStatsChartOutline as StatsIcon,
  IoStatsChart as StatsIconFilled,
  IoFlagOutline as TargetIcon,
  IoFlag as TargetIconFilled,
  IoCheckmarkOutline as CheckIcon,
  IoCheckmark as CheckIconFilled,
  IoCloseOutline as CloseIcon,
  IoClose as CloseIconFilled,
  IoArrowForwardOutline as ArrowForwardIcon,
  IoArrowBackOutline as ArrowBackIcon,
  IoRefreshOutline as RefreshIcon,
  IoAddOutline as AddIcon,
  IoRemoveOutline as RemoveIcon,
  IoSearchOutline as SearchIcon,
  IoCameraOutline as CameraIcon,
  IoAttachOutline as AttachIcon,
  IoHappyOutline as EmojiIcon,
  IoSendOutline as SendIcon,
  IoCalendarOutline as CalendarIcon,
  IoTimeOutline as TimeIcon,
  IoLocationOutline as LocationIcon,
  IoMailOutline as MailIcon,
  IoLockClosedOutline as LockIcon,
  IoEyeOutline as EyeIcon,
  IoEyeOffOutline as EyeOffIcon,
  IoHeartOutline as HeartIcon,
  IoHeart as HeartIconFilled,
  IoShareOutline as ShareIcon,
  IoBookmarkOutline as BookmarkIcon,
  IoBookmark as BookmarkIconFilled,
  IoFlameOutline as FlameIcon,
  IoFlame as FlameIconFilled,
  IoRibbonOutline as RibbonIcon,
  IoRibbon as RibbonIconFilled,
  IoSchoolOutline as SchoolIcon,
  IoSchool as SchoolIconFilled,
  IoPeopleOutline as PeopleIcon,
  IoPeople as PeopleIconFilled,
  IoAlertCircleOutline as AlertIcon,
  IoInformationCircleOutline as InfoIcon,
  IoCheckmarkCircleOutline as SuccessIcon,
  IoWarningOutline as WarningIcon,
  IoRocketOutline as RocketIcon,
  IoRocket as RocketIconFilled,
};

// Icon name mapping
const iconMap = {
  home: IoHomeOutline,
  homeFilled: IoHome,
  trophy: IoTrophyOutline,
  trophyFilled: IoTrophy,
  gift: IoGiftOutline,
  giftFilled: IoGift,
  person: IoPersonOutline,
  personFilled: IoPerson,
  chat: IoChatbubbleOutline,
  chatFilled: IoChatbubble,
  ai: IoSparklesOutline,
  aiFilled: IoSparkles,
  settings: IoSettingsOutline,
  settingsFilled: IoSettings,
  notification: IoNotificationsOutline,
  notificationFilled: IoNotifications,
  star: IoStarOutline,
  starFilled: IoStar,
  stats: IoStatsChartOutline,
  statsFilled: IoStatsChart,
  target: IoFlagOutline,
  targetFilled: IoFlag,
  checkmark: IoCheckmarkOutline,
  checkmarkFilled: IoCheckmark,
  close: IoCloseOutline,
  closeFilled: IoClose,
  arrowForward: IoArrowForwardOutline,
  arrowBack: IoArrowBackOutline,
  refresh: IoRefreshOutline,
  add: IoAddOutline,
  remove: IoRemoveOutline,
  search: IoSearchOutline,
  camera: IoCameraOutline,
  attach: IoAttachOutline,
  emoji: IoHappyOutline,
  send: IoSendOutline,
  calendar: IoCalendarOutline,
  time: IoTimeOutline,
  location: IoLocationOutline,
  mail: IoMailOutline,
  lock: IoLockClosedOutline,
  eye: IoEyeOutline,
  eyeOff: IoEyeOffOutline,
  heart: IoHeartOutline,
  heartFilled: IoHeart,
  share: IoShareOutline,
  bookmark: IoBookmarkOutline,
  bookmarkFilled: IoBookmark,
  flame: IoFlameOutline,
  flameFilled: IoFlame,
  ribbon: IoRibbonOutline,
  ribbonFilled: IoRibbon,
  school: IoSchoolOutline,
  schoolFilled: IoSchool,
  people: IoPeopleOutline,
  peopleFilled: IoPeople,
  alertCircle: IoAlertCircleOutline,
  info: IoInformationCircleOutline,
  success: IoCheckmarkCircleOutline,
  warning: IoWarningOutline,
  cash: IoCashOutline,
  coin: IoEllipseOutline,
  trendingUp: IoTrendingUpOutline,
  trendingDown: IoTrendingDownOutline,
  snow: IoSnowOutline,
  flash: IoFlashOutline,
  rocket: IoRocketOutline,
  rocketFilled: IoRocket,
} as const;

export type IconName = keyof typeof iconMap;

// Icon size mapping
export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSize = keyof typeof iconSizes;

// Icon wrapper component for consistent sizing
interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ 
  name,
  size = 'md', 
  color,
  className 
}) => {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return null;
  }
  
  return (
    <IconComponent 
      size={iconSizes[size]} 
      color={color} 
      className={className}
    />
  );
};
