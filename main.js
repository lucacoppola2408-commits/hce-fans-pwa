const STORAGE_KEYS = {
  matches: 'hce-fans-matches-v2',
  news: 'hce-fans-news-v2'
};

const PROXY_PREFIX = 'https://r.jina.ai/https://';
const OPENLIGADB_BASE_URL = 'https://www.openligadb.de/api';
const OPENLIGADB_LEAGUE = 'liquimoly-hbl';
const TEAM_IDENTIFIER = 'hc erlangen';

const NEWS_ENDPOINT = 'https://www.hc-erlangen.de/wp-json/wp/v2/posts?per_page=12&_embed=1';

const FETCH_OPTIONS = {
  cache: 'no-store',
  credentials: 'omit',
  mode: 'cors'
};

let countdownInterval;
let deferredInstallPrompt;
let cachedMatches = [];
let cachedNews = [];

const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin'
});

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: 'long'
});

document.addEventListener('DOMContentLoaded', () => {
  initialiseApp();
});

async function initialiseApp() {
  registerServiceWorker();
  setupInstallPrompt();
  bindFilterControls();

  const cachedMatchPayload = loadCachedData(STORAGE_KEYS.matches);
  if (cachedMatchPayload?.data?.length) {
    updateMatchesUI(cachedMatchPayload.data, {
      updatedAt: cachedMatchPayload.updatedAt,
      source: 'cache'
    });
  }

  const cachedNewsPayload = loadCachedData(STORAGE_KEYS.news);
  if (cachedNewsPayload?.data?.length) {
    updateNewsUI(cachedNewsPayload.data, {
      updatedAt: cachedNewsPayload.updatedAt,
      source: 'cache'
    });
  }

  await Promise.allSettled([refreshMatches(), refreshNews()]);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((error) => {
      console.warn('Service Worker Registrierung fehlgeschlagen', error);
    });
  }
}

function setupInstallPrompt() {
  const installButton = document.getElementById('installButton');
  if (!installButton) {
    return;
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      installButton.textContent = 'Installiert';
    }
    installButton.disabled = true;
    installButton.hidden = true;
    deferredInstallPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    installButton.disabled = true;
    deferredInstallPrompt = null;
  });
}

async function refreshMatches() {
  try {
    const matches = await fetchLatestMatches();
    if (!matches.length) {
      updateMatchesUI([], { updatedAt: null, source: 'live' });
      showScheduleFallbackMessage();
      return;
    }

    const payload = saveCachedData(STORAGE_KEYS.matches, matches);
    updateMatchesUI(matches, { updatedAt: payload.updatedAt, source: 'live' });
  } catch (error) {
    console.error('Spielplan konnte nicht aktualisiert werden.', error);
    if (!cachedMatches.length) {
      showScheduleErrorMessage();
    }
  }
}

async function refreshNews() {
  try {
    const news = await fetchLatestNews();
    if (!news.length) {
      updateNewsUI([], { updatedAt: null, source: 'live' });
      showNewsFallbackMessage();
      return;
    }

    const payload = saveCachedData(STORAGE_KEYS.news, news);
    updateNewsUI(news, { updatedAt: payload.updatedAt, source: 'live' });
  } catch (error) {
    console.error('News konnten nicht aktualisiert werden.', error);
    if (!cachedNews.length) {
      showNewsErrorMessage();
    }
  }
}

function updateMatchesUI(matches, meta) {
  cachedMatches = Array.isArray(matches) ? matches.slice() : [];
  renderNextMatch(cachedMatches);
  renderSchedule(cachedMatches, getActiveFilter());
  updateUpdatedAt('schedule-updated', meta?.updatedAt ?? null, meta?.source);
}

function updateNewsUI(newsItems, meta) {
  cachedNews = Array.isArray(newsItems) ? newsItems.slice() : [];
  renderNews(cachedNews);
  updateUpdatedAt('news-updated', meta?.updatedAt ?? null, meta?.source);
}

function loadCachedData(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Konnte lokale Daten nicht lesen', error);
    return null;
  }
}

