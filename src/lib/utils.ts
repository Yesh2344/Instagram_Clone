import { clsx, type ClassValue } from "clsx";
# Added comment
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
