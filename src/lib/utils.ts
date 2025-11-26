import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts localhost URLs to use the current hostname for external browser access.
 * This allows the app to work when accessed from external browsers.
 * 
 * @param apiUrl - The API URL that may contain localhost
 * @returns The normalized API URL with localhost replaced by current hostname (if applicable)
 */
export function normalizeApiUrl(apiUrl: string): string {
  if (typeof window === "undefined") {
    // Server-side: return as-is
    return apiUrl;
  }

  // If the URL contains localhost, replace it with the current hostname
  // This allows external browsers to connect to the server
  const currentHost = window.location.hostname;
  
  // Only replace if we're not already on localhost (to avoid breaking local development)
  if (apiUrl.includes("localhost") && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
    return apiUrl.replace(/localhost|127\.0\.0\.1/g, currentHost);
  }

  return apiUrl;
}
