const API_KEY = '56b9ae0a0d68f267ca7bbe202fdcaaa8';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w780';
const ROW_CONFIG = [
  { key: 'trending', title: 'Trending Now', fetch: () => tmdb('/trending/movie/week') },
  { key: 'top_rated', title: 'Top Rated', fetch: () => tmdb('/movie/top_rated') },
  { key: 'new_releases', title: 'New Releases', fetch: () => tmdb('/discover/movie', { sort_by: 'release_date.desc', 'vote_count.gte': 50 }) }
];
const GENRE_ROWS = [
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 27, name: 'Horror' },
  { id: 18, name: 'Drama' },
  { id: 878, name: 'Sci-Fi' }
];

const tabs = document.querySelectorAll('.tab');
const rowsEl = document.getElementById('rows');
const heroBg = document.getElementById('heroBg');
const heroTitle = document.getElementById('heroTitle');
const heroTagline = document.getElementById('heroTagline');
const heroFav = document.getElementById('heroFav');
const heroPlay = document.getElementById('heroPlay');
const heroInfo = document.getElementById('heroInfo');
const toast = document.getElementById('toast');
const profileBtn = document.getElementById('profileBtn');
const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const searchClose = document.getElementById('searchClose');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const detailModal = document.getElementById('detailModal');
const modalClose = document.getElementById('modalClose');
const detailContent = document.getElementById('detailContent');
const profileModal = document.getElementById('profileModal');
const profileClose = document.getElementById('profileClose');
const clearListBtn = document.getElementById('clearListBtn');
const statFavorites = document.getElementById('statFavorites');
const statWatched = document.getElementById('statWatched');
const noResults = document.getElementById('noResults');
const logo = document.getElementById('logo');

let heroMovie = null;
let heroTrailer = null;
let currentSection = 'home';

function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  return fetch(url)
    .then(r => (r.ok ? r.json() : Promise.reject(r)))
    .catch(err => {
      console.error('TMDB error:', err);
      return { results: [] };
    });
}

function debounce(fn, wait = 420) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

function getFavs() {
  try {
    return JSON.parse(localStorage.getItem('ml_list') || '[]');
  } catch {
    return [];
  }
}

function saveFavs(list) {
  localStorage.setItem('ml_list', JSON.stringify(list));
  if (profileBtn) {
    gsap.fromTo(profileBtn, { scale: 1 }, { scale: 1.15, duration: 0.2, yoyo: true, repeat: 1 });
  }
  updateProfileStats();
}

function isFav(id) {
  return getFavs().some(f => f.id === id);
}

function toastShow(t) {
  if (!toast) return;
  toast.textContent = t;
  toast.style.opacity = 1;
  gsap.fromTo(toast, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.36, ease: 'power2.out' });
  setTimeout(() => {
    gsap.to(toast, { y: 24, opacity: 0, duration: 0.42, ease: 'power2.in' });
  }, 1400);
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildRow(title, items) {
  if (!rowsEl) return;
  const row = document.createElement('div');
  row.className = 'row';
  const h = document.createElement('div');
  h.className = 'row-title';
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'carousel';
  grid.dataset.key = title.toLowerCase().replace(/\s+/g, '-');

  items.forEach(item => {
    const c = document.createElement('article');
    c.className = 'card';
    const poster = item.backdrop_path || item.poster_path;
    c.innerHTML = `
      <div class="card-image">
        <img class="poster" src="${poster ? IMG + poster : ''}" alt="${escapeHtml(item.title || item.name)}" loading="lazy" />
        <div class="card-overlay">
          <button class="overlay-btn play-btn"><i class="fas fa-play"></i></button>
          <button class="overlay-btn info-btn"><i class="fas fa-info-circle"></i></button>
        </div>
      </div>
      <div class="meta">
        <div class="meta-top">
          <div class="title">${escapeHtml(item.title || item.name)}</div>
          <button class="heart-btn" data-id="${item.id}">
            <i class="${isFav(item.id) ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
        <div class="meta-bottom">
          <span class="score"><i class="fas fa-star"></i> ${item.vote_average ? item.vote_average.toFixed(1) : '-'}</span>
          <span class="year">${item.release_date ? new Date(item.release_date).getFullYear() : item.first_air_date ? new Date(item.first_air_date).getFullYear() : '-'}</span>
        </div>
      </div>`;

    const heartBtn = c.querySelector('.heart-btn');
    heartBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleCardFav(item, c);
    });

    const infoBtn = c.querySelector('.info-btn');
    infoBtn.addEventListener('click', e => {
      e.stopPropagation();
      showDetailModal(item);
    });

    const playBtn = c.querySelector('.play-btn');
    playBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const videos = await tmdb(`/${mediaType}/${item.id}/videos`);
      const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) {
        window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
      } else {
        toastShow('No trailer available');
      }
    });

    grid.appendChild(c);
  });

  row.appendChild(h);
  row.appendChild(grid);
  rowsEl.appendChild(row);
}

