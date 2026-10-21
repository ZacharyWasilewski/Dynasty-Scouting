"use client";
import { useEffect, useRef, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
const stack: HTMLElement[] = [];
let previousOverflow = "";
export function DialogSurface({ onClose, children, ...props }: HTMLAttributes<HTMLDivElement> & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const root = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!stack.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    stack.push(root);
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el => el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true");
    (root.querySelector<HTMLElement>('input:not([disabled])') ?? focusables()[0] ?? root).focus();
    function keydown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== root) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key === "Tab") {
        const list = focusables(); const first = list[0]; const last = list[list.length - 1];
        if (!first) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    function contain(event: FocusEvent) { if (stack[stack.length - 1] === root && !root.contains(event.target as Node)) (focusables()[0] ?? root).focus(); }
    document.addEventListener("keydown", keydown, true); document.addEventListener("focusin", contain);
    return () => {
      stack.splice(stack.indexOf(root), 1);
      document.removeEventListener("keydown", keydown, true); document.removeEventListener("focusin", contain);
      if (!stack.length) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(<div {...props} ref={ref} tabIndex={-1} role="dialog" aria-modal="true">{children}</div>, document.body);
}
