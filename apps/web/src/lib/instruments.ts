// apps/web/src/lib/instruments.ts
import type { Canonical } from "./aliases";

export type InstrumentSpec = {
  symbol: Canonical;
  tick_size: number;
  tick_value: number; // valore del tick per 1.00 lot
  min_lot: number;
  lot_step: number;
  max_lot: number;
};

// NOTE: valori comuni/indicativi. Verifica poi con Key to Markets e correggi qui.
export const INSTRUMENTS: Record<Canonical, InstrumentSpec> = {
  // Forex (tick 0.0001, tick_value ~10€ per 1 lot su EURUSD)
  EURUSD: { symbol:"EURUSD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  GBPUSD: { symbol:"GBPUSD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  AUDUSD: { symbol:"AUDUSD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  NZDUSD: { symbol:"NZDUSD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  USDJPY: { symbol:"USDJPY", tick_size:0.01,   tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  USDCHF: { symbol:"USDCHF", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  USDCAD: { symbol:"USDCAD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  EURJPY: { symbol:"EURJPY", tick_size:0.01,   tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  GBPJPY: { symbol:"GBPJPY", tick_size:0.01,   tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  AUDJPY: { symbol:"AUDJPY", tick_size:0.01,   tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  NZDJPY: { symbol:"NZDJPY", tick_size:0.01,   tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  CADJPY: { symbol:"CADJPY", tick_size:0.01,   tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  EURNZD: { symbol:"EURNZD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  AUDNZD: { symbol:"AUDNZD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  EURCAD: { symbol:"EURCAD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  EURAUD: { symbol:"EURAUD", tick_size:0.0001, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },

  // Indici (placeholder comuni CFD)
  SPX:    { symbol:"SPX",    tick_size:1, tick_value:1, min_lot:0.1, lot_step:0.1, max_lot:500 },
  US100:  { symbol:"US100",  tick_size:1, tick_value:1, min_lot:0.1, lot_step:0.1, max_lot:500 },
  DAX:    { symbol:"DAX",    tick_size:1, tick_value:1, min_lot:0.1, lot_step:0.1, max_lot:500 },
  US500:  { symbol:"US500",  tick_size:1, tick_value:1, min_lot:0.1, lot_step:0.1, max_lot:500 },
  FTSEMIB:{ symbol:"FTSEMIB",tick_size:1, tick_value:1, min_lot:0.1, lot_step:0.1, max_lot:500 },
  JP225:  { symbol:"JP225",  tick_size:1, tick_value:1, min_lot:0.1, lot_step:0.1, max_lot:500 },

  // Commodities / Metals (placeholder)
  XAUUSD: { symbol:"XAUUSD", tick_size:0.1, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:100 },
  XAGUSD: { symbol:"XAGUSD", tick_size:0.01,tick_value:5,  min_lot:0.01, lot_step:0.01, max_lot:100 },
  XPTUSD: { symbol:"XPTUSD", tick_size:0.1, tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:50 },
  USOIL:  { symbol:"USOIL",  tick_size:0.01,tick_value:10, min_lot:0.01, lot_step:0.01, max_lot:1000 },
  NGAS:   { symbol:"NGAS",   tick_size:0.001,tick_value:10,min_lot:0.01, lot_step:0.01, max_lot:1000 },
  CORN:   { symbol:"CORN",   tick_size:0.25,tick_value:12.5,min_lot:0.1, lot_step:0.1, max_lot:1000 },
  WHEAT:  { symbol:"WHEAT",  tick_size:0.25,tick_value:12.5,min_lot:0.1, lot_step:0.1, max_lot:1000 },
  COFFEE: { symbol:"COFFEE", tick_size:0.05,tick_value:18.75,min_lot:0.1, lot_step:0.1, max_lot:1000 },
  COCOA:  { symbol:"COCOA",  tick_size:1,   tick_value:10, min_lot:0.1, lot_step:0.1, max_lot:1000 },
  SUGAR:  { symbol:"SUGAR",  tick_size:0.01,tick_value:11.2,min_lot:0.1, lot_step:0.1, max_lot:1000 },
  SOYBEAN:{ symbol:"SOYBEAN",tick_size:0.25,tick_value:12.5,min_lot:0.1, lot_step:0.1, max_lot:1000 },

  // Bond
  US10Y:  { symbol:"US10Y",  tick_size:0.005, tick_value:7.8125, min_lot:0.1, lot_step:0.1, max_lot:500 },

  // Crypto (placeholder)
  BTCUSD: { symbol:"BTCUSD", tick_size:1, tick_value:1, min_lot:0.01, lot_step:0.01, max_lot:100 },
  ETHUSD: { symbol:"ETHUSD", tick_size:0.1, tick_value:1, min_lot:0.01, lot_step:0.01, max_lot:100 },
};
