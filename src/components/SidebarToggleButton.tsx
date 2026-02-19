import React, { createContext, useContext } from "react";
import { Menu } from "lucide-react";
import { Button } from "./ui/Button";

type SidebarToggleButtonProps = {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  iconSize?: number;
  forceRender?: boolean;
};

const SidebarInlineToggleContext = createContext(true);

export const SidebarInlineToggleProvider = SidebarInlineToggleContext.Provider;

export const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({
  onClick,
  className,
  ariaLabel = "Open workspace menu",
  iconSize = 24,
  forceRender = false,
}) => {
  const inlineToggleEnabled = useContext(SidebarInlineToggleContext);
  if (!forceRender && !inlineToggleEnabled) return null;

  return (
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
};
