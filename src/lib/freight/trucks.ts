// Class 8 tractor catalog. `style` drives the side-profile illustration in
// <TruckImage/>; `years` bounds the model-year dropdown per model.

export type TruckStyle = 'longnose' | 'aero' | 'vocational' | 'cabover' | 'electric';

export type TruckModel = {
  name: string;
  style: TruckStyle;
  years: [number, number];
  sleeper?: 'raised' | 'flat' | 'mid' | 'day';
};

export type TruckMake = {
  id: string;
  name: string;
  badge: string;        // short wordmark painted on the hood
  accent: string;       // badge color
  models: TruckModel[];
};

const NOW = 2027;

export const TRUCK_MAKES: TruckMake[] = [
  {
    id: 'peterbilt', name: 'Peterbilt', badge: 'PETERBILT', accent: '#b91c1c',
    models: [
      { name: '589', style: 'longnose', years: [2022, NOW], sleeper: 'raised' },
      { name: '579', style: 'aero', years: [2012, NOW], sleeper: 'raised' },
      { name: '579 UltraLoft', style: 'aero', years: [2017, NOW], sleeper: 'raised' },
      { name: '567', style: 'vocational', years: [2013, NOW], sleeper: 'day' },
      { name: '389', style: 'longnose', years: [2007, 2025], sleeper: 'flat' },
      { name: '389X', style: 'longnose', years: [2018, 2025], sleeper: 'raised' },
      { name: '388', style: 'longnose', years: [2007, 2015], sleeper: 'mid' },
      { name: '386', style: 'longnose', years: [2005, 2015], sleeper: 'mid' },
      { name: '379', style: 'longnose', years: [1987, 2007], sleeper: 'flat' },
      { name: '587', style: 'aero', years: [2010, 2013], sleeper: 'raised' },
      { name: '579EV', style: 'electric', years: [2021, NOW], sleeper: 'day' },
      { name: '362 Cabover', style: 'cabover', years: [1981, 2005], sleeper: 'flat' },
    ],
  },
  {
    id: 'kenworth', name: 'Kenworth', badge: 'KENWORTH', accent: '#1d4ed8',
    models: [
      { name: 'W990', style: 'longnose', years: [2018, NOW], sleeper: 'raised' },
      { name: 'W900L', style: 'longnose', years: [1990, NOW], sleeper: 'flat' },
      { name: 'W900B', style: 'longnose', years: [1982, NOW], sleeper: 'mid' },
      { name: 'T680', style: 'aero', years: [2013, NOW], sleeper: 'raised' },
      { name: 'T680 Signature', style: 'aero', years: [2021, NOW], sleeper: 'raised' },
      { name: 'T880', style: 'vocational', years: [2013, NOW], sleeper: 'day' },
      { name: 'T800', style: 'vocational', years: [1986, NOW], sleeper: 'mid' },
      { name: 'T660', style: 'aero', years: [2007, 2016], sleeper: 'raised' },
      { name: 'T2000', style: 'aero', years: [1996, 2010], sleeper: 'raised' },
      { name: 'T680E', style: 'electric', years: [2022, NOW], sleeper: 'day' },
      { name: 'K100 Cabover', style: 'cabover', years: [1980, 2002], sleeper: 'flat' },
    ],
  },
  {
    id: 'freightliner', name: 'Freightliner', badge: 'FREIGHTLINER', accent: '#0f172a',
    models: [
      { name: 'Cascadia', style: 'aero', years: [2008, NOW], sleeper: 'raised' },
      { name: 'Cascadia Evolution', style: 'aero', years: [2013, 2019], sleeper: 'raised' },
      { name: 'eCascadia', style: 'electric', years: [2022, NOW], sleeper: 'day' },
      { name: 'Coronado', style: 'longnose', years: [2001, 2020], sleeper: 'raised' },
      { name: 'Classic XL', style: 'longnose', years: [1990, 2010], sleeper: 'flat' },
      { name: 'Century Class', style: 'aero', years: [1995, 2010], sleeper: 'raised' },
      { name: 'Columbia', style: 'aero', years: [2000, 2012], sleeper: 'raised' },
      { name: '122SD', style: 'vocational', years: [2012, NOW], sleeper: 'day' },
      { name: '114SD', style: 'vocational', years: [2011, NOW], sleeper: 'day' },
      { name: 'FLD 120', style: 'longnose', years: [1989, 2002], sleeper: 'flat' },
      { name: 'Argosy Cabover', style: 'cabover', years: [1998, 2006], sleeper: 'raised' },
    ],
  },
  {
    id: 'volvo', name: 'Volvo', badge: 'VOLVO', accent: '#1e3a8a',
    models: [
      { name: 'VNL 860', style: 'aero', years: [2018, NOW], sleeper: 'raised' },
      { name: 'VNL 760', style: 'aero', years: [2018, NOW], sleeper: 'raised' },
      { name: 'VNL 740', style: 'aero', years: [2018, NOW], sleeper: 'mid' },
      { name: 'VNL 300', style: 'aero', years: [2018, NOW], sleeper: 'day' },
      { name: 'VNL 670', style: 'aero', years: [2004, 2017], sleeper: 'raised' },
      { name: 'VNL 780', style: 'aero', years: [2004, 2017], sleeper: 'raised' },
      { name: 'VNR', style: 'aero', years: [2018, NOW], sleeper: 'day' },
      { name: 'VNR Electric', style: 'electric', years: [2021, NOW], sleeper: 'day' },
      { name: 'VHD', style: 'vocational', years: [2001, NOW], sleeper: 'day' },
      { name: 'VNX', style: 'vocational', years: [2016, NOW], sleeper: 'mid' },
    ],
  },
  {
    id: 'mack', name: 'Mack', badge: 'MACK', accent: '#a16207',
    models: [
      { name: 'Anthem', style: 'aero', years: [2018, NOW], sleeper: 'raised' },
      { name: 'Pinnacle', style: 'aero', years: [2006, NOW], sleeper: 'raised' },
      { name: 'Granite', style: 'vocational', years: [2002, NOW], sleeper: 'day' },
      { name: 'Super-Liner', style: 'longnose', years: [1977, 2012], sleeper: 'flat' },
      { name: 'Titan', style: 'longnose', years: [2008, 2016], sleeper: 'flat' },
      { name: 'Vision', style: 'aero', years: [2000, 2008], sleeper: 'raised' },
      { name: 'CH613', style: 'aero', years: [1988, 2006], sleeper: 'mid' },
      { name: 'LR Electric', style: 'cabover', years: [2021, NOW], sleeper: 'day' },
    ],
  },
  {
    id: 'international', name: 'International', badge: 'INTERNATIONAL', accent: '#b45309',
    models: [
      { name: 'LT Series', style: 'aero', years: [2017, NOW], sleeper: 'raised' },
      { name: 'LT625', style: 'aero', years: [2017, NOW], sleeper: 'raised' },
      { name: 'LoneStar', style: 'longnose', years: [2008, 2021], sleeper: 'raised' },
      { name: 'ProStar', style: 'aero', years: [2007, 2018], sleeper: 'raised' },
      { name: 'RH Series', style: 'aero', years: [2018, NOW], sleeper: 'day' },
      { name: 'HX Series', style: 'vocational', years: [2016, NOW], sleeper: 'day' },
      { name: '9900i Eagle', style: 'longnose', years: [1996, 2017], sleeper: 'flat' },
      { name: '9400i', style: 'longnose', years: [1996, 2007], sleeper: 'mid' },
      { name: 'eMV', style: 'electric', years: [2021, NOW], sleeper: 'day' },
    ],
  },
  {
    id: 'westernstar', name: 'Western Star', badge: 'WESTERN STAR', accent: '#7c2d12',
    models: [
      { name: '49X', style: 'vocational', years: [2020, NOW], sleeper: 'mid' },
      { name: '57X', style: 'aero', years: [2022, NOW], sleeper: 'raised' },
      { name: '47X', style: 'vocational', years: [2020, NOW], sleeper: 'day' },
      { name: '5700XE', style: 'aero', years: [2014, 2022], sleeper: 'raised' },
      { name: '4900EX', style: 'longnose', years: [1995, 2021], sleeper: 'raised' },
      { name: '4900FA', style: 'longnose', years: [1995, 2021], sleeper: 'mid' },
      { name: '4700', style: 'vocational', years: [2008, 2020], sleeper: 'day' },
    ],
  },
  {
    id: 'tesla', name: 'Tesla', badge: 'TESLA', accent: '#dc2626',
    models: [{ name: 'Semi', style: 'electric', years: [2022, NOW], sleeper: 'day' }],
  },
  {
    id: 'nikola', name: 'Nikola', badge: 'NIKOLA', accent: '#334155',
    models: [
      { name: 'Tre BEV', style: 'cabover', years: [2021, 2025], sleeper: 'day' },
      { name: 'Tre FCEV', style: 'cabover', years: [2023, 2025], sleeper: 'day' },
    ],
  },
  {
    id: 'hino', name: 'Hino', badge: 'HINO', accent: '#be123c',
    models: [{ name: 'XL8', style: 'vocational', years: [2019, NOW], sleeper: 'day' }],
  },
  {
    id: 'sterling', name: 'Sterling', badge: 'STERLING', accent: '#475569',
    models: [
      { name: 'A-Line 9500', style: 'aero', years: [1998, 2009], sleeper: 'raised' },
      { name: 'L-Line 9500', style: 'longnose', years: [1998, 2009], sleeper: 'flat' },
    ],
  },
];

