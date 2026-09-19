export function validDraftCheckpoint(value: unknown): boolean {
 if (!value || typeof value !== "object") return false;
 const v = value as Record<string, any>; const s = v.settings;
 if (v.version !== 1 || typeof v.classYear !== "string" || !s || ![8,10,12,14,16].includes(s.teams) || !["1QB","SUPERFLEX"].includes(s.qbFormat) || !["STANDARD","TEP"].includes(s.teFormat) || !["DD","COMMUNITY"].includes(s.engine) || !["UNTIMED",15,30,45,60,120,300].includes(s.pickTimer) || !Number.isInteger(s.slot) || s.slot < 1 || s.slot > s.teams) return false;
 if (!["setup","draft","results"].includes(v.step) || !Array.isArray(v.prospects) || !v.prospects.length || !Array.isArray(v.picks) || v.picks.length > Math.min(v.prospects.length, s.teams * 4)) return false;
 const ids = new Set<string>();
 for (const p of v.prospects) { if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !["QB","RB","WR","TE"].includes(p.position) || ids.has(p.id)) return false; ids.add(p.id); }
 const used = new Set<string>();
 for (let i=0;i<v.picks.length;i++) { const p=v.picks[i]; if (!p || p.overall !== i+1 || !ids.has(p.playerId) || used.has(p.playerId) || p.round !== Math.floor(i/s.teams)+1 || p.slot !== i%s.teams+1 || typeof p.userPick !== "boolean") return false; used.add(p.playerId); }
 return v.step !== "results" || v.picks.length === Math.min(v.prospects.length, s.teams * 4);
}
