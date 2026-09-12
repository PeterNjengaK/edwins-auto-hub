(() => {
  let prompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event;
  });
  if ("serviceWorker" in navigator && window.isSecureContext)
    navigator.serviceWorker
      .register("/admin/sw.js", { scope: "/admin/" })
      .catch(() => {});
  const installed = () =>
    matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-install-admin]");
    if (!button) return;
    if (installed()) {
      Hub.toast("Edwin's Manager is already running as an app.");
      return;
    }
    if (prompt) {
      const pending = prompt;
      prompt = null;
      await pending.prompt();
      const result = await pending.userChoice;
      if (result.outcome === "accepted") Hub.toast("Installation requested.");
      return;
    }
    const node = document.getElementById("management-content");
    node.innerHTML = `<h2>Install Edwin's Manager</h2><div class="install-options"><section><h3>Windows or Mac</h3><p>Open this admin page in Edge or Chrome, then use the browser's install-app option. On Mac, Safari also offers Add to Dock.</p></section><section><h3>iPad</h3><p>Open your dealership's HTTPS admin address in Safari. Choose Share, Add to Home Screen, then Open as Web App when available.</p></section><section><h3>Your dealership connection</h3><p>${location.hostname === "127.0.0.1" || location.hostname === "localhost" ? "This preview runs on this computer. An iPad needs a shared HTTPS server address; localhost on an iPad refers to the iPad itself." : "This app connects to the same dealership server as your website. An internet or local-network connection is needed to manage records."}</p></section></div><button class="button full" data-manager-close>Done</button>`;
    document.getElementById("management-dialog").showModal();
  });
  const connection = document.getElementById("connection-status");
  function online() {
    connection.hidden = navigator.onLine;
    connection.textContent = "Offline. Reconnect before saving changes.";
  }
  addEventListener("offline", online);
  addEventListener("online", online);
  online();
  window.addEventListener("appinstalled", () => {
    prompt = null;
    Hub.toast("Admin app installed.");
  });
})();
