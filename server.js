const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = process.env.DB_FILE || path.join(ROOT, "denbook.sqlite");
const SESSION_COOKIE = "denbook_session";
const CSRF_COOKIE = "denbook_csrf";
const APP_URL = process.env.APP_URL || "";
const SECURE_COOKIE =
  process.env.SECURE_COOKIE === "true" ||
  process.env.NODE_ENV === "production" ||
  APP_URL.startsWith("https://");
const STATIC_FILES = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.svg",
  "/robots.txt",
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const rateLimits = new Map();

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, original] = stored.split(":");
  const current = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(original, "hex"), Buffer.from(current, "hex"));
}

function parseCookies(request) {
  const raw = request.headers.cookie || "";
  return raw.split(";").reduce((acc, item) => {
    const [key, ...value] = item.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(value.join("="));
    return acc;
  }, {});
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...securityHeaders(),
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self';",
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 3_000_000) {
        reject(new Error("Istek cok buyuk."));
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Gecersiz JSON."));
      }
    });
    request.on("error", reject);
  });
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  return (
    origin === `http://${host}` ||
    origin === `https://${host}` ||
    (APP_URL && origin === APP_URL)
  );
}

function requireCsrf(request, response, session) {
  if (!sameOrigin(request)) {
    sendJson(response, 403, { error: "Gecersiz origin." });
    return false;
  }
  if (!session) return true;
  const token = request.headers["x-csrf-token"];
  if (!token || token !== session.csrf_token) {
    sendJson(response, 403, { error: "CSRF dogrulamasi basarisiz." });
    return false;
  }
  return true;
}

function rateLimit(request, response) {
  const ip = request.socket.remoteAddress || "local";
  const key = `${ip}:${request.method}:${request.url}`;
  const currentMinute = Math.floor(Date.now() / 60000);
  const entry = rateLimits.get(key);
  if (!entry || entry.minute !== currentMinute) {
    rateLimits.set(key, { minute: currentMinute, count: 1 });
    return true;
  }
  entry.count += 1;
  if (entry.count > 60) {
    sendJson(response, 429, { error: "Cok fazla istek gonderdin. Biraz bekle." });
    return false;
  }
  return true;
}

function sanitizeText(text, max = 500) {
  return String(text || "").trim().slice(0, max);
}

function sanitizeDataUrl(value, max = 2_000_000) {
  const text = String(value || "");
  if (!text) return "";
  if (!text.startsWith("data:image/")) return "";
  return text.slice(0, max);
}

function createDatabase(dbFile = DB_FILE) {
  const db = new DatabaseSync(dbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      bio TEXT NOT NULL DEFAULT '',
      followers_count INTEGER NOT NULL DEFAULT 0,
      friends_count INTEGER NOT NULL DEFAULT 0,
      avatar_image TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      csrf_token TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      addressee_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  seedDatabase(db);
  return db;
}

function seedDatabase(db) {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount > 0) return;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    bio: row.bio,
    followersCount: row.followers_count,
    friendsCount: row.friends_count,
    avatarImage: row.avatar_image,
    coverImage: row.cover_image,
  };
}

function getSession(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) || null;
}

function getCurrentUser(db, request) {
  const session = getSession(db, request);
  if (!session) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) || null;
}

function listUsers(db) {
  return db.prepare("SELECT * FROM users ORDER BY id DESC").all().map(publicUser);
}

function listNotifications(db, userId) {
  if (!userId) return [];
  return db
    .prepare("SELECT id, message, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 12")
    .all(userId);
}

function listAuditLogs(db) {
  return db
    .prepare(`
      SELECT audit_logs.id, audit_logs.action, audit_logs.target_type AS targetType, audit_logs.target_id AS targetId,
             audit_logs.details, audit_logs.created_at AS createdAt, COALESCE(users.name, 'System') AS actorName
      FROM audit_logs
      LEFT JOIN users ON users.id = audit_logs.actor_id
      ORDER BY audit_logs.id DESC
      LIMIT 20
    `)
    .all();
}

