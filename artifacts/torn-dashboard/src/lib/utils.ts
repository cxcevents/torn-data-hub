import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeRemaining(secondsTotal: number) {
  if (!secondsTotal || secondsTotal <= 0) return "Ready";
  const h = Math.floor(secondsTotal / 3600);
  const m = Math.floor((secondsTotal % 3600) / 60);
  const s = secondsTotal % 60;
  
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function stripHtml(html: string) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function formatLargeNumber(num: number, isCurrency = false): string {
  if (num === undefined || num === null) return "0";
  
  let formatted = "";
  if (num >= 1e9) {
    formatted = (num / 1e9).toFixed(2) + "B";
  } else if (num >= 1e6) {
    formatted = (num / 1e6).toFixed(2) + "M";
  } else if (num >= 1e3) {
    formatted = (num / 1e3).toFixed(1) + "k";
  } else {
    formatted = num.toLocaleString();
  }

  return isCurrency ? `$${formatted}` : formatted;
}

export function formatNumber(num: number, isCurrency = false): string {
  if (num === undefined || num === null) return "0";
  const formatted = num.toLocaleString();
  return isCurrency ? `$${formatted}` : formatted;
}
