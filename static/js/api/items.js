async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data ? String(data.error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function buildItemsListUrl({
  title,
  detail,
  rootId,
  parentId,
  statuses,
  all,
} = {}) {
  const params = new URLSearchParams();
  if (rootId) params.set("root_id", String(rootId).trim());
  if (parentId) params.set("parent_id", String(parentId).trim());
  if (Array.isArray(statuses) && statuses.length > 0) params.set("statuses", statuses.map(String).join(","));
  if (title) params.set("title", String(title).trim());
  if (detail) params.set("detail", String(detail).trim());
  if (all) params.set("all", "1");
  const q = params.toString();
  return q ? `/api/items?${q}` : "/api/items";
}

export async function listItems(filters = {}) {
  const url = buildItemsListUrl(filters);
  const items = await fetchJson(url);
  return Array.isArray(items) ? items : [];
}

export async function createItem(payload) {
  return await fetchJson("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export async function updateItem(id, payload) {
  return await fetchJson(`/api/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export async function deleteItem(id) {
  return await fetchJson(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function patchStatus(id, projectStatus) {
  return await fetchJson(`/api/items/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_status: projectStatus }),
  });
}

export async function patchParent(id, parentIdOrEmpty) {
  return await fetchJson(`/api/items/${encodeURIComponent(id)}/parent`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent_id: parentIdOrEmpty }),
  });
}

export async function addPrerequisite(targetId, prerequisiteId) {
  return await fetchJson(`/api/items/${encodeURIComponent(targetId)}/prerequisites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prerequisite_id: prerequisiteId }),
  });
}