function listPosts(db, currentUserId = null) {
  const rows = db
    .prepare(`
      SELECT posts.id, posts.author_id AS authorId, posts.text, posts.image, posts.created_at AS createdAt,
             users.name AS authorName, users.role AS authorRole,
             COUNT(DISTINCT post_likes.user_id) AS likesCount
      FROM posts
      JOIN users ON users.id = posts.author_id
      LEFT JOIN post_likes ON post_likes.post_id = posts.id
      GROUP BY posts.id
      ORDER BY posts.id DESC
    `)
    .all();

  const commentStmt = db.prepare(`
    SELECT comments.id, comments.post_id AS postId, comments.text, comments.created_at AS createdAt,
           users.name AS authorName
    FROM comments
    JOIN users ON users.id = comments.user_id
    WHERE comments.post_id = ?
    ORDER BY comments.id ASC
  `);

  const likeStmt = currentUserId
    ? db.prepare("SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?")
    : null;

  return rows.map((row) => ({
    ...row,
    timeLabel: formatRelative(row.createdAt),
    stats: `${row.likesCount} begeni`,
    image: row.image.startsWith("data:") || row.image.startsWith("http") ? row.image : "",
    comments: commentStmt.all(row.id),
    likedByMe: likeStmt ? Boolean(likeStmt.get(row.id, currentUserId)) : false,
  }));
}

function formatRelative(value) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diff < 60) return `${diff} dk once`;
  if (diff < 1440) return `${Math.floor(diff / 60)} sa once`;
  return `${Math.floor(diff / 1440)} gun once`;
}

function createSession(db, userId) {
  const token = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(24).toString("hex");
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("INSERT INTO sessions (token, user_id, csrf_token, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    csrfToken,
    nowIso()
  );
  return { token, csrfToken };
}

function clearSession(db, token) {
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
}

function logAction(db, actorId, action, targetType, targetId, details = "") {
  db.prepare(
    "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(actorId || null, action, targetType, String(targetId), details, nowIso());
}

function requireAuth(db, request, response) {
  const user = getCurrentUser(db, request);
  if (!user) {
    sendJson(response, 401, { error: "Bu islem icin giris yap." });
    return null;
  }
  return user;
}

function requireRole(db, request, response, roles) {
  const user = requireAuth(db, request, response);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    sendJson(response, 403, { error: "Bu alan icin yetkin yok." });
    return null;
  }
  return user;
}

function bootstrap(db, request) {
  const currentUser = getCurrentUser(db, request);
  return {
    currentUser: publicUser(currentUser),
    users: listUsers(db),
    posts: listPosts(db, currentUser?.id),
    notifications: listNotifications(db, currentUser?.id),
    friends: currentUser
      ? db
          .prepare(`
            SELECT users.id, users.name, users.role, friendships.status
            FROM friendships
            JOIN users ON users.id = CASE
              WHEN friendships.requester_id = ? THEN friendships.addressee_id
              ELSE friendships.requester_id
            END
            WHERE friendships.requester_id = ? OR friendships.addressee_id = ?
          `)
          .all(currentUser.id, currentUser.id, currentUser.id)
      : [],
    csrfToken: getSession(db, request)?.csrf_token || null,
    auditLogs: currentUser && ["admin", "moderator"].includes(currentUser.role) ? listAuditLogs(db) : [],
  };
}

function sendSessionCookies(response, session) {
  const secure = SECURE_COOKIE ? "; Secure" : "";
  return {
    "Set-Cookie": [
      `${SESSION_COOKIE}=${session.token}; HttpOnly; Path=/; SameSite=Lax${secure}`,
      `${CSRF_COOKIE}=${session.csrfToken}; Path=/; SameSite=Lax${secure}`,
    ],
  };
}

