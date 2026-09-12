window.AdminSession = (() => {
  let token = "",
    idleMs = 15 * 60 * 1000,
    lastActivity = 0,
    lastSent = 0,
    timer;
  function stop() {
    clearInterval(timer);
    token = "";
  }
  function expire(message = "Signed out for your security.") {
    const previous = token;
    stop();
    login();
    if (message) Hub.toast(message);
    if (previous)
      fetch("/api/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": previous },
        keepalive: true,
      }).catch(() => {});
  }
  function check() {
    if (token && Date.now() - lastActivity >= idleMs)
      expire("Signed out after 15 minutes of inactivity.");
  }
  async function activity(event) {
    if (!token || !event.isTrusted || document.visibilityState === "hidden")
      return;
    check();
    if (!token) return;
    lastActivity = Date.now();
    if (lastActivity - lastSent < Math.min(30000, idleMs / 3)) return;
    lastSent = lastActivity;
    const current = token;
    try {
      const response = await fetch("/api/session/activity", {
        method: "POST",
        headers: { "X-CSRF-Token": current },
      });
      if ([401, 403].includes(response.status) && token === current)
        expire("Your session has ended. Please sign in again.");
    } catch {}
  }
  for (const event of [
    "pointerdown",
    "pointermove",
    "keydown",
    "wheel",
    "touchstart",
  ])
    document.addEventListener(event, activity, { passive: true });
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  window.addEventListener("pagehide", () => {
    if (token) expire("");
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) expire("Please sign in again.");
  });
  // Downloads need the window credential too; a cookie alone grants no access.
  document.addEventListener("click", async (event) => {
    const link = event.target.closest('a[href^="/api/admin/"]');
    if (!link) return;
    event.preventDefault();
    const current = token;
    if (!current) return expire("Please sign in to download files.");
    try {
      const response = await fetch(link.getAttribute("href"), {
        headers: { "X-CSRF-Token": current },
      });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) expire();
        throw new Error("The download could not be completed.");
      }
      const blob = await response.blob();
      if (token !== current) return;
      const filename =
        response.headers
          .get("content-disposition")
          ?.match(/filename="?([^";]+)"?/)?.[1] || "edwins-export";
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      Hub.toast(error.message);
    }
  });
  return {
    start(result) {
      stop();
      token = result.csrf;
      idleMs = result.idleTimeoutMs;
      lastActivity = lastSent = Date.now();
      timer = setInterval(check, Math.min(1000, idleMs));
    },
    stop,
    expire,
  };
})();
