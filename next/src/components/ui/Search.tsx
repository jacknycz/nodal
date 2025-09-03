import { useState } from "react";
import { MagnifyingGlass } from '@phosphor-icons/react'

export default function FloatingSearch({
  label = "Search",
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  id = 'floating-search'
}: {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  className?: string
  id?: string
}) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = typeof value !== 'undefined'
  const displayValue = isControlled ? value : internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e)
    else setInternalValue(e.target.value)
  }

  return (
    <div className={"w-full relative " + className}>
      {/* Search icon */}
      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none" />

      {/* Input */}
      <input
        type="text"
        id={id}
        value={displayValue}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder=" "
        aria-label={placeholder || label}
        className="
          peer w-full rounded-full border border-transparent dark:border-primary-500/20
          shadow-2xl shadow-gray-400/20 dark:shadow-2xl dark:shadow-primary-500/40
          bg-white dark:bg-gray-900/80
          pl-10 pr-3 pt-5 pb-2
          text-sm text-gray-900 dark:text-gray-100
          placeholder-transparent
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          transition
        "
      />

      {/* Floating label */}
      <label
        htmlFor={id}
        className="
          absolute left-10
          text-gray-500 dark:text-gray-400
          transition-all duration-200 ease-out
          pointer-events-none
          
          /* default (placeholder shown, no value) */
          top-1/2 -translate-y-1/2 text-base

          /* when focused or filled */
          peer-focus:top-3 peer-focus:text-sm peer-focus:text-primary-500
          peer-not-placeholder-shown:top-3 peer-not-placeholder-shown:text-sm
        "
      >
        {label}
      </label>
    </div>
  );
}