function toggleCardFav(item, card) {
  const id = item.id;
  const list = getFavs();
  const found = list.find(x => x.id === id);
  const heart = card.querySelector('.fa-heart');
  if (found) {
    saveFavs(list.filter(x => x.id !== id));
    heart.classList.replace('fas', 'far');
    toastShow('Removed from My List');
  } else {
    list.push({
      id,
      title: item.title || item.name,
      poster_path: item.poster_path || item.backdrop_path || '',
      backdrop_path: item.backdrop_path || item.poster_path || '',
      vote_average: item.vote_average || 0,
      release_date: item.release_date || item.first_air_date || '',
      overview: item.overview || ''
    });
    saveFavs(list);
    heart.classList.replace('far', 'fas');
    gsap.fromTo(heart, { scale: 0.8 }, { scale: 1.3, duration: 0.4, ease: 'back.out(3)' });
    toastShow('Added to My List');
  }
}

async function setHeroFromTrending() {
  const trending = await tmdb('/trending/movie/week');
  const m = trending.results?.[0];
  if (!m || !heroBg) return;
  heroMovie = m;
  heroBg.style.backgroundImage = m.backdrop_path ? `url(${IMG + m.backdrop_path})` : '';
  if (heroTitle) heroTitle.textContent = m.title || '';
  if (heroTagline) heroTagline.textContent = m.overview?.slice(0, 180) || '';

  updateHeroFavButton();

  const videos = await tmdb(`/movie/${m.id}/videos`);
  const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  heroTrailer = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

function updateHeroFavButton() {
  if (heroFav && heroMovie) {
    heroFav.dataset.id = heroMovie.id;
    const heart = heroFav.querySelector('.fa-heart');
    const btnText = heroFav.querySelector('.btn-text');
    if (heart) {
      if (isFav(heroMovie.id)) {
        heart.classList.add('fas');
        heart.classList.remove('far');
        if (btnText) btnText.textContent = 'Remove from List';
      } else {
        heart.classList.add('far');
        heart.classList.remove('fas');
        if (btnText) btnText.textContent = 'Add to List';
      }
    }
  }
}

async function buildHome() {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  if (noResults) noResults.hidden = true;
  await setHeroFromTrending();
  const results = await Promise.all([
    ...ROW_CONFIG.map(rc => rc.fetch().then(r => ({ title: rc.title, items: (r.results || []).slice(0, 18) }))),
    ...GENRE_ROWS.map(g => tmdb('/discover/movie', { with_genres: g.id }).then(r => ({ title: g.name, items: (r.results || []).slice(0, 18) })))
  ]);
  results.forEach(p => buildRow(p.title, p.items));
}

async function buildMovies() {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  if (noResults) noResults.hidden = true;
  await setHeroFromTrending();
  const results = await Promise.all([
    tmdb('/movie/popular').then(r => ({ title: 'Popular Movies', items: (r.results || []).slice(0, 18) })),
    tmdb('/movie/top_rated').then(r => ({ title: 'Top Rated Movies', items: (r.results || []).slice(0, 18) })),
    tmdb('/movie/upcoming').then(r => ({ title: 'Upcoming Movies', items: (r.results || []).slice(0, 18) })),
    ...GENRE_ROWS.map(g => tmdb('/discover/movie', { with_genres: g.id }).then(r => ({ title: g.name + ' Movies', items: (r.results || []).slice(0, 18) })))
  ]);
  results.forEach(p => buildRow(p.title, p.items));
}

async function buildTV() {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  if (noResults) noResults.hidden = true;
  const tvData = await tmdb('/trending/tv/week');
  const tvShow = tvData.results?.[0];
  if (tvShow && heroBg) {
    heroMovie = tvShow;
    heroBg.style.backgroundImage = tvShow.backdrop_path ? `url(${IMG + tvShow.backdrop_path})` : '';
    if (heroTitle) heroTitle.textContent = tvShow.name || '';
    if (heroTagline) heroTagline.textContent = tvShow.overview?.slice(0, 180) || '';
    
    updateHeroFavButton();
    
    const videos = await tmdb(`/tv/${tvShow.id}/videos`);
    const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    heroTrailer = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
  }

  const results = await Promise.all([
    tmdb('/tv/popular').then(r => ({ title: 'Popular TV Shows', items: (r.results || []).slice(0, 18) })),
    tmdb('/tv/top_rated').then(r => ({ title: 'Top Rated TV Shows', items: (r.results || []).slice(0, 18) })),
    tmdb('/trending/tv/week').then(r => ({ title: 'Trending TV Shows', items: (r.results || []).slice(0, 18) }))
  ]);
  results.forEach(p => buildRow(p.title, p.items));
}

async function buildMyList() {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  const favs = getFavs();
  
  if (favs.length === 0) {
    if (noResults) {
      noResults.textContent = 'Your list is empty. Add some movies to get started';
      noResults.hidden = false;
    }
    if (heroBg) heroBg.style.backgroundImage = '';
    if (heroTitle) heroTitle.textContent = 'My List';
    if (heroTagline) heroTagline.textContent = 'Save your favorite movies and TV shows here';
    heroMovie = null;
    heroTrailer = null;
    return;
  }

  if (noResults) noResults.hidden = true;
  
  const firstFav = favs[0];
  
  try {
    const mediaType = firstFav.title && !firstFav.name ? 'movie' : 'tv';
    const details = await tmdb(`/${mediaType}/${firstFav.id}`);
    
    if (details && details.id) {
      heroMovie = {
        ...details,
        ...firstFav
      };
      
      if (heroBg) {
        const bgImage = details.backdrop_path || firstFav.backdrop_path;
        heroBg.style.backgroundImage = bgImage ? `url(${IMG + bgImage})` : '';
      }
      if (heroTitle) heroTitle.textContent = details.title || details.name || firstFav.title;
      if (heroTagline) heroTagline.textContent = (details.overview || firstFav.overview || '').slice(0, 180);
      
      updateHeroFavButton();
      
      const videos = await tmdb(`/${mediaType}/${firstFav.id}/videos`);
      const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      heroTrailer = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
    } else {
      heroMovie = firstFav;
      if (heroBg) {
        heroBg.style.backgroundImage = firstFav.backdrop_path ? `url(${IMG + firstFav.backdrop_path})` : '';
      }
      if (heroTitle) heroTitle.textContent = firstFav.title;
      if (heroTagline) heroTagline.textContent = (firstFav.overview || '').slice(0, 180);
      updateHeroFavButton();
    }
  } catch (error) {
    console.error('Error loading hero from favorites:', error);
    heroMovie = firstFav;
    if (heroBg) {
      heroBg.style.backgroundImage = firstFav.backdrop_path ? `url(${IMG + firstFav.backdrop_path})` : '';
    }
    if (heroTitle) heroTitle.textContent = firstFav.title;
    if (heroTagline) heroTagline.textContent = (firstFav.overview || '').slice(0, 180);
    updateHeroFavButton();
  }

  buildRow('My Favorites', favs);
}

if (tabs.length) {
  tabs.forEach(t => t.addEventListener('click', async () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    currentSection = t.dataset.section;

    switch (currentSection) {
      case 'home':
        await buildHome();
        break;
      case 'movies':
        await buildMovies();
        break;
      case 'tv':
        await buildTV();
        break;
      case 'list':
        await buildMyList();
        break;
      default:
        await buildHome();
    }
  }));
}

