const state = {
  currentUser: null,
  users: [],
  posts: [],
  notifications: [],
  friends: [],
  auditLogs: [],
  csrfToken: null,
  draftPostImage: "",
  draftAvatarImage: "",
  draftCoverImage: "",
  searchTimer: null,
};

const stories = [
  { name: "Mina", theme: "linear-gradient(160deg, #d95d39, #ffbf69)", note: "Karakoy turu" },
  { name: "Arda", theme: "linear-gradient(160deg, #3d8bfd, #73c9ff)", note: "Yeni setuptan kare" },
  { name: "Selin", theme: "linear-gradient(160deg, #1f9d8a, #83e1ca)", note: "Sabah kosusu" },
  { name: "Baran", theme: "linear-gradient(160deg, #6f5ef7, #b9a5ff)", note: "Canli yayin duyurusu" },
];

const staticVideos = [
  {
    title: "60 saniyede arayuz fikri",
    creator: "Mina Cetin",
    theme:
      "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.55)), url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80')",
    meta: "128K izlenme",
  },
  {
    title: "Kadikoy kahve rotasi",
    creator: "Baris U.",
    theme:
      "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.55)), url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80')",
    meta: "91K izlenme",
  },
];

const marketItems = [
  { title: "Retro kamera", price: "8.500 TL", seller: "Beyoglu", detail: "Temiz kullanildi" },
  { title: "Logo paketi hizmeti", price: "3.000 TL", seller: "Uzaktan", detail: "3 teslim secenegi" },
];

const events = [
  { title: "Moda Sahil Tasarim Yuruyusu", detail: "Cumartesi 15:00  •  284 kisi katiliyor" },
  { title: "No-Code Demo Night", detail: "Persembe 19:00  •  Hibrit etkinlik" },
];

const chatThreads = [
  { initials: "EK", name: "Ekip", preview: "Yeni guncellemeler burada." },
  { initials: "DB", name: "Denbook", preview: "Bildirimler ve notlar." },
];

const chatMessages = [
  { type: "incoming", text: "Yeni backend ile akis daha rahat yonetiliyor." },
  { type: "outgoing", text: "Admin paneli ve PWA katmani da eklendi." },
];

const storyRoot = document.getElementById("stories");
const feedRoot = document.getElementById("feed-list");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const friendsRoot = document.getElementById("friends-list");
const communityRoot = document.getElementById("community-list");
const videoRoot = document.getElementById("video-grid");
const marketRoot = document.getElementById("market-grid");
const eventRoot = document.getElementById("event-list");
const notificationRoot = document.getElementById("notification-list");
const onlineRoot = document.getElementById("online-list");
const chatListRoot = document.getElementById("chat-list");
const messagesRoot = document.getElementById("chat-messages");
const postInput = document.getElementById("post-input");
const postImageInput = document.getElementById("post-image-input");
const postImagePreview = document.getElementById("post-image-preview");
const publishButton = document.getElementById("publish-post");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const toast = document.getElementById("toast");

const authModal = document.getElementById("auth-modal");
const openAuthButton = document.getElementById("open-auth");
const closeAuthButton = document.getElementById("close-auth");
const showLoginButton = document.getElementById("show-login");
const showRegisterButton = document.getElementById("show-register");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutButton = document.getElementById("logout-button");
const authMessage = document.getElementById("auth-message");

const profileChip = document.getElementById("profile-chip");
const profileChipAvatar = document.getElementById("profile-chip-avatar");
const profileChipName = document.getElementById("profile-chip-name");
const profileChipRole = document.getElementById("profile-chip-role");
const profileAvatar = document.getElementById("profile-avatar");
const profileName = document.getElementById("profile-name");
const profileBio = document.getElementById("profile-bio");
const profileFollowers = document.getElementById("profile-followers");
const profileFriends = document.getElementById("profile-friends");
const profilePostCount = document.getElementById("profile-post-count");
const profileNameInput = document.getElementById("profile-name-input");
const profileBioInput = document.getElementById("profile-bio-input");
const avatarImageInput = document.getElementById("avatar-image-input");
const coverImageInput = document.getElementById("cover-image-input");
const saveProfileButton = document.getElementById("save-profile");

