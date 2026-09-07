export const missions = [
  { name: 'First shift', brief: 'Collect a parcel at the depot.', x: 7, z: 42, reward: 100 },
  { name: 'Downtown delivery', brief: 'Deliver the parcel to the finance district.', x: -42, z: -7, reward: 180 },
  { name: 'Coastal express', brief: 'Reach the waterfront checkpoint.', x: 84, z: -42, reward: 220 },
  { name: 'Northside pickup', brief: 'Collect equipment for the range.', x: -7, z: -84, reward: 250 },
  { name: 'Return to base', brief: 'Bring the equipment back to the depot.', x: 7, z: 42, reward: 300 },
];
export const shop = { x: 42, z: 7 };
export type Save = { cash: number; mission: number; owns: boolean; hits: number };
export const initialSave: Save = { cash: 0, mission: 0, owns: false, hits: 0 };
export function parseSave(raw: string | null): Save {
  try {
    const v = JSON.parse(raw || '{}');
    return { cash: Number.isInteger(v.cash) ? Math.max(0, Math.min(999999, v.cash)) : 0,
      mission: Number.isInteger(v.mission) ? Math.max(0, Math.min(missions.length, v.mission)) : 0,
      owns: v.owns === true, hits: Number.isInteger(v.hits) ? Math.max(0, Math.min(999999, v.hits)) : 0 };
  } catch { return { ...initialSave }; }
}