if (heroPlay) {
  heroPlay.addEventListener('click', () => {
    if (heroTrailer) {
      window.open(heroTrailer, '_blank');
    } else {
      toastShow('No trailer available');
    }
  });
}

if (heroInfo) {
  heroInfo.addEventListener('click', () => {
    if (heroMovie) {
      showDetailModal(heroMovie);
    } else {
      toastShow('No information available');
    }
  });
}

if (heroFav) {
  heroFav.addEventListener('click', () => {
    if (!heroMovie) return;
    const list = getFavs();
    const found = list.find(x => x.id === heroMovie.id);
    const heart = heroFav.querySelector('.fa-heart');
    const btnText = heroFav.querySelector('.btn-text');
    
    if (found) {
      saveFavs(list.filter(x => x.id !== heroMovie.id));
      if (heart) {
        heart.classList.replace('fas', 'far');
      }
      if (btnText) btnText.textContent = 'Add to List';
      toastShow('Removed from My List');
      
      if (currentSection === 'list') {
        buildMyList();
      }
    } else {
      list.push({
        id: heroMovie.id,
        title: heroMovie.title || heroMovie.name,
        poster_path: heroMovie.poster_path || heroMovie.backdrop_path || '',
        backdrop_path: heroMovie.backdrop_path || heroMovie.poster_path || '',
        vote_average: heroMovie.vote_average || 0,
        release_date: heroMovie.release_date || heroMovie.first_air_date || '',
        overview: heroMovie.overview || ''
      });
      saveFavs(list);
      if (heart) {
        heart.classList.replace('far', 'fas');
        gsap.fromTo(heart, { scale: 0.8 }, { scale: 1.3, duration: 0.4, ease: 'back.out(3)' });
      }
      if (btnText) btnText.textContent = 'Remove from List';
      toastShow('Added to My List');
    }
  });
}

