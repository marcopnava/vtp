// apps/web/src/lib/aliases.ts

// Canonical = ticker che usiamo in piattaforma
export type Canonical =
  | "EURUSD" | "GBPUSD" | "AUDUSD" | "NZDUSD" | "USDJPY" | "USDCHF" | "USDCAD"
  | "EURJPY" | "GBPJPY" | "AUDJPY" | "NZDJPY" | "CADJPY" | "EURNZD" | "AUDNZD"
  | "EURCAD" | "EURAUD"
  | "SPX" | "US100" | "DAX" | "US500" | "FTSEMIB" | "JP225"
  | "XAUUSD" | "XAGUSD" | "USOIL" | "NGAS" | "CORN" | "WHEAT" | "COFFEE" | "COCOA" | "SUGAR" | "SOYBEAN"
  | "US10Y"
  | "BTCUSD" | "ETHUSD"
  | "XPTUSD";

// Mappa alias (come appaiono nei report COT/testi) -> Canonical.
// Puoi ampliare liberamente con nuove chiavi.
export const ALIAS_TO_CANONICAL: Record<string, Canonical> = {
  // Forex major/cross
  "EURUSD": "EURUSD", "EUR/USD": "EURUSD", "EURO": "EURUSD", "EURO FX": "EURUSD",
  "GBPUSD": "GBPUSD", "GBP/USD": "GBPUSD", "BRITISH POUND": "GBPUSD", "STERLING": "GBPUSD",
  "AUDUSD": "AUDUSD", "AUD/USD": "AUDUSD", "AUSTRALIAN DOLLAR": "AUDUSD",
  "NZDUSD": "NZDUSD", "NZD/USD": "NZDUSD", "NEW ZEALAND DOLLAR": "NZDUSD",
  "USDJPY": "USDJPY", "USD/JPY": "USDJPY", "JAPANESE YEN": "USDJPY",
  "USDCHF": "USDCHF", "USD/CHF": "USDCHF", "SWISS FRANC": "USDCHF",
  "USDCAD": "USDCAD", "USD/CAD": "USDCAD", "CANADIAN DOLLAR": "USDCAD",

  "EURJPY": "EURJPY", "EUR/JPY": "EURJPY",
  "GBPJPY": "GBPJPY", "GBP/JPY": "GBPJPY",
  "AUDJPY": "AUDJPY", "AUD/JPY": "AUDJPY",
  "NZDJPY": "NZDJPY", "NZD/JPY": "NZDJPY",
  "CADJPY": "CADJPY", "CAD/JPY": "CADJPY",

  "EURNZD": "EURNZD", "EUR/NZD": "EURNZD",
  "AUDNZD": "AUDNZD", "AUD/NZD": "AUDNZD",
  "EURCAD": "EURCAD", "EUR/CAD": "EURCAD",
  "EURAUD": "EURAUD", "EUR/AUD": "EURAUD",

  // Indici
  "S&P 500": "SPX", "SPX": "SPX", "E-MINI S&P 500": "SPX",
  "NASDAQ": "US100", "NASDAQ-100": "US100", "US100": "US100",
  "DAX": "DAX", "GERMAN DAX": "DAX",
  "DOW JONES": "US500", "US500": "US500",
  "FTSE MIB": "FTSEMIB", "FTSEMIB": "FTSEMIB",
  "NIKKEI": "JP225", "JP225": "JP225",

  // Commodities / Energy / Grains / Softs / Metals
  "GOLD": "XAUUSD", "XAUUSD": "XAUUSD",
  "SILVER": "XAGUSD", "XAGUSD": "XAGUSD",
  "PLATINUM": "XPTUSD", "XPTUSD": "XPTUSD",

  "CRUDE OIL": "USOIL", "WTI": "USOIL", "WTI CRUDE": "USOIL", "LIGHT SWEET CRUDE": "USOIL", "USOIL": "USOIL",
  "NATURAL GAS": "NGAS", "NGAS": "NGAS",
  "CORN": "CORN",
  "WHEAT": "WHEAT",
  "COFFEE": "COFFEE",
  "COCOA": "COCOA",
  "SUGAR": "SUGAR",
  "SOYBEANS": "SOYBEAN", "SOYBEAN": "SOYBEAN",

  // Bond
  "US 10Y": "US10Y", "10-YEAR TREASURY": "US10Y", "UST10Y": "US10Y",

  // Crypto
  "BITCOIN": "BTCUSD", "BTC": "BTCUSD", "BTCUSD": "BTCUSD",
  "ETHEREUM": "ETHUSD", "ETH": "ETHUSD", "ETHUSD": "ETHUSD",
};
