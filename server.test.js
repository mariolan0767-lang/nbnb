const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { startServer } = require("./server");

const dbPath = path.join(__dirname, "test-denbook.sqlite");

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  return { status: response.status, data };
}

(async () => {
  try {
    fs.unlinkSync(dbPath);
  } catch {}

  const port = 3210;
  const server = startServer(port, dbPath);

  try {
    const bootstrap = await fetchJson(`http://localhost:${port}/api/bootstrap`);
    assert.equal(bootstrap.status, 200);
    assert.ok(Array.isArray(bootstrap.data.posts));

    const login = await fetchJson(`http://localhost:${port}/api/login`, {
      method: "POST",
      body: JSON.stringify({ email: "admin@denbook.local", password: "denbook123" }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.currentUser.email, "admin@denbook.local");

    console.log("tests ok");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