const adminMenuButton = document.getElementById("admin-menu-button");
const adminUsersRoot = document.getElementById("admin-users");
const adminPostsRoot = document.getElementById("admin-posts");
const adminLogsRoot = document.getElementById("admin-logs");
const adminUserCount = document.getElementById("admin-user-count");
const adminPostCount = document.getElementById("admin-post-count");
const adminAdminCount = document.getElementById("admin-admin-count");
const seedDemoButton = document.getElementById("seed-demo");
const refreshAdminUsersButton = document.getElementById("refresh-admin-users");
const refreshAdminPostsButton = document.getElementById("refresh-admin-posts");
const refreshAdminLogsButton = document.getElementById("refresh-admin-logs");

const coverArt = document.querySelector(".cover-art");
const allViews = ["feed", "circles", "pulse", "market", "events", "chat", "profile", "admin"];

const onlineFallback = [
  { initials: "EK", name: "Topluluk", state: "cevrim ici" },
  { initials: "DB", name: "Destek", state: "simdi aktif" },
];

function initials(name) {
  return String(name || "")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.style.background = isError ? "rgba(188, 70, 37, 0.94)" : "rgba(31, 41, 55, 0.92)";
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function setMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#bc4625" : "";
}

function getCsrfToken() {
  if (state.csrfToken) return state.csrfToken;
  const match = document.cookie.split("; ").find((cookie) => cookie.startsWith("denbook_csrf="));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const method = options.method || "GET";
  if (!headers["Content-Type"] && method !== "GET") {
    headers["Content-Type"] = "application/json";
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Istek basarisiz.");
  return payload;
}

function toggleAuthMode(mode) {
  const loginActive = mode === "login";
  loginForm.classList.toggle("hidden", !loginActive);
  registerForm.classList.toggle("hidden", loginActive);
  showLoginButton.className = loginActive ? "primary" : "ghost";
  showRegisterButton.className = loginActive ? "ghost" : "primary";
}

function openAuth(mode = "login") {
  authModal.classList.remove("hidden");
  toggleAuthMode(mode);
}

function closeAuth() {
  authModal.classList.add("hidden");
}

function setStateFromPayload(payload) {
  state.currentUser = payload.currentUser;
  state.users = payload.users || [];
  state.posts = payload.posts || [];
  state.notifications = payload.notifications || [];
  state.friends = payload.friends || [];
  state.auditLogs = payload.auditLogs || [];
  state.csrfToken = payload.csrfToken || state.csrfToken;
}

function renderStories() {
  storyRoot.innerHTML = stories
    .map(
      (story) => `
        <article class="story-card" style="background:${story.theme}">
          <div class="pill">hikaye</div>
          <div><strong>${story.name}</strong><p>${story.note}</p></div>
        </article>
      `
    )
    .join("");
}

function postImageStyle(image) {
  if (!image) {
    return "linear-gradient(135deg, rgba(217,93,57,0.18), rgba(61,139,253,0.18))";
  }
  if (image.startsWith("data:") || image.startsWith("http")) {
    return `url('${image}') center/cover no-repeat`;
  }
  return image;
}

function postCard(post) {
  return `
    <article class="post-card">
      <div class="post-head">
        <div class="person-card">
          <div class="avatar gradient-b">${initials(post.authorName)}</div>
          <div class="person-meta">
            <strong>${post.authorName}</strong>
            <small>${post.authorRole}  •  ${post.timeLabel}</small>
          </div>
        </div>
        <span class="pill">gonderi</span>
      </div>
      <div class="post-body post-social">
        <p>${post.text}</p>
        <div class="post-image" style="background:${postImageStyle(post.image)}"></div>
        <div class="post-actions">
          <span>${post.likesCount} begeni • ${post.comments.length} yorum</span>
          <div>
            <button class="ghost" data-like-post="${post.id}">${post.likedByMe ? "Begendin" : "Begen"}</button>
          </div>
        </div>
        <div class="comment-list">
          ${post.comments
            .map((comment) => `<div class="comment-item"><strong>${comment.authorName}</strong><p>${comment.text}</p></div>`)
            .join("")}
        </div>
        <form class="comment-form" data-comment-form="${post.id}">
          <input type="text" placeholder="Yorum yaz..." name="comment" />
          <button class="primary" type="submit">Gonder</button>
        </form>
      </div>
    </article>
  `;
}

function renderPosts() {
  feedRoot.innerHTML = state.posts.map(postCard).join("");
  profilePostCount.textContent = String(
    state.currentUser ? state.posts.filter((post) => post.authorId === state.currentUser.id).length : 0
  );
}

function renderFriends() {
  const people = state.users.filter((user) => !state.currentUser || user.id !== state.currentUser.id).slice(0, 6);
  friendsRoot.innerHTML = people
    .map(
      (person, index) => `
        <article class="person-card">
          <div class="avatar ${index % 2 === 0 ? "gradient-c" : "gradient-d"}">${initials(person.name)}</div>
          <div class="person-meta">
            <strong>${person.name}</strong>
            <small>${person.role}</small>
          </div>
          <button class="pill" data-friend-id="${person.id}">bag kur</button>
        </article>
      `
    )
    .join("");
}

function renderCommunities() {
  const items = ["Uretenler Kulubu • haftalik meetup", "Sehir Fotografi Rotasi • acik cagrilar", "No-Code Builders TR • acik paylasim"];
  communityRoot.innerHTML = items.map((item) => `<article class="community-card"><strong>${item}</strong></article>`).join("");
}

function renderVideos() {
  videoRoot.innerHTML = staticVideos
    .map(
      (video) => `
        <article class="video-card">
          <div class="video-thumb" style="background:${video.theme}">
            <div><div class="pill">Pulse</div><h3>${video.title}</h3><span>${video.creator} • ${video.meta}</span></div>
          </div>
          <div class="video-info"><strong>${video.title}</strong><span>${video.creator}</span></div>
        </article>
      `
    )
    .join("");
}

function renderMarket() {
  marketRoot.innerHTML = marketItems
    .map(
      (item) => `
        <article class="market-card">
          <div class="market-preview"></div>
          <div class="market-info"><strong>${item.title}</strong><span>${item.seller} • ${item.detail}</span><h3>${item.price}</h3></div>
        </article>
      `
    )
    .join("");
}

function renderEvents() {
  eventRoot.innerHTML = events
    .map((event) => `<article class="event-card"><strong>${event.title}</strong><span>${event.detail}</span></article>`)
    .join("");
}

function renderNotifications() {
  notificationRoot.innerHTML = state.notifications
    .map(
      (item, index) => `
        <article class="notification-item">
          <div class="avatar ${index % 2 === 0 ? "gradient-a" : "gradient-b"}">${String(item.message).slice(0, 1)}</div>
          <div><strong>${item.message}</strong><span>${item.createdAt}</span></div>
        </article>
      `
    )
    .join("");
}

function renderOnline() {
  onlineRoot.innerHTML = onlineFallback
    .map(
      (person, index) => `
        <article class="online-item">
          <div class="avatar ${index % 2 === 0 ? "gradient-c" : "gradient-d"}">${person.initials}</div>
          <div><strong>${person.name}</strong><span>${person.state}</span></div>
        </article>
      `
    )
    .join("");
}

function renderChat() {
  chatListRoot.innerHTML = chatThreads
    .map(
      (thread, index) => `
        <article class="chat-thread ${index === 0 ? "active" : ""}">
          <div class="person-card">
            <div class="avatar ${index % 2 === 0 ? "gradient-b" : "gradient-c"}">${thread.initials}</div>
            <div class="person-meta"><strong>${thread.name}</strong><small>${thread.preview}</small></div>
          </div>
          <span class="pill">${index === 0 ? "aktif" : "okundu"}</span>
        </article>
      `
    )
    .join("");

  messagesRoot.innerHTML = chatMessages.map((item) => `<div class="bubble ${item.type}">${item.text}</div>`).join("");
}

function renderProfile() {
  if (!state.currentUser) {
    profileName.textContent = "Misafir kullanici";
    profileBio.textContent = "Profil duzenlemek icin giris yap.";
    profileAvatar.textContent = "MI";
    profileAvatar.style.background = "";
    coverArt.style.background = "";
    profileFollowers.textContent = "-";
    profileFriends.textContent = "-";
    profileNameInput.value = "";
    profileBioInput.value = "";
    return;
  }

  profileName.textContent = state.currentUser.name;
  profileBio.textContent = state.currentUser.bio;
  profileAvatar.textContent = state.currentUser.avatarImage ? "" : initials(state.currentUser.name);
  profileAvatar.style.background = state.currentUser.avatarImage ? `url('${state.currentUser.avatarImage}') center/cover no-repeat` : "";
  profileFollowers.textContent = String(state.currentUser.followersCount);
  profileFriends.textContent = String(state.currentUser.friendsCount);
  profileNameInput.value = state.currentUser.name;
  profileBioInput.value = state.currentUser.bio;
  coverArt.style.background = state.currentUser.coverImage
    ? `linear-gradient(135deg, rgba(217, 93, 57, 0.2), rgba(61, 139, 253, 0.2)), url('${state.currentUser.coverImage}') center/cover no-repeat`
    : "";
}

function renderAuthState() {
  const loggedIn = Boolean(state.currentUser);
  openAuthButton.classList.toggle("hidden", loggedIn);
  profileChip.classList.toggle("hidden", !loggedIn);
  logoutButton.classList.toggle("hidden", !loggedIn);
  adminMenuButton.classList.toggle("hidden", !(state.currentUser && ["admin", "moderator"].includes(state.currentUser.role)));

  if (state.currentUser) {
    profileChipAvatar.textContent = initials(state.currentUser.name);
    profileChipName.textContent = state.currentUser.name;
    profileChipRole.textContent = state.currentUser.role;
  }
}

function renderAdmin() {
  adminUserCount.textContent = String(state.users.length);
  adminPostCount.textContent = String(state.posts.length);
  adminAdminCount.textContent = String(state.users.filter((user) => user.role === "admin").length);

  adminUsersRoot.innerHTML = state.users
    .map(
      (user) => `
        <article class="admin-row">
          <div><strong>${user.name}</strong><p>${user.email} • ${user.role}</p></div>
          <button class="ghost" data-role-user="${user.id}">rol degistir</button>
        </article>
      `
    )
    .join("");

  adminPostsRoot.innerHTML = state.posts
    .map(
      (post) => `
        <article class="admin-row">
          <div><strong>${post.authorName}</strong><p>${post.text.slice(0, 80)}...</p></div>
          <button class="ghost" data-delete-post="${post.id}">sil</button>
        </article>
      `
    )
    .join("");

  adminLogsRoot.innerHTML = state.auditLogs
    .map(
      (log) => `
        <article class="admin-row">
          <div><strong>${log.actorName}</strong><p>${log.action} • ${log.targetType} #${log.targetId}</p></div>
          <span>${log.createdAt}</span>
        </article>
      `
    )
    .join("");
}

function renderSearchResults(data) {
  if (!searchInput.value.trim()) {
    searchResults.classList.add("hidden");
    searchResults.innerHTML = "";
    return;
  }

  searchResults.classList.remove("hidden");
  searchResults.innerHTML = `
    <div class="search-group">
      <h3>Kullanicilar</h3>
      ${(data.users || []).map((user) => `<div class="admin-row"><strong>${user.name}</strong><span>${user.role}</span></div>`).join("") || "<p>Sonuc yok.</p>"}
    </div>
    <div class="search-group">
      <h4>Gonderiler</h4>
      ${(data.posts || []).map((post) => `<div class="admin-row"><strong>${post.authorName}</strong><p>${post.text.slice(0, 90)}</p></div>`).join("") || "<p>Sonuc yok.</p>"}
    </div>
  `;
}

function setActiveView(view) {
  const canAdmin = state.currentUser && ["admin", "moderator"].includes(state.currentUser.role);
  const resolved = view === "admin" && !canAdmin ? "feed" : view;
  allViews.forEach((item) => {
    document.getElementById(`${item}-view`).classList.toggle("active", item === resolved);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === resolved);
  });
}

