import React, { forwardRef } from "react";
import { buttonClassNames, type ButtonSize, type ButtonVariant } from "../../lib/ui/button";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  size?: ButtonSize;
  emphasis?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      emphasis = false,
      fullWidth = false,
      loading = false,
      disabled,
      className,
      type = "button",
      leftIcon,
      rightIcon,
      children,
      ...rest
    },
    ref,
  ) => {
    const resolvedVariant = variant as ButtonVariant;
    const resolvedSize = size as ButtonSize;
    const isDisabled = Boolean(disabled || loading);
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClassNames({ variant: resolvedVariant, size: resolvedSize, emphasis, fullWidth, className })}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-loading={loading ? "true" : undefined}
        {...rest}
      >
        {loading ? <span className="btn-spinner" aria-hidden="true" /> : leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";
