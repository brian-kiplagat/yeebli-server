export const randomString = (len: number) => {
  let text = '';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';

  // Generate the first character from the letters
  text += letters.charAt(Math.floor(Math.random() * letters.length));
  const possible = letters + digits;

  // Generate the remaining characters from the full set
  for (let i = 1; i < len; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

export const getContentType = (base64: string): string => {
  if (base64.startsWith("data:image/")) {
    // Extract content type from base64 string
    const match = base64.match(/^data:image\/(\w+);base64,/);
    return match ? `image/${match[1]}` : "image/jpeg";
    }
    // For URLs, try to determine from extension
    const extension = base64.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      default:
        return "image/jpeg";
    }
  }
