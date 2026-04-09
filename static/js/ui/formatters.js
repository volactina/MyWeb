const ECONOMIC_BENEFIT_LABELS = {
  0: "0 - 项目已经产生收益",
  1: "1 - 经分析，短期就能开始产生收益",
  2: "2 - 经分析，短期不会过度消耗资金（也不会产生收益），未来能产生收益",
  3: "3 - 有望产生收益，但收益情况不明朗需分析",
  4: "4 - 不涉及（缺省值）",
  5: "5 - 需要投入资金，但预期不会产生收益（或遥遥无期）",
};

const PROJECT_CATEGORY_LABELS = {
  0: "0 - 待定",
  1: "1 - 管理项目",
  2: "2 - 执行项目（缺省值）",
  3: "3 - 灵感项目",
};

export function formatEconomicBenefitExpectation(item) {
  const k = String(item?.economic_benefit_expectation ?? "4").trim();
  return ECONOMIC_BENEFIT_LABELS[k] ?? ECONOMIC_BENEFIT_LABELS[4];
}

export function formatProjectCategory(item) {
  const k = String(item?.project_category ?? "2").trim();
  return PROJECT_CATEGORY_LABELS[k] ?? PROJECT_CATEGORY_LABELS[2];
}

export function formatDeadline(item) {
  const u = String(item?.urgency_level ?? "0");
  const v = String(item?.deadline_value ?? "").trim();
  if (u !== "4") return "—";
  return v || "未填写";
}

export function formatValue(key, item) {
  if (key === "deadline_value") return formatDeadline(item);
  if (key === "economic_benefit_expectation") return formatEconomicBenefitExpectation(item);
  if (key === "project_category") return formatProjectCategory(item);
  if (key === "planned_execute_date") return String(item?.planned_execute_date ?? "").trim() || "—";
  return item?.[key] ?? "";
}

