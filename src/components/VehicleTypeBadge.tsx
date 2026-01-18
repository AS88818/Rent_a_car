import { User, Car } from 'lucide-react';

interface VehicleTypeBadgeProps {
  isPersonal: boolean;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function VehicleTypeBadge({
  isPersonal,
  size = 'md',
  showIcon = true,
  className = ''
}: VehicleTypeBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  if (isPersonal) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border-2 border-amber-400 bg-amber-50 text-amber-800 ${sizeClasses[size]} ${className}`}>
        {showIcon && <User className={iconSizes[size]} />}
        Personal
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border-2 border-blue-400 bg-blue-50 text-blue-800 ${sizeClasses[size]} ${className}`}>
      {showIcon && <Car className={iconSizes[size]} />}
      Business
    </span>
  );
}
