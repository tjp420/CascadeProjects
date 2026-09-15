import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Copy text in a normal browser or in the IDE iframe (clipboard API is often blocked there). */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? "");
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok) return true;
  } catch {
    /* fall through */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ command: "copyText", text: value }, "*");
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
