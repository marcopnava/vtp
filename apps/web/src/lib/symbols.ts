// apps/web/src/lib/symbols.ts
import type { Canonical } from "./aliases";

export const SYMBOLS: Canonical[] = [
  // Forex (16)
  "EURUSD","GBPUSD","AUDUSD","NZDUSD","USDJPY","USDCHF","USDCAD",
  "EURJPY","GBPJPY","AUDJPY","NZDJPY","CADJPY","EURNZD","AUDNZD","EURCAD","EURAUD",
  // Indici (6)
  "SPX","US100","DAX","US500","FTSEMIB","JP225",
  // Commodities (10)
  "XAUUSD","XAGUSD","USOIL","NGAS","CORN","WHEAT","COFFEE","COCOA","SUGAR","SOYBEAN",
  // Bond (1)
  "US10Y",
  // Crypto (2)
  "BTCUSD","ETHUSD",
  // Metallo extra (1)
  "XPTUSD",
];