function saveCachedData(key, data) {
  const payload = {
    data,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('Konnte lokale Daten nicht speichern', error);
  }

  return payload;
}

async function fetchLatestMatches() {
  const seasons = determineSeasons();
  const requests = seasons.map((season) =>
    fetchJsonFromUrls([
      `${OPENLIGADB_BASE_URL}/getmatchdata/${OPENLIGADB_LEAGUE}/${season}`,
      proxiedUrl(`${OPENLIGADB_BASE_URL}/getmatchdata/${OPENLIGADB_LEAGUE}/${season}`)
    ])
      .then((data) => ({ status: 'fulfilled', season, data }))
      .catch((error) => ({ status: 'rejected', season, error }))
  );

  const results = await Promise.all(requests);
  const collected = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled' && Array.isArray(result.data)) {
      result.data.forEach((match) => collected.push({ match, season: result.season }));
    } else if (result.error) {
      console.warn(`Spielplan für Saison ${result.season} konnte nicht geladen werden.`, result.error);
    }
  });

  return normaliseMatches(collected);
}

async function fetchLatestNews() {
  const posts = await fetchJsonFromUrls([NEWS_ENDPOINT, proxiedUrl(NEWS_ENDPOINT)]);
  if (!Array.isArray(posts)) {
    return [];
  }

  return posts
    .map(parseNewsPost)
    .filter((item) => Boolean(item));
}

async function fetchJsonFromUrls(urls) {
  let lastError;

  for (const url of urls) {
    try {
      const response = await fetch(url, FETCH_OPTIONS);
      if (!response.ok || response.type === 'opaque') {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }

      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.warn(`Abruf fehlgeschlagen (${url})`, error);
    }
  }

  throw lastError ?? new Error('Keine der Datenquellen konnte geladen werden.');
}

function determineSeasons() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const seasons = new Set();
  if (month >= 5) {
    seasons.add(year);
    seasons.add(year + 1);
  } else {
    seasons.add(year - 1);
    seasons.add(year);
  }

  // Frühzeitiger Blick auf kommende Saison, sobald Termine veröffentlicht sind
  seasons.add(year + 1);

  return Array.from(seasons).sort((a, b) => a - b);
}

