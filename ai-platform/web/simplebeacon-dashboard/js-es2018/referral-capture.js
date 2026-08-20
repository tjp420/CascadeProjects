(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var ref = params.get("ref");
    if (!ref) return;
    try {
      localStorage.setItem("sb_ref_slug", ref);
    } catch (_) {}
    fetch("/api/referral/capture", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: ref, channel: "web" }),
    }).catch(function () {});
  } catch (_) {}
})();
