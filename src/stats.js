export async function incrementStat(env, key, by = 1) {
  const current = Number(await env.KV.get(key) ?? 0);
  await env.KV.put(key, String(current + by));
}