function normaliseMatches(entries) {
  const byId = new Map();

  entries.forEach(({ match, season }) => {
    if (!match || (!isOurTeam(match.Team1) && !isOurTeam(match.Team2))) {
      return;
    }

    const isoDate = deriveMatchDate(match);
    if (!isoDate) {
      return;
    }

    const id = String(match.MatchID ?? `${season}-${isoDate}`);
    if (byId.has(id)) {
      return;
    }

    const homeTeam = match.Team1 ?? {};
    const awayTeam = match.Team2 ?? {};
    const isHome = isOurTeam(homeTeam);
    const opponentTeam = isHome ? awayTeam : homeTeam;

    const location = match.Location ?? {};
    const arena = location.LocationStadium ?? null;
    const city = formatCity(location);

    const groupName = match.Group?.GroupName ?? null;
    const matchday = deriveMatchday(match.Group);

    byId.set(id, {
      id,
      matchday,
      groupName,
      season,
      date: isoDate,
      opponent: opponentTeam.TeamName ?? 'Noch offen',
      home: isHome,
      competition: match.LeagueName ?? 'LIQUI MOLY HBL',
      arena: arena ?? 'Noch nicht fixiert',
      city,
      broadcast: null,
      ticketUrl: location.TicketURL ?? null,
      notes: match.Remark ?? '',
      durationMinutes: 110
    });
  });

  return Array.from(byId.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function parseNewsPost(post) {
  if (!post) {
    return null;
  }

  const title = stripHtml(post.title?.rendered ?? '') || 'Neuigkeit';
  const summarySource = post.excerpt?.rendered ?? '';
  const summary = stripHtml(summarySource).replace(/\s+/g, ' ').trim();
  const date = new Date(post.date ?? Date.now());

  const categories = (post._embedded?.['wp:term'] ?? [])
    .flat()
    .map((term) => term?.name)
    .filter(Boolean);

  return {
    id: String(post.id ?? `${date.getTime()}-${title}`),
    date: date.toISOString(),
    title,
    summary: summary || 'Keine Vorschau verfügbar.',
    link: post.link ?? NEWS_ENDPOINT,
    category: categories[0] ?? 'HC Erlangen'
  };
}

function isOurTeam(team) {
  const name = team?.TeamName ?? team?.name ?? '';
  return name.toLowerCase().includes(TEAM_IDENTIFIER);
}

function deriveMatchDate(match) {
  const raw = match.MatchDateTimeUTC ?? match.MatchDateTime;
  if (!raw) {
    return null;
  }

  const normalised = raw.replace(' ', 'T');
  const hasOffset = /[+-]\d{2}:?\d{2}$/.test(normalised) || normalised.endsWith('Z');
  const isoCandidate = hasOffset ? normalised : `${normalised}Z`;
  const parsed = new Date(isoCandidate);

  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function deriveMatchday(group) {
  if (!group) {
    return null;
  }
  if (Number.isFinite(group.GroupOrderID)) {
    return group.GroupOrderID;
  }

  const match = /(\d+)/.exec(group.GroupName ?? '');
  return match ? Number.parseInt(match[1], 10) : null;
}

function formatCity(location) {
  if (!location) {
    return '';
  }

  const values = [location.LocationCity, location.LocationCountry]
    .map((value) => (value ? String(value).trim() : ''))
    .filter(Boolean);

  return values.join(', ');
}

function updateUpdatedAt(elementId, isoString, source) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  if (!isoString) {
    element.hidden = true;
    element.textContent = '';
    return;
  }

  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) {
    element.hidden = true;
    element.textContent = '';
    return;
  }

  const timestamp = formatUpdatedAt(date);
  element.textContent = source === 'cache'
    ? `Letzter bekannter Stand: ${timestamp}`
    : `Aktualisiert: ${timestamp}`;
  element.hidden = false;
}

function formatUpdatedAt(date) {
  return `${date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })} ${date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  })} Uhr`;
}

function proxiedUrl(url) {
  const normalised = url.replace(/^https?:\/\//, '');
  return `${PROXY_PREFIX}${normalised}`;
}

function stripHtml(value) {
  const div = document.createElement('div');
  div.innerHTML = value;
  return div.textContent ?? '';
}

function getActiveFilter() {
  const activeButton = document.querySelector('.filter-button.active');
  return activeButton?.getAttribute('data-filter') ?? 'all';
}

function showScheduleFallbackMessage() {
  const container = document.getElementById('schedule-grid');
  if (!container) return;
  container.innerHTML = '<p class="loading">Es liegen aktuell keine veröffentlichten Spieltermine vor.</p>';
  setNextMatchMessage('Aktuell sind keine weiteren Spiele terminiert.');
}

function showScheduleErrorMessage() {
  const container = document.getElementById('schedule-grid');
  if (!container) return;
  container.innerHTML = '<p class="loading">Spielplan konnte nicht geladen werden. Bitte versuche es später erneut.</p>';
  setNextMatchMessage('Spielplan konnte nicht geladen werden. Bitte später erneut versuchen.');
}

function showNewsFallbackMessage() {
  const container = document.getElementById('news-list');
  if (!container) return;
  container.innerHTML = '<p class="loading">Der Verein hat noch keine aktuellen Meldungen veröffentlicht.</p>';
}

function showNewsErrorMessage() {
  const container = document.getElementById('news-list');
  if (!container) return;
  container.innerHTML = '<p class="loading">News konnten nicht geladen werden. Bitte später erneut versuchen.</p>';
}

function setNextMatchMessage(message) {
  const container = document.getElementById('next-match-card');
  if (!container) {
    return;
  }
  container.innerHTML = `<p class="loading">${message}</p>`;
}

function renderNextMatch(matches) {
  const container = document.getElementById('next-match-card');
  container.innerHTML = '';

  const upcoming = getNextMatch(matches);
  if (!upcoming) {
    container.innerHTML = '<p class="loading">Aktuell sind keine weiteren Spiele terminiert.</p>';
    return;
  }

  const matchDate = new Date(upcoming.date);
  const header = document.createElement('div');
  header.className = 'next-match-header';
  header.innerHTML = `
    <span class="matchday">${formatMatchdayLabel(upcoming)}</span>
    <span class="competition">${upcoming.competition}</span>
  `;

  const teams = document.createElement('div');
  teams.className = 'next-match-teams';
  teams.textContent = createMatchTitle(upcoming);

  const meta = document.createElement('div');
  meta.className = 'next-match-meta';
  meta.innerHTML = `
    <div>
      <strong>Datum</strong><br />${dateTimeFormat.format(matchDate)}
    </div>
    <div>
      <strong>Spielort</strong><br />${formatLocationText(upcoming)}
    </div>
    <div>
      <strong>Übertragung</strong><br />${formatBroadcastLabel(upcoming.broadcast)}
    </div>
  `;

  const countdown = document.createElement('div');
  countdown.id = 'countdown-display';
  countdown.className = 'countdown';
  countdown.setAttribute('role', 'timer');

  let notesElement;
  const trimmedNotes = upcoming.notes?.toString().trim();
  if (trimmedNotes) {
    notesElement = document.createElement('p');
    notesElement.className = 'notes';
    notesElement.textContent = trimmedNotes;
  }

  const actions = document.createElement('div');
  actions.className = 'action-row';

  const icsButton = document.createElement('button');
  icsButton.className = 'button';
  icsButton.type = 'button';
  icsButton.textContent = 'Kalender (.ics)';
  icsButton.addEventListener('click', () => downloadIcs(upcoming));

  actions.appendChild(icsButton);

  if (upcoming.ticketUrl) {
    const ticketLink = document.createElement('a');
    ticketLink.href = upcoming.ticketUrl;
    ticketLink.className = 'button secondary';
    ticketLink.target = '_blank';
    ticketLink.rel = 'noopener noreferrer';
    ticketLink.textContent = 'Tickets';
    actions.appendChild(ticketLink);
  }

  container.append(header, teams, meta);
  if (notesElement) {
    container.appendChild(notesElement);
  }
  container.append(countdown, actions);
  startCountdown(matchDate, countdown);
}

function getNextMatch(matches) {
  const now = Date.now();
  return matches
    .map((match) => ({ ...match, dateValue: new Date(match.date).getTime() }))
    .filter((match) => Number.isFinite(match.dateValue) && match.dateValue > now)
    .sort((a, b) => a.dateValue - b.dateValue)[0];
}

function startCountdown(targetDate, element) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  function updateCountdown() {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
      element.textContent = 'Anpfiff!';
      clearInterval(countdownInterval);
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    element.textContent = `${days} Tag${days !== 1 ? 'e' : ''} · ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function createMatchTitle(match) {
  return match.home ? `HC Erlangen vs. ${match.opponent}` : `${match.opponent} vs. HC Erlangen`;
}

function formatMatchdayLabel(match) {
  if (Number.isFinite(match.matchday)) {
    return `${match.matchday}. Spieltag`;
  }
  if (match.groupName) {
    return match.groupName;
  }
  return 'Spieltermin';
}

function formatLocationText(match) {
  const parts = [match.arena, match.city]
    .map((value) => (value ? String(value).trim() : ''))
    .filter(Boolean);

  if (!parts.length) {
    return 'Noch nicht bekannt';
  }

  return parts.join('<br />');
}

function formatBroadcastLabel(value) {
  const label = value ? String(value).trim() : '';
  return label || 'Noch nicht bekannt';
}

function renderSchedule(matches, filter) {
  const container = document.getElementById('schedule-grid');
  container.innerHTML = '';

  const filteredMatches = applyFilter(matches, filter);

  if (!filteredMatches.length) {
    container.innerHTML = '<p class="loading">Für diesen Filter sind derzeit keine veröffentlichten Spiele verfügbar.</p>';
    return;
  }

  filteredMatches
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((match) => {
      const card = document.createElement('article');
      card.className = `match-card ${match.home ? 'home' : 'away'}`;

      const header = document.createElement('header');
      header.innerHTML = `
        <h3>${createMatchTitle(match)}</h3>
        <span class="matchday">${formatMatchdayLabel(match)}</span>
      `;

      const info = document.createElement('div');
      info.className = 'match-info';
      const matchDate = new Date(match.date);
      info.innerHTML = `
        <div><strong>${dateFormat.format(matchDate)}</strong> · ${matchDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      })} Uhr</div>
        <div>${formatLocationText(match)}</div>
        <div>Übertragung: ${formatBroadcastLabel(match.broadcast)}</div>
      `;

      const trimmed = match.notes?.toString().trim();
      if (trimmed) {
        const notes = document.createElement('div');
        notes.className = 'notes';
        notes.textContent = trimmed;
        info.appendChild(notes);
      }

      const tags = document.createElement('div');
      tags.className = 'match-tags';
      const homeTag = document.createElement('span');
      homeTag.className = 'tag home';
      homeTag.textContent = 'Heim';
      const awayTag = document.createElement('span');
      awayTag.className = 'tag away';
      awayTag.textContent = 'Auswärts';
      tags.append(homeTag, awayTag);

      const actions = document.createElement('div');
      actions.className = 'action-row';

      const icsButton = document.createElement('button');
      icsButton.className = 'button';
      icsButton.type = 'button';
      icsButton.textContent = 'Kalender (.ics)';
      icsButton.addEventListener('click', () => downloadIcs(match));
      actions.appendChild(icsButton);

      if (match.ticketUrl) {
        const ticketLink = document.createElement('a');
        ticketLink.href = match.ticketUrl;
        ticketLink.className = 'button secondary';
        ticketLink.target = '_blank';
        ticketLink.rel = 'noopener noreferrer';
        ticketLink.textContent = 'Tickets';
        actions.appendChild(ticketLink);
      }

      card.append(header, info, tags, actions);
      container.appendChild(card);
    });
}

function applyFilter(matches, filter) {
  if (filter === 'home') {
    return matches.filter((match) => match.home);
  }
  if (filter === 'away') {
    return matches.filter((match) => !match.home);
  }
  return matches;
}

function bindFilterControls() {
  const filterButtons = document.querySelectorAll('.filter-button');
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      const filter = button.getAttribute('data-filter') ?? 'all';
      renderSchedule(cachedMatches, filter);
    });
  });
}

function renderNews(newsItems) {
  const container = document.getElementById('news-list');
  container.innerHTML = '';

  if (!newsItems.length) {
    container.innerHTML = '<p class="loading">Derzeit liegen keine Neuigkeiten vor.</p>';
    return;
  }

  newsItems
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((news) => {
      const item = document.createElement('article');
      item.className = 'news-item';

      const meta = document.createElement('div');
      meta.className = 'news-meta';
      const published = new Date(news.date);
      meta.textContent = `${published.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })} · ${news.category}`;

      const title = document.createElement('h3');
      title.textContent = news.title;

      const summary = document.createElement('p');
      summary.textContent = news.summary;

      const link = document.createElement('a');
      link.href = news.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'news-link';
      link.textContent = 'Mehr lesen';

      item.append(meta, title, summary, link);
      container.appendChild(item);
    });
}

function downloadIcs(match) {
  const startDate = new Date(match.date);
  if (!Number.isFinite(startDate.getTime())) {
    console.warn('Ungültiges Spieldatum für ICS-Export', match);
    return;
  }

  const durationMinutes = Number.isFinite(match.durationMinutes)
    ? match.durationMinutes
    : 110;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const summary = createMatchTitle(match);
  const descriptionParts = [
    match.competition,
    match.groupName,
    match.notes,
    match.broadcast ? `Live bei ${match.broadcast}` : undefined
  ].filter(Boolean);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HCE Fans App//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${match.id}@hce-fans.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText([match.arena, match.city].filter(Boolean).join(', '))}`,
    descriptionParts.length ? `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}` : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${match.id}.ics`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

function formatIcsDate(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}
