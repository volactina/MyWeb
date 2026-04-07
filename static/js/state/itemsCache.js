export function createItemsCache({ ttlMs = 5000 } = {}) {
  let atMs = 0;
  let byId = new Map();

  function isFresh(nowMs = Date.now()) {
    return byId.size > 0 && nowMs - atMs < ttlMs;
  }

  function get(nowMs = Date.now()) {
    return isFresh(nowMs) ? byId : null;
  }

  function set(nextById, nowMs = Date.now()) {
    byId = nextById instanceof Map ? nextById : new Map();
    atMs = nowMs;
  }

  function clear() {
    byId = new Map();
    atMs = 0;
  }

  return { get, set, clear };
}

