export const randomString = (len: number) => {
  let text = "";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";

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
};

export const extractExtensionfromS3Url = (url: string): string => {
  const urlParts = url.split(".amazonaws.com/");
  return urlParts[1] || "";
};

export const getContentTypeFromS3Url = (url: string): string => {
  const extension = url.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg"; // default to jpeg if unknown
  }
};

export const generateSecurePassword = (length: number = 6): string => {
  // Exclude confusing characters like O,0,1,l,I
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@$";
  let password = "";

  // Ensure at least one uppercase, one lowercase, one number, and one special char
  password += chars.match(/[A-Z]/)![0]; // One uppercase
  password += chars.match(/[a-z]/)![0]; // One lowercase
  password += chars.match(/[0-9]/)![0]; // One number
  password += chars.match(/[#@$]/)![0]; // One special char

  // Fill the rest with random chars
  for (let i = password.length; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Shuffle the password to make it more random
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};
