export function createFormModal({
  backdrop,
  titleEl,
  subEl,
  messageEl,
} = {}) {
  function open({ title, sub } = {}) {
    if (!backdrop) return;
    if (messageEl) messageEl.textContent = "";
    if (titleEl && title) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub || "";
    backdrop.style.display = "flex";
    backdrop.setAttribute("aria-hidden", "false");
  }

  function close() {
    if (!backdrop) return;
    backdrop.style.display = "none";
    backdrop.setAttribute("aria-hidden", "true");
  }

  return { open, close };
}

