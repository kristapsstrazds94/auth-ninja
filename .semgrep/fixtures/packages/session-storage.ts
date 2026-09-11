// ruleid: session-token-in-web-storage
localStorage.setItem("sessionToken", token);

// ruleid: session-token-in-web-storage
sessionStorage.getItem("authToken");

// ok: session-token-in-web-storage
localStorage.setItem("theme", "dark");
