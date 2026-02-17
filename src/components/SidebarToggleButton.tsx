import React from "react";
import { Menu } from "lucide-react";

type SidebarToggleButtonProps = {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  iconSize?: number;
};

export const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({
  onClick,
  className,
  ariaLabel = "Open workspace menu",
  iconSize = 24,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={className ?? "lg:hidden rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"}
    aria-label={ariaLabel}
  >
    <Menu size={iconSize} />
  </button>
);
