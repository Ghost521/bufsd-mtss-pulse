import React from "react";
import { Menu } from "lucide-react";
import { Button } from "./ui/Button";

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
  <Button
    variant="ghost"
    size="icon"
    onClick={onClick}
    className={className ?? "app-icon-button lg:hidden transition-colors"}
    aria-label={ariaLabel}
  >
    <Menu size={iconSize} />
  </Button>
);