if (searchBtn && searchModal) {
  searchBtn.addEventListener('click', () => {
    searchModal.classList.add('open');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  });
}

if (searchClose && searchModal) {
  searchClose.addEventListener('click', () => {
    searchModal.classList.remove('open');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
  });
}

if (searchModal) {
  searchModal.addEventListener('click', e => {
    if (e.target === searchModal) {
      searchModal.classList.remove('open');
      if (searchInput) searchInput.value = '';
      if (searchResults) searchResults.innerHTML = '';
    }
  });
}

if (searchInput && searchResults) {
  const performSearch = debounce(async (query) => {
    if (!query.trim()) {
      searchResults.innerHTML = '';
      return;
    }

    const data = await tmdb('/search/multi', { query });
    const results = data.results || [];
    
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
      searchResults.innerHTML = '<p style="text-align:center;padding:20px;opacity:0.6;">No results found</p>';
      return;
    }

    results.slice(0, 18).forEach(item => {
      if (!item.poster_path && !item.backdrop_path) return;
      
      const card = document.createElement('article');
      card.className = 'card';
      const poster = item.backdrop_path || item.poster_path;
      card.innerHTML = `
        <div class="card-image">
          <img class="poster" src="${IMG + poster}" alt="${escapeHtml(item.title || item.name)}" loading="lazy" />
          <div class="card-overlay">
            <button class="overlay-btn play-btn"><i class="fas fa-play"></i></button>
            <button class="overlay-btn info-btn"><i class="fas fa-info-circle"></i></button>
          </div>
        </div>
        <div class="meta">
          <div class="meta-top">
            <div class="title">${escapeHtml(item.title || item.name)}</div>
            <button class="heart-btn" data-id="${item.id}">
              <i class="${isFav(item.id) ? 'fas' : 'far'} fa-heart"></i>
            </button>
          </div>
          <div class="meta-bottom">
            <span class="score"><i class="fas fa-star"></i> ${item.vote_average ? item.vote_average.toFixed(1) : '-'}</span>
            <span class="year">${item.release_date ? new Date(item.release_date).getFullYear() : item.first_air_date ? new Date(item.first_air_date).getFullYear() : '-'}</span>
          </div>
        </div>`;

      const heartBtn = card.querySelector('.heart-btn');
      heartBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleCardFav(item, card);
      });

      const infoBtn = card.querySelector('.info-btn');
      infoBtn.addEventListener('click', e => {
        e.stopPropagation();
        showDetailModal(item);
        searchModal.classList.remove('open');
        if (searchInput) searchInput.value = '';
        searchResults.innerHTML = '';
      });

      const playBtn = card.querySelector('.play-btn');
      playBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        const videos = await tmdb(`/${mediaType}/${item.id}/videos`);
        const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) {
          window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
        } else {
          toastShow('No trailer available');
        }
      });

      searchResults.appendChild(card);
    });
  }, 300);

  searchInput.addEventListener('input', e => {
    performSearch(e.target.value);
  });
}

