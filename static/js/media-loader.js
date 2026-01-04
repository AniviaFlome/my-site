/**
 * Media Loader - Client-side JavaScript for fetching media data
 * All requests go through Cloudflare Functions at /api/*
 */

// Render functions
function showLoading(container) {
  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  `;
}

function showError(container, message) {
  container.innerHTML = `
    <div class="error-state">
      <p>⚠️ ${message}</p>
    </div>
  `;
}

function renderMediaGrid(data, container, type) {
  if (!data.categories?.length) {
    container.innerHTML = '<div class="no-data"><p>No data available.</p></div>';
    return;
  }

  const isAnime = type === "anime";
  const isManga = type === "manga";
  const isAniList = isAnime || isManga;

  const profileUrl = isAniList
    ? `https://anilist.co/user/${data.username}/${type}list`
    : `https://trakt.tv/users/${data.username}`;
  const sourceName = isAniList ? "AniList" : "Trakt";

  let html = `
    <div class="page-stats">
      <span class="stat-item">${data.totalCount} titles</span>
      <span class="stat-item">
        <a href="${profileUrl}" target="_blank" rel="noopener">${sourceName} ↗</a>
      </span>
    </div>
  `;

  for (const cat of data.categories) {
    html += `
      <section class="media-section">
        <h2 class="section-title">
          ${cat.displayName}
          <span class="section-count">(${cat.count})</span>
        </h2>
        <div class="media-grid">
    `;

    for (const entry of cat.entries) {
      const progressLabel = isAnime
        ? `${entry.progress}${entry.episodes ? "/" + entry.episodes : ""} eps`
        : isManga
          ? `${entry.progress}${entry.chapters ? "/" + entry.chapters : ""} ch`
          : entry.year || "";

      const scoreKey = isAniList ? "score" : "rating";
      const score = entry[scoreKey] || 0;
      const imageKey = isAniList ? "coverImage" : "posterImage";
      const image = entry[imageKey] || "";

      html += `
        <a href="${entry.url}" target="_blank" rel="noopener" class="media-card" title="${entry.title}">
          <div class="media-cover">
            ${image ? `<img src="${image}" alt="${entry.title}" loading="lazy" />` : '<div class="no-image">No Image</div>'}
            ${score > 0 ? `<span class="media-score">★ ${score}</span>` : ""}
          </div>
          <div class="media-info">
            <h3 class="media-title">${entry.title}</h3>
            <div class="media-progress">${progressLabel}</div>
          </div>
        </a>
      `;
    }

    html += `
        </div>
      </section>
    `;
  }

  container.innerHTML = html;
}

async function loadMedia(containerId, endpoint, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  showLoading(container);
  try {
    const res = await fetch(`/api/${endpoint}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderMediaGrid(data, container, type);
  } catch (err) {
    console.error(`Failed to load ${type}:`, err);
    showError(container, `Failed to load ${type}. Please try again later.`);
  }
}

// Main loader functions
window.MediaLoader = {
  loadAnime: (id) => loadMedia(id, "anime", "anime"),
  loadManga: (id) => loadMedia(id, "manga", "manga"),
  loadShows: (id) => loadMedia(id, "shows", "shows"),
  loadMovies: (id) => loadMedia(id, "movies", "movies"),
};
