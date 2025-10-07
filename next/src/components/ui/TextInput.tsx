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
  // Align heights with IconButton/Button/Select
  sm: "h-8 text-sm",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
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

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {/* Input container */}
        {label && (
            <label htmlFor={inputId} className={clsx("block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300")}>
              {label}{props.required && (<span aria-hidden className="ml-1 text-red-500">*</span>)}
            </label>
          )}
          
        <div className={clsx(
            "relative rounded-full px-3 py-2 border border-transparent transition-all duration-200",
            "bg-gray-100 dark:bg-gray-950/80",
            "focus-within:bg-white dark:focus-within:bg-gray-900",
            "focus-within:border-primary-500 dark:focus-within:border-primary-400/50",
            "focus-within:ring-2 focus-within:ring-primary-500/20",
            error && "border-red-500 dark:border-red-400 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/20"
          )}>
          

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
              placeholder={props.placeholder}
              className={clsx(
                "peer w-full text-base! md:text-sm! h-full bg-transparent border-none outline-none pl-1",
                "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
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