if (modalClose && detailModal) {
  modalClose.addEventListener('click', () => {
    detailModal.classList.remove('open');
  });
}

if (detailModal) {
  detailModal.addEventListener('click', e => {
    if (e.target === detailModal) {
      detailModal.classList.remove('open');
    }
  });
}

async function showDetailModal(item) {
  if (!detailModal || !detailContent) return;

  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  const details = await tmdb(`/${mediaType}/${item.id}`);
  
  const backdrop = details.backdrop_path || details.poster_path;
  const title = details.title || details.name;
  const releaseDate = details.release_date || details.first_air_date || '';
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
  const runtime = details.runtime || details.episode_run_time?.[0] || '';
  const genres = details.genres?.map(g => g.name).join(', ') || '';

  const videos = await tmdb(`/${mediaType}/${item.id}/videos`);
  const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

  detailContent.innerHTML = `
    <div class="detail-hero" style="background-image: url('${backdrop ? IMG + backdrop : ''}')"></div>
    <div class="detail-body">
      <div class="detail-header">
        <div>
          <h2 class="detail-title">${escapeHtml(title)}</h2>
          <div class="detail-meta">
            ${year ? `<span><i class="fas fa-calendar"></i> ${year}</span>` : ''}
            ${runtime ? `<span><i class="fas fa-clock"></i> ${runtime} min</span>` : ''}
            ${details.vote_average ? `<span><i class="fas fa-star"></i> ${details.vote_average.toFixed(1)}</span>` : ''}
          </div>
        </div>
        <button class="detail-fav-btn ${isFav(item.id) ? 'active' : ''}" data-id="${item.id}">
          <i class="${isFav(item.id) ? 'fas' : 'far'} fa-heart"></i>
        </button>
      </div>
      
      ${genres ? `<div class="detail-genres">${genres.split(', ').map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}</div>` : ''}
      
      <p class="detail-overview">${escapeHtml(details.overview || 'No overview available.')}</p>
      
      ${trailerUrl ? `<button class="btn primary detail-trailer-btn" data-url="${trailerUrl}">
        <i class="fas fa-play"></i> Watch Trailer
      </button>` : ''}
      
      <div class="detail-stats">
        <div class="stat-item">
          <div class="stat-label">Rating</div>
          <div class="stat-value">${details.vote_average ? details.vote_average.toFixed(1) : '-'}/10</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Votes</div>
          <div class="stat-value">${details.vote_count ? details.vote_count.toLocaleString() : '-'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Popularity</div>
          <div class="stat-value">${details.popularity ? Math.round(details.popularity) : '-'}</div>
        </div>
        ${details.budget && details.budget > 0 ? `
        <div class="stat-item">
          <div class="stat-label">Budget</div>
          <div class="stat-value">$${(details.budget / 1000000).toFixed(0)}M</div>
        </div>` : ''}
        ${details.revenue && details.revenue > 0 ? `
        <div class="stat-item">
          <div class="stat-label">Revenue</div>
          <div class="stat-value">$${(details.revenue / 1000000).toFixed(0)}M</div>
        </div>` : ''}
      </div>
    </div>
  `;

  const detailFavBtn = detailContent.querySelector('.detail-fav-btn');
  if (detailFavBtn) {
    detailFavBtn.addEventListener('click', () => {
      const list = getFavs();
      const found = list.find(x => x.id === item.id);
      const heart = detailFavBtn.querySelector('.fa-heart');
      
      if (found) {
        saveFavs(list.filter(x => x.id !== item.id));
        heart.classList.replace('fas', 'far');
        detailFavBtn.classList.remove('active');
        toastShow('Removed from My List');
      } else {
        list.push({
          id: item.id,
          title: details.title || details.name,
          poster_path: details.poster_path || details.backdrop_path || '',
          backdrop_path: details.backdrop_path || details.poster_path || '',
          vote_average: details.vote_average || 0,
          release_date: details.release_date || details.first_air_date || '',
          overview: details.overview || ''
        });
        saveFavs(list);
        heart.classList.replace('far', 'fas');
        detailFavBtn.classList.add('active');
        gsap.fromTo(heart, { scale: 0.8 }, { scale: 1.3, duration: 0.4, ease: 'back.out(3)' });
        toastShow('Added to My List');
      }
    });
  }

  const trailerBtn = detailContent.querySelector('.detail-trailer-btn');
  if (trailerBtn) {
    trailerBtn.addEventListener('click', () => {
      const url = trailerBtn.dataset.url;
      if (url) window.open(url, '_blank');
    });
  }

  detailModal.classList.add('open');
}

