export function formatDeadline(item) {
  const u = String(item?.urgency_level ?? "0");
  const v = String(item?.deadline_value ?? "").trim();
  if (u !== "4") return "—";
  return v || "未填写";
}

export function formatValue(key, item) {
  if (key === "deadline_value") return formatDeadline(item);
  return item?.[key] ?? "";
}