function renderAll() {
  renderStories();
  renderPosts();
  renderFriends();
  renderCommunities();
  renderVideos();
  renderMarket();
  renderEvents();
  renderNotifications();
  renderOnline();
  renderChat();
  renderProfile();
  renderAuthState();
  renderAdmin();
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadBootstrap() {
  const payload = await api("/api/bootstrap");
  setStateFromPayload(payload);
  renderAll();
}

async function handleLogin(email, password) {
  const payload = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStateFromPayload(payload);
  closeAuth();
  renderAll();
  showToast("Giris yapildi.");
}

async function handleRegister(name, email, password) {
  const payload = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  setStateFromPayload(payload);
  closeAuth();
  renderAll();
  showToast("Kayit tamamlandi.");
}

async function handleLogout() {
  await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
  state.currentUser = null;
  await loadBootstrap();
  showToast("Cikis yapildi.");
}

async function saveProfile() {
  if (!state.currentUser) {
    openAuth("login");
    return;
  }
  const payload = await api("/api/profile", {
    method: "PUT",
    body: JSON.stringify({
      name: profileNameInput.value.trim(),
      bio: profileBioInput.value.trim(),
      avatarImage: state.draftAvatarImage,
      coverImage: state.draftCoverImage,
    }),
  });
  setStateFromPayload(payload);
  renderAll();
  state.draftAvatarImage = "";
  state.draftCoverImage = "";
  showToast("Profil kaydedildi.");
}

async function createPost() {
  if (!state.currentUser) {
    openAuth("login");
    return;
  }
  const text = postInput.value.trim();
  if (!text) return;
  const payload = await api("/api/posts", {
    method: "POST",
    body: JSON.stringify({ text, image: state.draftPostImage }),
  });
  setStateFromPayload(payload);
  renderAll();
  postInput.value = "";
  state.draftPostImage = "";
  postImageInput.value = "";
  postImagePreview.classList.add("hidden");
  showToast("Gonderi paylasildi.");
}

async function toggleLike(postId) {
  const payload = await api(`/api/posts/${postId}/like`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  setStateFromPayload(payload);
  renderAll();
}

async function submitComment(postId, text) {
  const payload = await api(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  setStateFromPayload(payload);
  renderAll();
}

async function toggleFriend(userId) {
  const payload = await api(`/api/friends/${userId}/toggle`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  setStateFromPayload(payload);
  renderAll();
  showToast("Arkadaslik durumu guncellendi.");
}

async function search(query) {
  if (!query.trim()) {
    renderSearchResults({ users: [], posts: [] });
    return;
  }
  const data = await api(`/api/search?q=${encodeURIComponent(query.trim())}`);
  renderSearchResults(data);
}

async function changeRole(userId) {
  const payload = await api(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  setStateFromPayload(payload);
  renderAll();
  showToast("Rol guncellendi.");
}

async function deletePost(postId) {
  const payload = await api(`/api/admin/posts/${postId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  setStateFromPayload(payload);
  renderAll();
  showToast("Gonderi silindi.");
}

async function refreshLogs() {
  const data = await api("/api/admin/logs");
  state.auditLogs = data.logs || [];
  renderAdmin();
}

async function resetDemo() {
  const payload = await api("/api/reset-demo", {
    method: "POST",
    body: JSON.stringify({}),
  });
  setStateFromPayload(payload);
  renderAll();
  showToast("Veriler sifirlandi.");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.view));
});

searchInput.addEventListener("input", () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => {
    search(searchInput.value).catch((error) => showToast(error.message, true));
  }, 220);
});

postImageInput.addEventListener("change", async () => {
  state.draftPostImage = await toDataUrl(postImageInput.files[0]);
  if (state.draftPostImage) {
    postImagePreview.src = state.draftPostImage;
    postImagePreview.classList.remove("hidden");
  }
});

avatarImageInput.addEventListener("change", async () => {
  state.draftAvatarImage = await toDataUrl(avatarImageInput.files[0]);
  showToast("Profil gorseli secildi.");
});

coverImageInput.addEventListener("change", async () => {
  state.draftCoverImage = await toDataUrl(coverImageInput.files[0]);
  showToast("Kapak gorseli secildi.");
});

publishButton.addEventListener("click", () => createPost().catch((error) => showToast(error.message, true)));

feedRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-like-post]");
  if (!button) return;
  toggleLike(button.dataset.likePost).catch((error) => showToast(error.message, true));
});

feedRoot.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector("input[name='comment']");
  submitComment(form.dataset.commentForm, input.value)
    .then(() => {
      input.value = "";
    })
    .catch((error) => showToast(error.message, true));
});

friendsRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-friend-id]");
  if (!button) return;
  toggleFriend(button.dataset.friendId).catch((error) => showToast(error.message, true));
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatMessages.push({ type: "outgoing", text });
  messagesRoot.innerHTML = chatMessages.map((item) => `<div class="bubble ${item.type}">${item.text}</div>`).join("");
  chatInput.value = "";
});

openAuthButton.addEventListener("click", () => openAuth("login"));
closeAuthButton.addEventListener("click", closeAuth);
showLoginButton.addEventListener("click", () => toggleAuthMode("login"));
showRegisterButton.addEventListener("click", () => toggleAuthMode("register"));
logoutButton.addEventListener("click", () => handleLogout().catch((error) => showToast(error.message, true)));
saveProfileButton.addEventListener("click", () => saveProfile().catch((error) => showToast(error.message, true)));
seedDemoButton.addEventListener("click", () => resetDemo().catch((error) => showToast(error.message, true)));
refreshAdminUsersButton.addEventListener("click", () => loadBootstrap().catch((error) => showToast(error.message, true)));
refreshAdminPostsButton.addEventListener("click", () => loadBootstrap().catch((error) => showToast(error.message, true)));
refreshAdminLogsButton.addEventListener("click", () => refreshLogs().catch((error) => showToast(error.message, true)));

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleLogin(
    document.getElementById("login-email").value.trim(),
    document.getElementById("login-password").value.trim()
  )
    .then(() => setMessage(""))
    .catch((error) => setMessage(error.message, true));
});

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleRegister(
    document.getElementById("register-name").value.trim(),
    document.getElementById("register-email").value.trim(),
    document.getElementById("register-password").value.trim()
  )
    .then(() => setMessage(""))
    .catch((error) => setMessage(error.message, true));
});

adminUsersRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-role-user]");
  if (!button) return;
  changeRole(button.dataset.roleUser).catch((error) => showToast(error.message, true));
});

adminPostsRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-post]");
  if (!button) return;
  deletePost(button.dataset.deletePost).catch((error) => showToast(error.message, true));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

loadBootstrap()
  .then(() => setActiveView("feed"))
  .catch((error) => showToast(error.message, true));
