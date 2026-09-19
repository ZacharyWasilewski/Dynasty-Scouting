const chains = new Map<string, Promise<void>>();
export function boardStorageKey(userId: string, year: string) { return `dd-board-pending:${userId}:${year}`; }
export function saveBoard(key: string, year: string, ids: string[]): Promise<void> {
  const body = JSON.stringify({ prospectIds: ids });
  const work = (chains.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const res = await fetch(`/api/board/${year}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    if (!res.ok) throw new Error("Board was not saved");
    try { if (localStorage.getItem(key) === JSON.stringify(ids)) localStorage.removeItem(key); } catch {}
  });
  chains.set(key, work);
  void work.finally(() => { if (chains.get(key) === work) chains.delete(key); }).catch(() => {});
  return work;
}
