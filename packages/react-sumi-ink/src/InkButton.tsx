import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useInk } from './useInk';

export interface InkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  splashAmount?: number;
}

export const InkButton = forwardRef<HTMLButtonElement, InkButtonProps>(function InkButton(
  { children, splashAmount = 1.1, onPointerDown, ...rest },
  ref,
) {
  const ink = useInk();
  return (
    <button
      type="button"
      data-ink="obstacle"
      ref={ref}
      {...rest}
      onPointerDown={(e) => {
        const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        ink.splash(r.left + r.width / 2, r.top + r.height / 2, {
          amount: splashAmount,
          radius: 12,
        });
        onPointerDown?.(e);
      }}
    >
      {children}
    </button>
  );
});