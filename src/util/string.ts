type DateFormat =
  | 'YYYY DD MM HH:mm' // 2025 18 03 14:30
  | 'YYYY-DD-MM HH:mm' // 2025-18-03 14:30
  | 'YYYY/DD/MM HH:mm' // 2025/18/03 14:30
  | 'YYYY.DD.MM HH:mm' // 2025.18.03 14:30
  | 'YYYY DD MM | HH:mm' // 2025 18 03 | 14:30
  | 'YYYY_DD_MM_HHmm' // 2025_18_03_14_30
  | 'YYYYDDMM HHmm' // 20251803 1430
  | 'YYYY DD MMM HH:mm' // 2025 18 Mar 14:30
  | 'YYYY-MMMM-DD HH:mm' // 2025-March-18 14:30
  | 'DD-MM-YYYY HH:mm' // 18-03-2025 14:30
  | 'DD MMM YYYY HH:mm' // 18 Mar 2025 13:28
  | 'DD MMM HH:mm'
  | 'UK_FULL'; // Monday, April 14, 2025 – 10:00 AM GMT

export const formatDate = (
  date: string | Date,
  format: DateFormat = 'YYYY DD MM HH:mm',
): string => {
  const d = new Date(date);

  // Convert UTC to local time if the date is in UTC (has 'Z' suffix)
  /* if (typeof date === "string" && date.endsWith("Z")) {
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  }*/

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const fullMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const replacements: Record<string, string> = {
    YYYY: year.toString(),
    DD: day,
    MM: month,
    MMM: monthNames[d.getMonth()],
    MMMM: fullMonthNames[d.getMonth()],
    HH: hours,
    mm: minutes,
    DDDD: dayNames[d.getDay()],
  };

  if (format === 'UK_FULL') {
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    const hour12 = d.getHours() % 12 || 12;
    return `${dayNames[d.getDay()]}, ${fullMonthNames[d.getMonth()]} ${day}, ${year} – ${hour12}:${minutes} ${ampm} GMT`;
  }

  return format.replace(/YYYY|DD|MMM|MM|MMMM|HH|mm|DDDD/g, (match) => replacements[match] || match);
};

export const formatDateToLocale = (
  date: string | Date,
  timezone: string = 'Europe/London',
): string => {
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
};

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
  if (base64.startsWith('data:image/')) {
    // Extract content type from base64 string
    const match = base64.match(/^data:image\/(\w+);base64,/);
    return match ? `image/${match[1]}` : 'image/jpeg';
  }
  // For URLs, try to determine from extension
  const extension = base64.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
};

export const extractExtensionfromS3Url = (url: string): string => {
  const urlParts = url.split('.amazonaws.com/');
  return urlParts[1] || '';
};

export const getContentTypeFromS3Url = (url: string): string => {
  const extension = url.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg'; // default to jpeg if unknown
  }
};

export const generateSecurePassword = (length = 8): string => {
  // Exclude confusing characters like O,0,1,l,I
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@$';
  let password = '';

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
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

export const getContentTypeFromAssetType = (assetType: string): string => {
  switch (assetType) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mpeg';
    case 'document':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
};

export const getKeyFromUrl = (url: string): string => {
  const urlParts = url.split('.amazonaws.com/');
  return urlParts[1] || '';
};
