const fs = require("fs");
const path = require("path");

module.exports = async () => {
  // Reset e2e csv before each playwright run to avoid test pollution.
  const csvPath = path.resolve(__dirname, "testdatabase.csv");
  const header =
    "id,title,detail,created_at,updated_at,urgency_level,project_status,project_category,economic_benefit_expectation,planned_execute_date,priority,parent_ids,child_ids,prerequisite_ids,blocked_by_ids,deadline_value,path\n";
  fs.writeFileSync(csvPath, header, "utf-8");
};

