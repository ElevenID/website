// Vite IDs use slash paths even when Node's fileURLToPath uses Windows separators.
export function modulePath(value) {
  return value?.split('?')[0].replaceAll("\\", '/');
}
