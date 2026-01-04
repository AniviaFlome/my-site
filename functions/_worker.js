/**
 * Cloudflare Pages Functions - Media API Proxy
 * Proxies requests to AniList, Trakt, and TMDB APIs
 */

const ANILIST_API_URL = "https://graphql.anilist.co";
const TRAKT_API_URL = "https://api.trakt.tv";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const USERNAME = "AniviaFlome";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const ANILIST_QUERY = `
query ($username: String, $type: MediaType) {
  MediaListCollection(userName: $username, type: $type) {
    lists {
      status
      entries {
        score(format: POINT_10)
        progress
        media {
          id
          title { english romaji native }
          episodes
          chapters
          coverImage { large }
          siteUrl
        }
      }
    }
  }
}
`;

const ANILIST_STATUS_ORDER = {
    CURRENT: 0, REPEATING: 1, COMPLETED: 2, PAUSED: 3, DROPPED: 4, PLANNING: 5,
};

const ANIME_STATUS_DISPLAY = {
    CURRENT: "Watching", REPEATING: "Rewatching", COMPLETED: "Completed",
    PAUSED: "On Hold", DROPPED: "Dropped", PLANNING: "Plan to Watch",
};

const MANGA_STATUS_DISPLAY = {
    CURRENT: "Reading", REPEATING: "Rereading", COMPLETED: "Completed",
    PAUSED: "On Hold", DROPPED: "Dropped", PLANNING: "Plan to Read",
};

const TRAKT_STATUS_DISPLAY = {
    watched: "Watched",
    watchlist: "Watchlist",
};

function handleOptions() {
    return new Response(null, { headers: corsHeaders });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ============ AniList Handlers ============

async function fetchAniList(type) {
    const res = await fetch(ANILIST_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: ANILIST_QUERY,
            variables: { username: USERNAME, type },
        }),
    });
    if (!res.ok) throw new Error(`AniList error: ${res.status}`);
    return res.json();
}

function transformAniList(raw, type) {
    const lists = raw?.data?.MediaListCollection?.lists || [];
    const statusDisplay = type === "ANIME" ? ANIME_STATUS_DISPLAY : MANGA_STATUS_DISPLAY;
    const byStatus = {};

    for (const lst of lists) {
        const status = lst.status || "CURRENT";
        const entries = lst.entries.map((e) => {
            const m = e.media || {};
            const t = m.title || {};
            return {
                id: m.id,
                title: t.english || t.romaji || t.native || "Unknown",
                coverImage: m.coverImage?.large || "",
                score: e.score || 0,
                progress: e.progress || 0,
                episodes: m.episodes,
                chapters: m.chapters,
                url: m.siteUrl || "",
            };
        });

        entries.sort((a, b) => (b.score || 0) - (a.score || 0) || a.title.localeCompare(b.title));

        byStatus[status] = {
            displayName: statusDisplay[status] || status,
            order: ANILIST_STATUS_ORDER[status] ?? 99,
            entries,
            count: entries.length,
        };
    }

    const sortedStatuses = Object.keys(byStatus).sort(
        (a, b) => (ANILIST_STATUS_ORDER[a] ?? 99) - (ANILIST_STATUS_ORDER[b] ?? 99)
    );
    const categories = sortedStatuses
        .filter((s) => byStatus[s].entries.length)
        .map((s) => ({ status: s, ...byStatus[s] }));

    return {
        username: USERNAME,
        categories,
        totalCount: categories.reduce((sum, c) => sum + c.count, 0),
    };
}

