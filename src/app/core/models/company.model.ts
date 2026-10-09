// ── Sector enum & company model ──

export const SECTORS = ['TECH', 'PHARMA', 'BANK', 'ENERGY', 'CONSUMER', 'INFRA'] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  TECH: 'Technology',
  PHARMA: 'Pharmacy & Healthcare',
  BANK: 'Banks & Financials',
  ENERGY: 'Energy & Renewables',
  CONSUMER: 'Consumer & Media',
  INFRA: 'Industrials & Infra',
};

export const SECTOR_INDEX_NAMES: Record<Sector, string> = {
  TECH: 'PX-TECH',
  PHARMA: 'PX-PHARMA',
  BANK: 'PX-BANK',
  ENERGY: 'PX-ENERGY',
  CONSUMER: 'PX-CONSUMER',
  INFRA: 'PX-INFRA',
};

export type Volatility = 'low' | 'medium' | 'high' | 'very-high';

export interface Company {
  ticker: string;
  name: string;
  sector: Sector;
  bio: string;
  basePrice: number;
  beta: number;
  volatility: Volatility;
  marketCap: number; // in crores ₹
}

// ── Price & candle data ──

export interface StockPrice {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
  vwap: number;
}

export interface CandleData {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Order book ──

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface OrderBook {
  ticker: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: number;
}

// ── Trades ──

export interface Trade {
  id: string;
  ticker: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: number;
  playerId?: string;
}

// ── Market tick (broadcast payload) ──

export interface MarketTick {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  sparklineData: number[];
}

// ── Sector index ──

export interface SectorIndex {
  sector: Sector;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

// ── Company roster (all 24) ──

export const COMPANY_LIST: Company[] = [
  // ── Technology ──
  { ticker: 'NXON', name: 'NexonAI Labs',       sector: 'TECH',   bio: 'Frontier AGI research & enterprise automation platform.',           basePrice: 4250, beta: 1.6, volatility: 'very-high', marketCap: 85000 },
  { ticker: 'SLCN', name: 'SilicaWorks',         sector: 'TECH',   bio: 'Advanced 2nm semiconductor fab and AI accelerator chip design.',     basePrice: 3180, beta: 1.4, volatility: 'high',      marketCap: 63600 },
  { ticker: 'CLDR', name: 'CloudRift Systems',   sector: 'TECH',   bio: 'Hyperscale cloud infrastructure with 40+ edge regions.',             basePrice: 2860, beta: 1.3, volatility: 'medium',    marketCap: 57200 },
  { ticker: 'CYPH', name: 'CypherVault',         sector: 'TECH',   bio: 'Zero-trust cybersecurity and post-quantum encryption.',              basePrice: 1920, beta: 1.5, volatility: 'high',      marketCap: 38400 },

  // ── Pharmacy & Healthcare ──
  { ticker: 'GNCR', name: 'GenCure Biopharma',   sector: 'PHARMA', bio: 'Gene therapy & oncology pipeline with 3 drugs in Phase III.',        basePrice: 5100, beta: 1.7, volatility: 'very-high', marketCap: 102000 },
  { ticker: 'MDSN', name: 'MediSynth Labs',      sector: 'PHARMA', bio: 'India\'s largest generic & specialty drug manufacturer.',             basePrice: 1450, beta: 0.9, volatility: 'low',       marketCap: 29000 },
  { ticker: 'HLTH', name: 'HealthGrid Hospitals', sector: 'PHARMA', bio: 'Tier-1 hospital chain with 120+ locations & telemedicine.',          basePrice: 2340, beta: 0.8, volatility: 'low',       marketCap: 46800 },
  { ticker: 'DXPT', name: 'DiagnoPath',          sector: 'PHARMA', bio: 'AI-driven diagnostics & nationwide lab network.',                    basePrice: 3020, beta: 1.2, volatility: 'medium',    marketCap: 60400 },

  // ── Banks & Financials ──
  { ticker: 'AXCM', name: 'AxisCapital Markets', sector: 'BANK',   bio: 'Full-service investment banking, M&A advisory & brokerage.',        basePrice: 3750, beta: 1.1, volatility: 'medium',    marketCap: 75000 },
  { ticker: 'SHLD', name: 'ShieldLife Insurance', sector: 'BANK',  bio: 'Life & general insurance conglomerate with 50M+ policyholders.',     basePrice: 1680, beta: 0.7, volatility: 'low',       marketCap: 33600 },
  { ticker: 'EQTM', name: 'Equitum Asset Mgmt',  sector: 'BANK',  bio: 'Multi-strategy hedge fund & mutual fund house.',                     basePrice: 2560, beta: 1.0, volatility: 'medium',    marketCap: 51200 },
  { ticker: 'FPAY', name: 'FinPulse Payments',    sector: 'BANK',  bio: 'Digital payments & neo-banking platform with 80M+ users.',           basePrice: 4100, beta: 1.5, volatility: 'high',      marketCap: 82000 },

  // ── Energy & Renewables ──
  { ticker: 'PTRX', name: 'PetroVex Resources',  sector: 'ENERGY', bio: 'Oil & gas exploration and coastal refinery operations.',             basePrice: 2200, beta: 1.2, volatility: 'medium',    marketCap: 44000 },
  { ticker: 'SOLQ', name: 'SolarQuant Energy',   sector: 'ENERGY', bio: 'Utility-scale solar farms & grid-level battery storage.',            basePrice: 3400, beta: 1.4, volatility: 'high',      marketCap: 68000 },
  { ticker: 'GRDF', name: 'GridForce Power',     sector: 'ENERGY', bio: 'Smart grid infrastructure & EV charging networks.',                 basePrice: 1890, beta: 1.1, volatility: 'medium',    marketCap: 37800 },
  { ticker: 'HYDX', name: 'HydroNex',            sector: 'ENERGY', bio: 'Green hydrogen production & industrial decarbonization.',            basePrice: 2750, beta: 1.6, volatility: 'very-high', marketCap: 55000 },

  // ── Consumer, Retail & Media ──
  { ticker: 'URBN', name: 'UrbanBasket',         sector: 'CONSUMER', bio: 'Quick-commerce grocery delivery in 200+ cities.',                  basePrice: 1560, beta: 1.3, volatility: 'medium',    marketCap: 31200 },
  { ticker: 'LUXE', name: 'LuxeHaven Brands',    sector: 'CONSUMER', bio: 'Premium fashion & lifestyle conglomerate with 15 labels.',         basePrice: 4800, beta: 0.9, volatility: 'low',       marketCap: 96000 },
  { ticker: 'STRM', name: 'StreamForge Media',   sector: 'CONSUMER', bio: 'OTT streaming & gaming studio with 60M+ subscribers.',            basePrice: 2100, beta: 1.4, volatility: 'high',      marketCap: 42000 },
  { ticker: 'BITE', name: 'BiteBrew Foods',       sector: 'CONSUMER', bio: 'National QSR chain & packaged food brand, 2000+ outlets.',        basePrice: 980,  beta: 0.6, volatility: 'low',       marketCap: 19600 },

  // ── Industrials, Aerospace & Infrastructure ──
  { ticker: 'ORBX', name: 'OrbitaX Aerospace',   sector: 'INFRA',  bio: 'Satellite launch services & space logistics.',                       basePrice: 5600, beta: 1.8, volatility: 'very-high', marketCap: 112000 },
  { ticker: 'FRGM', name: 'ForgeMatrix Industries', sector: 'INFRA', bio: 'Precision engineering, defense electronics & manufacturing.',      basePrice: 2480, beta: 1.0, volatility: 'medium',    marketCap: 49600 },
  { ticker: 'INFB', name: 'InfraBuild Corp',     sector: 'INFRA',  bio: 'Highway, metro & smart-city infrastructure projects.',                basePrice: 1750, beta: 0.8, volatility: 'low',       marketCap: 35000 },
  { ticker: 'SHPX', name: 'ShipPlex Logistics',  sector: 'INFRA',  bio: 'Container shipping, cold-chain & supply chain tech.',                basePrice: 2150, beta: 1.1, volatility: 'medium',    marketCap: 43000 },
];

/** Lookup a company by ticker */
export function getCompany(ticker: string): Company | undefined {
  return COMPANY_LIST.find(c => c.ticker === ticker);
}

/** Get all companies in a sector */
export function getCompaniesBySector(sector: Sector): Company[] {
  return COMPANY_LIST.filter(c => c.sector === sector);
}
