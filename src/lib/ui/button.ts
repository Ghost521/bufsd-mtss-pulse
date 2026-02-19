export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  emphasis?: boolean;
  fullWidth?: boolean;
  className?: string;
};

const joinClasses = (...tokens: Array<string | false | null | undefined>): string =>
  tokens.filter(Boolean).join(" ");

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
  icon: "btn-icon",
  "icon-sm": "btn-icon-sm",
};

export const buttonClassNames = ({
  variant = "secondary",
  size = "md",
  emphasis = false,
  fullWidth = false,
  className,
}: ButtonClassOptions = {}): string =>
  joinClasses(
    "btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    emphasis && "btn-emphasis",
    fullWidth && "btn-block",
    className,
  );