async function handleAnime() {
    try {
        const raw = await fetchAniList("ANIME");
        return jsonResponse(transformAniList(raw, "ANIME"));
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}

async function handleManga() {
    try {
        const raw = await fetchAniList("MANGA");
        return jsonResponse(transformAniList(raw, "MANGA"));
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}

// ============ Trakt/TMDB Handlers ============

async function fetchTrakt(endpoint, clientId) {
    const res = await fetch(`${TRAKT_API_URL}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            "trakt-api-version": "2",
            "trakt-api-key": clientId,
        },
    });
    if (!res.ok) throw new Error(`Trakt API error: ${res.status}`);
    return res.json();
}

async function getTmdbPoster(tmdbId, apiKey, type = "movie") {
    if (!tmdbId || !apiKey) return "";
    try {
        const res = await fetch(`${TMDB_API_URL}/${type}/${tmdbId}?api_key=${apiKey}`);
        if (!res.ok) return "";
        const data = await res.json();
        return data.poster_path ? `https://image.tmdb.org/t/p/w300${data.poster_path}` : "";
    } catch {
        return "";
    }
}

async function handleShows(env) {
    const clientId = env.TRAKT_CLIENT_ID;
    const tmdbKey = env.TMDB_API_KEY || "";

    if (!clientId) {
        return jsonResponse({ error: "TRAKT_CLIENT_ID not configured" }, 500);
    }

    const userRatings = {};
    try {
        const ratings = await fetchTrakt(`/users/${USERNAME}/ratings/shows`, clientId);
        for (const r of ratings) {
            const showId = r.show?.ids?.trakt;
            if (showId) userRatings[showId] = r.rating || 0;
        }
    } catch { }

    const categories = [];
    let total = 0;

    for (const status of ["watched", "watchlist"]) {
        try {
            const items = await fetchTrakt(`/users/${USERNAME}/${status}/shows?extended=full`, clientId);
            const entries = await Promise.all(
                items.map(async (item) => {
                    const show = item.show || item;
                    const ids = show.ids || {};
                    const rating = userRatings[ids.trakt] || 0;
                    const poster = await getTmdbPoster(ids.tmdb, tmdbKey, "tv");

                    return {
                        id: ids.trakt,
                        title: show.title || "Unknown",
                        year: show.year,
                        posterImage: poster,
                        rating,
                        url: `https://trakt.tv/shows/${ids.slug || ""}`,
                    };
                })
            );

            entries.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title));

            categories.push({
                status,
                displayName: TRAKT_STATUS_DISPLAY[status] || status,
                order: status === "watched" ? 0 : 1,
                entries,
                count: entries.length,
            });
            total += entries.length;
        } catch { }
    }

    return jsonResponse({ username: USERNAME, categories, totalCount: total });
}

async function handleMovies(env) {
    const clientId = env.TRAKT_CLIENT_ID;
    const tmdbKey = env.TMDB_API_KEY || "";

    if (!clientId) {
        return jsonResponse({ error: "TRAKT_CLIENT_ID not configured" }, 500);
    }

    const userRatings = {};
    try {
        const ratings = await fetchTrakt(`/users/${USERNAME}/ratings/movies`, clientId);
        for (const r of ratings) {
            const movieId = r.movie?.ids?.trakt;
            if (movieId) userRatings[movieId] = r.rating || 0;
        }
    } catch { }

    const categories = [];
    let total = 0;

    for (const status of ["watched", "watchlist"]) {
        try {
            const items = await fetchTrakt(`/users/${USERNAME}/${status}/movies?extended=full`, clientId);
            const entries = await Promise.all(
                items.map(async (item) => {
                    const movie = item.movie || item;
                    const ids = movie.ids || {};
                    const rating = userRatings[ids.trakt] || 0;
                    const poster = await getTmdbPoster(ids.tmdb, tmdbKey, "movie");

                    return {
                        id: ids.trakt,
                        title: movie.title || "Unknown",
                        year: movie.year,
                        posterImage: poster,
                        rating,
                        url: `https://trakt.tv/movies/${ids.slug || ""}`,
                    };
                })
            );

            entries.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title));

            categories.push({
                status,
                displayName: TRAKT_STATUS_DISPLAY[status] || status,
                order: status === "watched" ? 0 : 1,
                entries,
                count: entries.length,
            });
            total += entries.length;
        } catch { }
    }

    return jsonResponse({ username: USERNAME, categories, totalCount: total });
}

// ============ Main Router ============

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return handleOptions();
        }

        switch (url.pathname) {
            case "/api/anime":
                return handleAnime();
            case "/api/manga":
                return handleManga();
            case "/api/shows":
                return handleShows(env);
            case "/api/movies":
                return handleMovies(env);
            default:
                return env.ASSETS.fetch(request);
        }
    },
};