if (profileBtn && profileModal) {
  profileBtn.addEventListener('click', () => {
    updateProfileStats();
    profileModal.classList.add('open');
  });
}

if (profileClose && profileModal) {
  profileClose.addEventListener('click', () => {
    profileModal.classList.remove('open');
  });
}

if (profileModal) {
  profileModal.addEventListener('click', e => {
    if (e.target === profileModal) {
      profileModal.classList.remove('open');
    }
  });
}

if (clearListBtn) {
  clearListBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire list?')) {
      localStorage.setItem('ml_list', JSON.stringify([]));
      updateProfileStats();
      toastShow('List cleared');
      profileModal.classList.remove('open');
      if (currentSection === 'list') {
        buildMyList();
      }
    }
  });
}

function updateProfileStats() {
  const favs = getFavs();
  if (statFavorites) statFavorites.textContent = favs.length;
  if (statWatched) statWatched.textContent = '0';
}

if (logo) {
  logo.addEventListener('click', async () => {
    tabs.forEach(x => x.classList.remove('active'));
    tabs[0]?.classList.add('active');
    currentSection = 'home';
    await buildHome();
  });
}

async function init() {
  console.log("Initializing Cinema App...");
  await buildHome();
  updateProfileStats();
  gsap.fromTo('.logo', 
    { scale: 0, rotation: 0 },
    { scale: 1, rotation: 360, duration: 0.8, ease: 'back.out(1.7)', delay: 0.2 }
  );
}

init();