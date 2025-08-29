// apps/web/src/components/ui/checkbox.tsx
"use client";
import * as React from "react";

export type CheckedState = boolean | "indeterminate";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked"> {
  checked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, className = "", ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    // Supporta stato "indeterminate" come in shadcn
    React.useEffect(() => {
      if (!innerRef.current) return;
      innerRef.current.indeterminate = checked === "indeterminate";
    }, [checked]);

    const isChecked = checked === "indeterminate" ? false : !!checked;

    return (
      <input
        ref={innerRef}
        type="checkbox"
        checked={isChecked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={
          "h-4 w-4 rounded border border-gray-300 align-middle " +
          "text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 " +
          "disabled:opacity-50 disabled:cursor-not-allowed " +
          className
        }
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";
