export const missions = [
  { name: 'First shift', brief: 'Collect a parcel at the depot.', x: 7, z: 42, reward: 100 },
  { name: 'Downtown delivery', brief: 'Deliver the parcel to the finance district.', x: -42, z: -7, reward: 180 },
  { name: 'Coastal express', brief: 'Reach the waterfront checkpoint.', x: 84, z: -42, reward: 220 },
  { name: 'Northside pickup', brief: 'Collect equipment for the range.', x: -7, z: -84, reward: 250 },
  { name: 'Return to base', brief: 'Bring the equipment back to the depot.', x: 7, z: 42, reward: 300 },
  { name: 'Range qualification', brief: 'Buy a gun at S, then score 5 target hits. Return to S.', x: 42, z: 7, reward: 250, requiresHits: 5 },
  { name: 'Desert supply run', brief: 'Drive out to the northern desert camp.', x: -42, z: -102, reward: 350 },
  { name: 'Camel trail', brief: 'Find the desert checkpoint near the camel herd.', x: 76, z: -100, reward: 300 },
  { name: 'Coastal homecoming', brief: 'Return to the waterfront promenade.', x: 42, z: 116, reward: 400 },
];
export const shop = { x: 42, z: 7 };
export type Save = { cash: number; mission: number; owns: boolean; hits: number; ammo:number; reserve:number };
export const initialSave: Save = { cash: 0, mission: 0, owns: false, hits: 0, ammo:12, reserve:60 };
export function parseSave(raw: string | null): Save {
  try {
    const v = JSON.parse(raw || '{}');
    return { cash: Number.isInteger(v.cash) ? Math.max(0, Math.min(999999, v.cash)) : 0,
      mission: Number.isInteger(v.mission) ? Math.max(0, Math.min(missions.length, v.mission)) : 0,
      owns: v.owns === true, hits: Number.isInteger(v.hits) ? Math.max(0, Math.min(999999, v.hits)) : 0,
      ammo:Number.isInteger(v.ammo)?Math.max(0,Math.min(12,v.ammo)):12,
      reserve:Number.isInteger(v.reserve)?Math.max(0,Math.min(60,v.reserve)):60 };
  } catch { return { ...initialSave }; }
}
