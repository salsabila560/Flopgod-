// talks to the /api functions. if they're not deployed (or no database is
// connected) everything falls back to this browser only.
(function () {
  function getId() {
    try {
      let id = localStorage.getItem("flopgod.id");
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-zA-Z0-9-]/g, "");
        localStorage.setItem("flopgod.id", id);
      }
      return id;
    } catch (e) {
      return "guest-" + Math.random().toString(16).slice(2);
    }
  }

  async function call(path, body) {
    const res = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error("api " + res.status);
    return res.json();
  }

  window.FlopAPI = {
    id: getId(),
    stats: () => call("/api/stats?me=" + encodeURIComponent(window.FlopAPI.id)),
    pray: (count) => call("/api/pray", { id: window.FlopAPI.id, count }),
    score: (name, score) => call("/api/score", { id: window.FlopAPI.id, name, score })
  };
})();
