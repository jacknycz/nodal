import React, { useState } from "react";
import clsx from "clsx";

export type TextInputSize = "sm" | "md" | "lg";

interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  description?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: TextInputSize;
  fullWidth?: boolean;
}

const sizeClasses: Record<TextInputSize, string> = {
  sm: "h-[32px] text-sm",
  md: "h-[40px] text-sm",
  lg: "h-[48px] text-base",
};

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      description,
      error,
      leftIcon,
      rightIcon,
      size = "md",
      fullWidth = false,
      className = "",
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId =
      props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const [isFocused, setIsFocused] = useState(false);

    const isActive = isFocused || (value && value.toString().length > 0);

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {/* Input container */}
        <div
          className={clsx(
            "relative rounded-full px-3 border border-transparent transition-all duration-200",
            label ? "pt-0" : "pt-0",
            "bg-gray-100 dark:bg-gray-950/80",
            "focus-within:bg-white dark:focus-within:bg-gray-900",
            "focus-within:border-primary-500 dark:focus-within:border-primary-400/50",
            "focus-within:ring-2 focus-within:ring-primary-500/20",
            error &&
              "border-red-500 dark:border-red-400 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/20",
            sizeClasses[size]
          )}
        >
          {/* Label */}
          {label && (
            <label
              htmlFor={inputId}
              className={clsx(
                "absolute px-4 rounded-full dark:bg-gray-950/80 left-4 font-medium transition-all duration-200",
                "text-gray-500 dark:text-gray-400",
                error &&
                  "text-red-500 dark:text-red-400 peer-focus:text-red-500 dark:peer-focus:text-red-400",
                isActive
                  ? "-top-2 left-0! bg-white text-xs"
                  : "top-1/2 -translate-y-1/2 text-sm"
              )}
            >
              {label}
              {props.required && (
                <span aria-hidden className="ml-1 text-red-500">*</span>
              )}
            </label>
          )}

          {/* Input */}
          <div className={clsx("relative h-full", fullWidth && "w-full")}>
            {leftIcon && (
              <span className="absolute inset-y-0 left-2 flex items-center text-gray-400">
                {leftIcon}
              </span>
            )}
            <input
              ref={ref}
              id={inputId}
              value={value}
              onChange={onChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={label ? " " : props.placeholder} // keeps floating label working
              className={clsx(
                "peer w-full h-full bg-transparent border-none outline-none pl-1",
                "text-gray-900 dark:text-white placeholder-transparent",
                leftIcon && "pl-8",
                rightIcon && "pr-8",
                className
              )}
              {...props}
            />
            {rightIcon && (
              <span className="absolute inset-y-0 right-2 flex items-center text-gray-400">
                {rightIcon}
              </span>
            )}
          </div>
        </div>

        {/* Helper text */}
        {description && !error && (
          <span className="text-xs text-gray-500 dark:text-gray-400 px-1">
            {description}
          </span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400 px-1">
            {error}
          </span>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

export default TextInput;
