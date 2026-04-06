const form = document.getElementById("item-form");
const formTitle = document.getElementById("form-title");
const itemIdInput = document.getElementById("item-id");
const titleInput = document.getElementById("title");
const detailInput = document.getElementById("detail");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formMessage = document.getElementById("form-message");

const filterTitleInput = document.getElementById("filter-title");
const filterDetailInput = document.getElementById("filter-detail");
const searchBtn = document.getElementById("search-btn");
const clearBtn = document.getElementById("clear-btn");

const itemsBody = document.getElementById("items-body");

function getCurrentFilters() {
  const params = new URLSearchParams();
  if (filterTitleInput.value.trim()) {
    params.set("title", filterTitleInput.value.trim());
  }
  if (filterDetailInput.value.trim()) {
    params.set("detail", filterDetailInput.value.trim());
  }
  return params;
}

async function loadItems() {
  const query = getCurrentFilters().toString();
  const url = query ? `/api/items?${query}` : "/api/items";
  const res = await fetch(url);
  const items = await res.json();
  renderItems(items);
}

function renderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    itemsBody.innerHTML = `<tr><td colspan="6">No data found.</td></tr>`;
    return;
  }

  itemsBody.innerHTML = items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.detail || "")}</td>
        <td>${escapeHtml(item.created_at || "")}</td>
        <td>${escapeHtml(item.updated_at || "")}</td>
        <td class="actions">
          <button type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  itemIdInput.value = "";
  formTitle.textContent = "Add New Item";
  submitBtn.textContent = "Create";
  titleInput.value = "";
  detailInput.value = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const id = itemIdInput.value.trim();
  const payload = {
    title: titleInput.value.trim(),
    detail: detailInput.value.trim(),
  };

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/items/${id}` : "/api/items";
  const method = isEdit ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json();
    formMessage.textContent = errorData.error || "Request failed.";
    return;
  }

  formMessage.textContent = isEdit ? "Item updated." : "Item created.";
  resetForm();
  await loadItems();
});

cancelBtn.addEventListener("click", () => {
  formMessage.textContent = "";
  resetForm();
});

searchBtn.addEventListener("click", () => {
  loadItems();
});

clearBtn.addEventListener("click", () => {
  filterTitleInput.value = "";
  filterDetailInput.value = "";
  loadItems();
});

itemsBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.getAttribute("data-action");
  const id = target.getAttribute("data-id");
  if (!action || !id) {
    return;
  }

  if (action === "delete") {
    const ok = confirm(`Delete item #${id}?`);
    if (!ok) {
      return;
    }

    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed.");
      return;
    }

    await loadItems();
    return;
  }

  if (action === "edit") {
    const row = target.closest("tr");
    if (!row) {
      return;
    }
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) {
      return;
    }

    itemIdInput.value = id;
    titleInput.value = cells[1].textContent || "";
    detailInput.value = cells[2].textContent || "";
    formTitle.textContent = `Edit Item #${id}`;
    submitBtn.textContent = "Save";
  }
});

loadItems();
