/**
 * Currencies a cafe can trade in. `symbol` is what gets written to the cafe
 * database (cafes.currency) and is what the ordering app displays.
 */
export type Currency = { code: string; symbol: string; name: string; locale: string };

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "AED", symbol: "AED ", name: "UAE Dirham", locale: "en-AE" },
  { code: "SAR", symbol: "SAR ", name: "Saudi Riyal", locale: "en-SA" },
  { code: "QAR", symbol: "QAR ", name: "Qatari Riyal", locale: "en-QA" },
  { code: "KWD", symbol: "KWD ", name: "Kuwaiti Dinar", locale: "en-KW" },
  { code: "OMR", symbol: "OMR ", name: "Omani Rial", locale: "en-OM" },
  { code: "BHD", symbol: "BHD ", name: "Bahraini Dinar", locale: "en-BH" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY" },
  { code: "THB", symbol: "฿", name: "Thai Baht", locale: "th-TH" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", locale: "en-PH" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", locale: "vi-VN" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", locale: "ko-KR" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", locale: "en-HK" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", locale: "es-MX" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR" },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE" },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound", locale: "ar-EG" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
  { code: "CHF", symbol: "CHF ", name: "Swiss Franc", locale: "de-CH" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", locale: "sv-SE" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", locale: "nb-NO" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", locale: "da-DK" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", locale: "pl-PL" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", locale: "cs-CZ" },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", locale: "en-PK" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", locale: "bn-BD" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", locale: "si-LK" },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee", locale: "ne-NP" },
  { code: "MUR", symbol: "Rs", name: "Mauritian Rupee", locale: "en-MU" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function currencyByCode(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Format an amount with a cafe's currency symbol, e.g. "₹3,980" or "$1,240". */
export function money(amount: number, symbol = "₹"): string {
  const cur = CURRENCIES.find((c) => c.symbol === symbol);
  return `${symbol}${Math.round(amount).toLocaleString(cur?.locale ?? "en-IN")}`;
}

/** Common time zones offered in the cafe form. */
export const TIME_ZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Muscat", "Asia/Bahrain",
  "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Bangkok", "Asia/Jakarta", "Asia/Manila", "Asia/Ho_Chi_Minh",
  "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Karachi", "Asia/Dhaka", "Asia/Colombo", "Asia/Kathmandu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Istanbul",
  "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "Africa/Cairo",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Mexico_City", "America/Sao_Paulo",
  "Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Pacific/Auckland",
];