async function handleApi(db, request, response, pathname) {
  if (!rateLimit(request, response)) return;

  if (request.method === "GET" && pathname === "/api/bootstrap") {
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "GET" && pathname === "/api/healthz") {
    sendJson(response, 200, { ok: true, timestamp: nowIso() });
    return;
  }

  if (request.method === "GET" && pathname === "/api/search") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const q = sanitizeText(url.searchParams.get("q"), 80).toLowerCase();
    const results = {
      users: [],
      posts: [],
    };
    if (q) {
      results.users = listUsers(db).filter((user) => user.name.toLowerCase().includes(q)).slice(0, 5);
      results.posts = listPosts(db, getCurrentUser(db, request)?.id)
        .filter((post) => post.text.toLowerCase().includes(q) || post.authorName.toLowerCase().includes(q))
        .slice(0, 5);
    }
    sendJson(response, 200, results);
    return;
  }

  if (request.method === "POST" && pathname === "/api/login") {
    const body = await readBody(request);
    const email = sanitizeText(body.email, 120).toLowerCase();
    const password = String(body.password || "");
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      sendJson(response, 401, { error: "E-posta veya sifre hatali." });
      return;
    }
    const session = createSession(db, user.id);
    logAction(db, user.id, "login", "session", session.token, "Kullanici girisi");
    sendJson(response, 200, bootstrap(db, { headers: { cookie: `${SESSION_COOKIE}=${session.token}` } }), sendSessionCookies(response, session));
    return;
  }

  if (request.method === "POST" && pathname === "/api/register") {
    const body = await readBody(request);
    const name = sanitizeText(body.name, 60);
    const email = sanitizeText(body.email, 120).toLowerCase();
    const password = String(body.password || "");
    if (name.length < 2 || !email.includes("@") || password.length < 6) {
      sendJson(response, 400, { error: "Kayit verileri gecersiz." });
      return;
    }
    try {
      const role = db.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0 ? "admin" : "member";
      const result = db
        .prepare(
          "INSERT INTO users (name, email, password_hash, role, bio, followers_count, friends_count, created_at) VALUES (?, ?, ?, ?, 'Yeni uye.', 0, 0, ?)"
        )
        .run(name, email, hashPassword(password), role, nowIso());
      const session = createSession(db, Number(result.lastInsertRowid));
      logAction(db, Number(result.lastInsertRowid), "register", "user", result.lastInsertRowid, role === "admin" ? "Ilk kayit admin oldu" : "Yeni kayit");
      sendJson(response, 200, bootstrap(db, { headers: { cookie: `${SESSION_COOKIE}=${session.token}` } }), sendSessionCookies(response, session));
    } catch {
      sendJson(response, 400, { error: "Bu e-posta zaten kayitli." });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/logout") {
    const cookies = parseCookies(request);
    clearSession(db, cookies[SESSION_COOKIE]);
    sendJson(
      response,
      200,
      { ok: true },
      {
        "Set-Cookie": [
          `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${SECURE_COOKIE ? "; Secure" : ""}`,
          `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${SECURE_COOKIE ? "; Secure" : ""}`,
        ],
      }
    );
    return;
  }

  const session = getSession(db, request);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !requireCsrf(request, response, session)) {
    return;
  }

  if (request.method === "PUT" && pathname === "/api/profile") {
    const user = requireAuth(db, request, response);
    if (!user) return;
    const body = await readBody(request);
    const name = sanitizeText(body.name, 60) || user.name;
    const bio = sanitizeText(body.bio, 220) || user.bio;
    const avatarImage = sanitizeDataUrl(body.avatarImage) || user.avatar_image;
    const coverImage = sanitizeDataUrl(body.coverImage) || user.cover_image;
    db.prepare("UPDATE users SET name = ?, bio = ?, avatar_image = ?, cover_image = ? WHERE id = ?").run(
      name,
      bio,
      avatarImage,
      coverImage,
      user.id
    );
    logAction(db, user.id, "profile.update", "user", user.id, "Profil guncellendi");
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "POST" && pathname === "/api/posts") {
    const user = requireAuth(db, request, response);
    if (!user) return;
    const body = await readBody(request);
    const text = sanitizeText(body.text, 1000);
    if (!text) {
      sendJson(response, 400, { error: "Gonderi metni bos olamaz." });
      return;
    }
    db.prepare("INSERT INTO posts (author_id, text, image, created_at) VALUES (?, ?, ?, ?)").run(
      user.id,
      text,
      sanitizeDataUrl(body.image),
      nowIso()
    );
    db.prepare("INSERT INTO notifications (user_id, message, created_at) VALUES (?, ?, ?)").run(
      user.id,
      "Gonderin paylasildi.",
      nowIso()
    );
    logAction(db, user.id, "post.create", "post", db.prepare("SELECT last_insert_rowid() AS id").get().id, "Yeni gonderi");
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "POST" && /^\/api\/posts\/\d+\/like$/.test(pathname)) {
    const user = requireAuth(db, request, response);
    if (!user) return;
    const postId = Number(pathname.split("/")[3]);
    const existing = db.prepare("SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?").get(postId, user.id);
    if (existing) {
      db.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?").run(postId, user.id);
    } else {
      db.prepare("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)").run(postId, user.id);
      const owner = db.prepare("SELECT author_id AS authorId FROM posts WHERE id = ?").get(postId);
      if (owner && owner.authorId !== user.id) {
        db.prepare("INSERT INTO notifications (user_id, message, created_at) VALUES (?, ?, ?)").run(
          owner.authorId,
          `${user.name} gonderini begendi.`,
          nowIso()
        );
      }
    }
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "POST" && /^\/api\/posts\/\d+\/comments$/.test(pathname)) {
    const user = requireAuth(db, request, response);
    if (!user) return;
    const postId = Number(pathname.split("/")[3]);
    const body = await readBody(request);
    const text = sanitizeText(body.text, 220);
    if (!text) {
      sendJson(response, 400, { error: "Yorum bos olamaz." });
      return;
    }
    db.prepare("INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)").run(
      postId,
      user.id,
      text,
      nowIso()
    );
    const owner = db.prepare("SELECT author_id AS authorId FROM posts WHERE id = ?").get(postId);
    if (owner && owner.authorId !== user.id) {
      db.prepare("INSERT INTO notifications (user_id, message, created_at) VALUES (?, ?, ?)").run(
        owner.authorId,
        `${user.name} gonderine yorum yapti.`,
        nowIso()
      );
    }
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "POST" && /^\/api\/friends\/\d+\/toggle$/.test(pathname)) {
    const user = requireAuth(db, request, response);
    if (!user) return;
    const otherId = Number(pathname.split("/")[3]);
    const existing = db
      .prepare(
        "SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)"
      )
      .get(user.id, otherId, otherId, user.id);
    if (existing) {
      db.prepare("DELETE FROM friendships WHERE id = ?").run(existing.id);
      db.prepare("UPDATE users SET friends_count = MAX(0, friends_count - 1) WHERE id IN (?, ?)").run(user.id, otherId);
    } else {
      db.prepare("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')").run(
        user.id,
        otherId
      );
      db.prepare("UPDATE users SET friends_count = friends_count + 1 WHERE id IN (?, ?)").run(user.id, otherId);
      db.prepare("INSERT INTO notifications (user_id, message, created_at) VALUES (?, ?, ?)").run(
        otherId,
        `${user.name} seni arkadas olarak ekledi.`,
        nowIso()
      );
    }
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/logs") {
    const user = requireRole(db, request, response, ["admin", "moderator"]);
    if (!user) return;
    sendJson(response, 200, { logs: listAuditLogs(db) });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/admin\/users\/\d+\/role$/.test(pathname)) {
    const actor = requireRole(db, request, response, ["admin"]);
    if (!actor) return;
    const userId = Number(pathname.split("/")[4]);
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!target) {
      sendJson(response, 404, { error: "Kullanici bulunamadi." });
      return;
    }
    const nextRole = target.role === "admin" ? "member" : target.role === "moderator" ? "admin" : "moderator";
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(nextRole, userId);
    logAction(db, actor.id, "user.role", "user", userId, `Rol ${nextRole} yapildi`);
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "DELETE" && /^\/api\/admin\/posts\/\d+$/.test(pathname)) {
    const actor = requireRole(db, request, response, ["admin", "moderator"]);
    if (!actor) return;
    const postId = Number(pathname.split("/")[4]);
    db.prepare("DELETE FROM post_likes WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM comments WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
    logAction(db, actor.id, "post.delete", "post", postId, "Gonderi silindi");
    sendJson(response, 200, bootstrap(db, request));
    return;
  }

  if (request.method === "POST" && pathname === "/api/reset-demo") {
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM post_likes;
      DELETE FROM comments;
      DELETE FROM posts;
      DELETE FROM notifications;
      DELETE FROM friendships;
      DELETE FROM audit_logs;
      DELETE FROM users;
      DELETE FROM sqlite_sequence;
    `);
    seedDatabase(db);
    sendJson(
      response,
      200,
      bootstrap(db, { headers: { cookie: "" } }),
      {
        "Set-Cookie": [
          `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${SECURE_COOKIE ? "; Secure" : ""}`,
          `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${SECURE_COOKIE ? "; Secure" : ""}`,
        ],
      }
    );
    return;
  }

  sendJson(response, 404, { error: "API yolu bulunamadi." });
}

function serveStatic(response, pathname) {
  const localPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT, localPath.slice(1));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath)] || "text/plain; charset=utf-8",
    "Cache-Control": pathname === "/sw.js" ? "no-cache" : "public, max-age=3600",
    ...securityHeaders(),
  });
  fs.createReadStream(filePath).pipe(response);
}

function createApp(dbFile = DB_FILE) {
  const db = createDatabase(dbFile);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(db, request, response, url.pathname);
        return;
      }

      if (STATIC_FILES.has(url.pathname)) {
        serveStatic(response, url.pathname);
        return;
      }

      serveStatic(response, "/index.html");
    } catch (error) {
      sendJson(response, 500, { error: error.message || "Sunucu hatasi." });
    }
  });
}

function startServer(port = PORT, dbFile = DB_FILE) {
  const server = createApp(dbFile);
  server.listen(port, () => {
    console.log(`Denbook server running at http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
  createDatabase,
  hashPassword,
  verifyPassword,
};
