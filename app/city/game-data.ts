export const missions = [
  { name: 'Supply pickup', brief: 'Collect a parcel at the depot.', x: 7, z: 42, reward: 100 },
  { name: 'Forest courier', brief: 'Deliver the parcel to the forest outpost.', x: -42, z: -7, reward: 180 },
  { name: 'Eastern lookout', brief: 'Reach the eastern lookout.', x: 84, z: -42, reward: 220 },
  { name: 'Ridge equipment', brief: 'Collect equipment for the range.', x: -7, z: -84, reward: 250 },
  { name: 'Return to base', brief: 'Bring the equipment back to the depot.', x: 7, z: 42, reward: 300 },
  { name: 'Range qualification', brief: 'Buy a gun at S, then score 5 target hits. Return to S.', x: 42, z: 7, reward: 250, requiresHits: 5 },
  { name: 'Northern supply run', brief: 'Drive out to the northern forest camp.', x: -42, z: -102, reward: 350 },
  { name: 'Ranger trail', brief: 'Find the ranger checkpoint beyond the woods.', x: 76, z: -100, reward: 300 },
  { name: 'Return to checkpoint', brief: 'Return to the southern trail checkpoint.', x: 42, z: 116, reward: 400 },
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
