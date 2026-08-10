import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely, resolving conflicting utility
 * classes in favor of the last one supplied.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
