/** Build a safe download filename from a screenplay title and extension. */
export function safeFilename(title: string, ext: string): string {
  const base =
    title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "screenplay";
  return `${base}.${ext}`;
}