export const MAKE_BY_ID: Record<string, TruckMake> = Object.fromEntries(TRUCK_MAKES.map(m => [m.id, m]));

export type PaintColor = { id: string; name: string; hex: string; metallic?: boolean };

export const PAINT_COLORS: PaintColor[] = [
  { id: 'white', name: 'Glacier White', hex: '#f4f5f7' },
  { id: 'black', name: 'Jet Black', hex: '#111318', metallic: true },
  { id: 'red', name: 'Viper Red', hex: '#c1121f', metallic: true },
  { id: 'burgundy', name: 'Legendary Burgundy', hex: '#6b0f1a', metallic: true },
  { id: 'blue', name: 'Cobalt Blue', hex: '#1d4ed8', metallic: true },
  { id: 'navy', name: 'Midnight Navy', hex: '#14213d', metallic: true },
  { id: 'teal', name: 'Lagoon Teal', hex: '#0f766e', metallic: true },
  { id: 'green', name: 'Highland Green', hex: '#14532d', metallic: true },
  { id: 'lime', name: 'Lime Rush', hex: '#65a30d' },
  { id: 'yellow', name: 'School-Bus Yellow', hex: '#f2b705' },
  { id: 'orange', name: 'Omaha Orange', hex: '#ea580c' },
  { id: 'purple', name: 'Royal Purple', hex: '#5b21b6', metallic: true },
  { id: 'pink', name: 'Hot Pink', hex: '#db2777', metallic: true },
  { id: 'silver', name: 'Quicksilver', hex: '#a7adb7', metallic: true },
  { id: 'gray', name: 'Gunmetal Gray', hex: '#3f4652', metallic: true },
  { id: 'brown', name: 'Desert Copper', hex: '#8a4b1f', metallic: true },
  { id: 'gold', name: 'Champagne Gold', hex: '#b08d57', metallic: true },
];

export const PAINT_BY_ID: Record<string, PaintColor> = Object.fromEntries(PAINT_COLORS.map(c => [c.id, c]));

export type TruckSpec = { makeId: string; model: string; year: number; colorId: string; photoDataUrl?: string };

export function findModel(spec: Pick<TruckSpec, 'makeId' | 'model'>): TruckModel | undefined {
  return MAKE_BY_ID[spec.makeId]?.models.find(m => m.name === spec.model);
}

export function yearsFor(m: TruckModel): number[] {
  const out: number[] = [];
  for (let y = m.years[1]; y >= m.years[0]; y--) out.push(y);
  return out;
}

export function truckTitle(t: TruckSpec) {
  return `${t.year} ${MAKE_BY_ID[t.makeId]?.name ?? ''} ${t.model}`.trim();
}
