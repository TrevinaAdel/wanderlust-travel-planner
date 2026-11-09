
const TICKETMASTER_KEY = 'YOUR_TICKETMASTER_API_KEY';
const views = {
  'dashboard': { path: '/', title: 'Dashboard', subtitle: 'Welcome back! Ready to plan your next adventure?' },
  'holidays': { path: '/holidays', title: 'Holidays', subtitle: 'Explore public holidays around the world', needs: 'country', box: '#holidays-content' },
  'events': { path: '/events', title: 'Events', subtitle: 'Find concerts, sports, and entertainment', needs: 'city', box: '#events-content' },
  'weather': { path: '/weather', title: 'Weather', subtitle: 'Check forecasts for any destination', needs: 'city', box: '#weather-content' },
  'long-weekends': { path: '/long-weekends', title: 'Long Weekends', subtitle: 'Find the perfect mini-trip opportunities', needs: 'country', box: '#lw-content' },
  'currency': { path: '/currency', title: 'Currency', subtitle: 'Convert currencies with live exchange rates' },
  'sun-times': { path: '/sun-times', title: 'Sun Times', subtitle: 'Check sunrise and sunset times worldwide', needs: 'city', box: '#sun-times-content' },
  'my-plans': { path: '/plans', title: 'My Plans', subtitle: 'Your saved holidays and events', box: '#plans-content' }
};
 
const planTypes = { holiday: { icon: 'calendar-check', name: 'Holiday' },
  event: { icon: 'ticket', name: 'Event' },
  longweekend: { icon: 'umbrella-beach', name: 'Long Weekend' } };
 
const currencyFlags = { USD: 'us', EUR: 'eu', GBP: 'gb', EGP: 'eg', AED: 'ae', SAR: 'sa', JPY: 'jp', CAD: 'ca', INR: 'in' };
const loadingHtml = '<div class="country-info-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading...</span></div>';
let selection = JSON.parse(localStorage.getItem('wanderlust-selection')) || {}; // البلد والمدينة والسنة
let countries = [];          
let currentView = 'dashboard';
let currentFilter = 'all';   
let shownItems = {};         
let countryTimezone = '';    
let currencyRates = null;    
 
class Api {
  static async getJson(url, options) { const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error('Request failed (' + response.status + ')');
}
    return response.json();
  }
 
  static getCountries() {
    return Api.getJson('https://date.nager.at/api/v3/AvailableCountries');
  }
 
  static async getCountryInfo(code) {
    const data = await Api.getJson('https://restcountries.com/v3.1/alpha/' + code);
    return data[0];
  }
 
  static async getCities(countryName) {
    const data = await Api.getJson('https://countriesnow.space/api/v0.1/countries/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: countryName })
    });
    return data.data || [];
  }
 
  static getHolidays(year, code) {
    return Api.getJson('https://date.nager.at/api/v3/PublicHolidays/' + year + '/' + code); }
 
  static getLongWeekends(year, code) {
    return Api.getJson('https://date.nager.at/api/v3/LongWeekend/' + year + '/' + code); }
 
  static async findCity(city, code) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&countryCode=' + code;
    const data = await Api.getJson(url);
    if (!data.results) {
      throw new Error("Couldn't find " + city + ' on the map.');
    }
    return data.results[0];
  }
 
  static getWeather(lat, lon) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
      '&timezone=auto&forecast_days=7';
    return Api.getJson(url);
  }
 
  static async getSunTimes(lat, lon, date) {
    const url = 'https://api.sunrise-sunset.org/json?lat=' + lat + '&lng=' + lon + '&date=' + date + '&formatted=0';
    const data = await Api.getJson(url);
    return data.results;
  }
 
  static getEvents(city, code) {
    const url = 'https://app.ticketmaster.com/discovery/v2/events.json?apikey=' + TICKETMASTER_KEY +
      '&city=' + encodeURIComponent(city) + '&countryCode=' + code + '&size=12&sort=date,asc';
    return Api.getJson(url);
  }
 
  static getRates(baseCurrency) {
    return Api.getJson('https://open.er-api.com/v6/latest/' + baseCurrency);
  }
}
 
class PlansStorage {
  constructor() {
    this.key = 'wanderlust-plans';
  }
 
  getAll() {
    const text = localStorage.getItem(this.key);
    return text ? JSON.parse(text) : [];
  }
 
  saveAll(plans) {
    localStorage.setItem(this.key, JSON.stringify(plans));
  }
 
  isSaved(id) {
    return this.getAll().some(function (plan) { return plan.id === id; });
  }
 
  toggle(plan) {
    const plans = this.getAll();
    const index = plans.findIndex(function (p) { return p.id === plan.id; });
    if (index === -1) {
      plans.push(plan);
      this.saveAll(plans);
      return true;
    }
    plans.splice(index, 1);
    this.saveAll(plans);
    return false;
  }
 
  remove(id) {
    const plans = this.getAll().filter(function (plan) { return plan.id !== id; });
    this.saveAll(plans);
  }
 
  clear() {
    this.saveAll([]);
  }
}
 
class Router {
  constructor(onChange) {
    this.onChange = onChange;
    window.addEventListener('popstate', () => {
      this.onChange(this.getViewFromUrl());
    });
  }
 
  getViewFromUrl() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    for (const name in views) {
      if (views[name].path === path) {
        return name;
      }
    }
    return 'dashboard';
  }
 
  goTo(name) {
    try {
      history.pushState({}, '', views[name].path);
    } catch (error) {
    }
    this.onChange(name);
  }
}
 
const plansStorage = new PlansStorage();
const router = new Router(showView);
 
 
function getEl(id) {
  return document.getElementById(id);
}
 
function escapeHtml(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
 
function flagUrl(code, width) {
  return 'https://flagcdn.com/w' + width + '/' + code.toLowerCase() + '.png';
}
 
function flagEmoji(code) {
  const letters = code.toUpperCase().split('');
  return String.fromCodePoint(...letters.map(function (l) { return 127397 + l.charCodeAt(0); }));
}
 
function makeDate(dateText) {
  return new Date(dateText + 'T00:00:00');
}
 
function formatDate(dateText, options) {
  return makeDate(dateText).toLocaleDateString('en-US', options);
}
 
function formatNumber(number, digits) {
  return Number(number).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
 
function getCountryName(code) {
  const country = countries.find(function (c) { return c.countryCode === code; });
  return country ? country.name : code;
}
 
function currencyName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || code;
  } catch (error) {
    return code;
  }
}
 
function setContent(viewName, html) {
  if (currentView === viewName) {
    document.querySelector(views[viewName].box).innerHTML = html;
  }
}
 
function emptyStateHtml(icon, title, text, withButton) {
  let button = '';
  if (withButton) {
    button = '<button class="btn-primary" data-view="dashboard"><i class="fa-solid fa-globe"></i> Go to Dashboard</button>';
  }
  return '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-' + icon + '"></i></div>' +
    '<h3>' + title + '</h3><p>' + text + '</p>' + button + '</div>';
}
 
function showToast(message, type) {
  type = type || 'success';
  const icons = { success: 'circle-check', error: 'circle-exclamation', info: 'circle-info' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<i class="fa-solid fa-' + icons[type] + '"></i><span>' + escapeHtml(message) + '</span>' +
    '<button class="toast-close"><i class="fa-solid fa-xmark"></i></button>';
  toast.querySelector('.toast-close').onclick = function () { toast.remove(); };
  getEl('toast-container').appendChild(toast);
  setTimeout(function () { toast.remove(); }, 3000);
}
 
function makeSaveButton(plan, cssClass, showText) {
  shownItems[plan.id] = plan; 
  const saved = plansStorage.isSaved(plan.id);
  const text = showText ? (saved ? ' Saved' : ' Save') : '';
  return '<button class="' + cssClass + (saved ? ' saved' : '') + '" data-save="' + escapeHtml(plan.id) + '" data-text="' + showText + '">' +
    '<i class="fa-' + (saved ? 'solid' : 'regular') + ' fa-heart"></i>' + text + '</button>';
}
 
function updateSaveButton(button, saved) {
  button.classList.toggle('saved', saved);
  const text = button.dataset.text === 'true' ? (saved ? ' Saved' : ' Save') : '';
  button.innerHTML = '<i class="fa-' + (saved ? 'solid' : 'regular') + ' fa-heart"></i>' + text;
}
 
function updatePlansCounts() {
  const plans = plansStorage.getAll();
  getEl('stat-saved').textContent = plans.length;
  getEl('plans-count').textContent = plans.length;
  getEl('plans-count').classList.toggle('hidden', plans.length === 0);
  getEl('filter-all-count').textContent = plans.length;
  getEl('filter-holiday-count').textContent = plans.filter(function (p) { return p.type === 'holiday'; }).length;
  getEl('filter-event-count').textContent = plans.filter(function (p) { return p.type === 'event'; }).length;
  getEl('filter-lw-count').textContent = plans.filter(function (p) { return p.type === 'longweekend'; }).length;
}
 
function updateHeaderClock() {
  getEl('current-datetime').textContent = new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
 
function updateCountryClock() {
  const clock = getEl('country-local-time');
  if (!clock) return;
  const match = /UTC([+-])(\d\d):?(\d\d)?/.exec(countryTimezone);
  let offsetMinutes = 0;
  if (match) {
    offsetMinutes = (+match[2] * 60 + +(match[3] || 0)) * (match[1] === '-' ? -1 : 1);
  }
  const localTime = new Date(Date.now() + offsetMinutes * 60000);
  clock.textContent = localTime.toLocaleTimeString('en-US', { timeZone: 'UTC' });
}
 
 
async function showView(name) {
  currentView = name;
  const view = views[name];
 
  getEl('page-title').textContent = view.title;
  getEl('page-subtitle').textContent = view.subtitle;
  document.title = view.title + ' - Wanderlust';
 
  document.querySelectorAll('.view').forEach(function (section) {
    section.classList.toggle('active', section.id === name + '-view');
  });
  document.querySelectorAll('.nav-item').forEach(function (link) {
    link.classList.toggle('active', link.dataset.view === name);
  });
  closeMobileMenu();
  window.scrollTo(0, 0);
 
  if (view.needs && !selection[view.needs]) {
    if (view.needs === 'city') {
      setContent(name, emptyStateHtml('location-dot', 'No City Selected', 'Select a country and city from the dashboard to continue.', true));
    } else {
      setContent(name, emptyStateHtml('earth-americas', 'No Country Selected', 'Select a country from the dashboard to continue.', true));
    }
    return;
  }
 
  try {
    if (name === 'holidays') await renderHolidays();
    if (name === 'events') await renderEvents();
    if (name === 'weather') await renderWeather();
    if (name === 'long-weekends') await renderLongWeekends();
    if (name === 'currency') await renderCurrency();
    if (name === 'sun-times') await renderSunTimes();
    if (name === 'my-plans') renderMyPlans();
  } catch (error) {
    setContent(name, emptyStateHtml('triangle-exclamation', 'Something went wrong', escapeHtml(error.message), false));
  }
}
 
function closeMobileMenu() {
  getEl('sidebar').classList.remove('open');
  getEl('sidebar-overlay').classList.remove('active');
}
 
 
async function setupDashboard() {
  try {
    countries = await Api.getCountries();
  } catch (error) {
    showToast('Could not load the countries list', 'error');
  }
 
  let countryOptions = '<option value="">Select Country</option>';
  countries.forEach(function (country) {
    countryOptions += '<option value="' + country.countryCode + '">' + flagEmoji(country.countryCode) + ' ' + escapeHtml(country.name) + '</option>';
  });
  getEl('global-country').innerHTML = countryOptions;
 
  const thisYear = new Date().getFullYear();
  let yearOptions = '';
  for (let year = thisYear - 1; year <= thisYear + 2; year++) {
    yearOptions += '<option value="' + year + '">' + year + '</option>';
  }
  getEl('global-year').innerHTML = yearOptions;
  getEl('global-year').value = selection.year || thisYear;
 
  if (countries.length > 0) {
    getEl('stat-countries').textContent = Math.floor(countries.length / 10) * 10 + '+';
  }
  getEl('stat-holidays').textContent = '—';
  getEl('global-city').innerHTML = '<option value="">Select City</option>';
 
  if (selection.country) {
    getEl('global-country').value = selection.country;
    await loadCities(selection.country);
    getEl('global-city').value = selection.city || '';
    loadCountryInfo();
  }
  updateSelectionDisplay();
}
 
async function loadCities(code) {
  const citySelect = getEl('global-city');
  citySelect.innerHTML = '<option value="">Loading cities...</option>';
 
  let cities = [];
  try {
    cities = await Api.getCities(getCountryName(code));
  } catch (error) {
    cities = [];
  }
  if (cities.length === 0) {
    try {
      const info = await Api.getCountryInfo(code);
      cities = info.capital || [];
    } catch (error) {
      cities = [];
    }
  }
 
  cities.sort();
  let options = '<option value="">Select City</option>';
  cities.forEach(function (city) {
    options += '<option>' + escapeHtml(city) + '</option>';
  });
  citySelect.innerHTML = options;
}
 
function updateSelectionDisplay() {
  const hasCountry = !!selection.country;
  getEl('selected-destination').classList.toggle('hidden', !hasCountry);
 
  if (hasCountry) {
    getEl('selected-country-flag').src = flagUrl(selection.country, 80);
    getEl('selected-country-name').textContent = selection.countryName;
    getEl('selected-city-name').textContent = selection.city ? '• ' + selection.city : '';
  } else {
    getEl('dashboard-country-info').innerHTML =
      '<div class="country-info-placeholder"><div class="placeholder-icon"><i class="fa-solid fa-globe"></i></div>' +
      '<p>Select a country above and press Explore to see its details.</p></div>';
  }
 
  document.querySelectorAll('.view-header-selection').forEach(function (box) {
    const viewName = box.closest('.view').id.replace('-view', '');
    if (!hasCountry) {
      box.innerHTML = '<div class="no-selection-message"><i class="fa-solid fa-circle-info"></i><span>Select a country from the dashboard</span></div>';
      return;
    }
    let extra = '<span class="selection-year">' + selection.year + '</span>';
    if (views[viewName].needs === 'city') {
      extra = '<span class="selection-city">' + escapeHtml(selection.city) + '</span>';
    }
    box.innerHTML = '<div class="current-selection-badge"><img src="' + flagUrl(selection.country, 40) + '" alt="" class="selection-flag">' +
      '<span>' + escapeHtml(selection.countryName) + '</span>' + extra + '</div>';
  });
}
 
async function onExplore() {
  const code = getEl('global-country').value;
  if (!code) {
    Swal.fire({ icon: 'info', title: 'Pick a country first', text: 'Choose a destination, then press Explore.', confirmButtonColor: '#084887' });
    return;
  }
  selection = {
    country: code,
    countryName: getCountryName(code),
    city: getEl('global-city').value,
    year: Number(getEl('global-year').value)
  };
  localStorage.setItem('wanderlust-selection', JSON.stringify(selection));
  updateSelectionDisplay();
  await loadCountryInfo();
  showToast('Exploring ' + selection.countryName, 'info');
}
 
function onClearSelection() {
  selection = { year: selection.year };
  localStorage.setItem('wanderlust-selection', JSON.stringify(selection));
  getEl('global-country').value = '';
  getEl('global-city').innerHTML = '<option value="">Select City</option>';
  getEl('stat-holidays').textContent = '—';
  updateSelectionDisplay();
}
 
async function loadCountryInfo() {
  const box = getEl('dashboard-country-info');
  box.innerHTML = '<div class="country-info-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading country information...</span></div>';
 
  try {
    const country = await Api.getCountryInfo(selection.country);
    const holidays = await Api.getHolidays(selection.year, selection.country);
 
    getEl('stat-holidays').textContent = holidays.length;
    countryTimezone = country.timezones ? country.timezones[0] : 'UTC+00:00';
 
    const capital = country.capital ? country.capital[0] : '—';
    const continent = country.continents ? country.continents[0] : country.region;
    let callingCode = '—';
    if (country.idd && country.idd.root) {
      callingCode = country.idd.root + (country.idd.suffixes && country.idd.suffixes.length === 1 ? country.idd.suffixes[0] : '');
    }
    const drivingSide = country.car ? capitalize(country.car.side) : '—';
    const weekStart = capitalize(country.startOfWeek);
    const currencies = Object.keys(country.currencies || {}).map(function (code) {
      return country.currencies[code].name + ' (' + code + ' ' + (country.currencies[code].symbol || '') + ')';
    });
    const languages = Object.values(country.languages || {});
    const neighbors = country.borders || [];
 
    box.innerHTML =
      '<div class="dashboard-country-header"><img src="' + country.flags.png + '" alt="" class="dashboard-country-flag">' +
        '<div class="dashboard-country-title"><h3>' + escapeHtml(country.name.common) + '</h3>' +
        '<p class="official-name">' + escapeHtml(country.name.official) + '</p>' +
        '<span class="region"><i class="fa-solid fa-location-dot"></i> ' + escapeHtml(country.region) + ' • ' + escapeHtml(country.subregion || country.region) + '</span></div></div>' +
      '<div class="dashboard-local-time"><div class="local-time-display"><i class="fa-solid fa-clock"></i>' +
        '<span class="local-time-value" id="country-local-time"></span><span class="local-time-zone">' + escapeHtml(countryTimezone) + '</span></div></div>' +
      '<div class="dashboard-country-grid">' +
        makeDetail('building-columns', 'Capital', capital) +
        makeDetail('users', 'Population', country.population.toLocaleString()) +
        makeDetail('ruler-combined', 'Area', country.area.toLocaleString() + ' km²') +
        makeDetail('globe', 'Continent', continent) +
        makeDetail('phone', 'Calling Code', callingCode) +
        makeDetail('car', 'Driving Side', drivingSide) +
        makeDetail('calendar-week', 'Week Starts', weekStart) + '</div>' +
      '<div class="dashboard-country-extras">' +
        makeExtra('coins', 'Currency', currencies, '') +
        makeExtra('language', 'Languages', languages, '') +
        makeExtra('map-location-dot', 'Neighbors', neighbors, 'border-tag') + '</div>' +
      '<div class="dashboard-country-actions"><a href="' + country.maps.googleMaps + '" target="_blank" rel="noopener" class="btn-map-link">' +
        '<i class="fa-solid fa-map"></i> View on Google Maps</a></div>';
 
    updateCountryClock();
  } catch (error) {
    box.innerHTML = '<div class="country-info-placeholder"><div class="placeholder-icon error"><i class="fa-solid fa-triangle-exclamation"></i></div><p>' + escapeHtml(error.message) + '</p></div>';
  }
}
 
function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
}
 
function makeDetail(icon, label, value) {
  return '<div class="dashboard-country-detail"><i class="fa-solid fa-' + icon + '"></i>' +
    '<span class="label">' + label + '</span><span class="value">' + escapeHtml(value) + '</span></div>';
}
 
function makeExtra(icon, title, items, tagClass) {
  let tags = '<span class="extra-tag">None</span>';
  if (items.length > 0) {
    tags = items.map(function (item) { return '<span class="extra-tag ' + tagClass + '">' + escapeHtml(item) + '</span>'; }).join('');
  }
  return '<div class="dashboard-country-extra"><h4><i class="fa-solid fa-' + icon + '"></i> ' + title + '</h4><div class="extra-tags">' + tags + '</div></div>';
}
 
 
async function renderHolidays() {
  setContent('holidays', loadingHtml);
  const holidays = await Api.getHolidays(selection.year, selection.country);
 
  let html = '';
  holidays.forEach(function (holiday) {
    const plan = {
      id: 'holiday|' + selection.country + '|' + holiday.date,
      type: 'holiday',
      title: holiday.localName || holiday.name,
      date: holiday.date,
      place: selection.countryName
    };
    const holidayType = holiday.types ? holiday.types[0] : 'Public';
    html += '<div class="holiday-card">' +
      '<div class="holiday-card-header"><div class="holiday-date-box"><span class="day">' + makeDate(holiday.date).getDate() + '</span>' +
      '<span class="month">' + formatDate(holiday.date, { month: 'short' }) + '</span></div>' +
      makeSaveButton(plan, 'holiday-action-btn', false) + '</div>' +
      '<h3>' + escapeHtml(holiday.localName) + '</h3><p class="holiday-name">' + escapeHtml(holiday.name) + '</p>' +
      '<div class="holiday-card-footer"><span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ' + formatDate(holiday.date, { weekday: 'long' }) + '</span>' +
      '<span class="holiday-type-badge">' + escapeHtml(holidayType) + '</span></div></div>';
  });
 
  if (html === '') {
    html = emptyStateHtml('calendar-xmark', 'No holidays found', 'Nothing listed for ' + escapeHtml(selection.countryName) + ' in ' + selection.year + '.', false);
  }
  setContent('holidays', html);
}
 
async function renderLongWeekends() {
  setContent('long-weekends', loadingHtml);
  const weekends = await Api.getLongWeekends(selection.year, selection.country);
 
  let html = '';
  weekends.forEach(function (weekend, index) {
    const dateText = formatDate(weekend.startDate, { month: 'short', day: 'numeric' }) + ' - ' +
      formatDate(weekend.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
    const plan = {
      id: 'longweekend|' + selection.country + '|' + weekend.startDate,
      type: 'longweekend',
      title: weekend.dayCount + '-day long weekend',
      date: dateText,
      place: selection.countryName
    };
 
    let daysHtml = '';
    const day = makeDate(weekend.startDate);
    const lastDay = makeDate(weekend.endDate);
    while (day <= lastDay) {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      daysHtml += '<div class="lw-day' + (isWeekend ? ' weekend' : '') + '"><span class="name">' +
        day.toLocaleDateString('en-US', { weekday: 'short' }) + '</span><span class="num">' + day.getDate() + '</span></div>';
      day.setDate(day.getDate() + 1);
    }
 
    let infoBox = '<div class="lw-info-box success"><i class="fa-solid fa-check-circle"></i> No extra days off needed!</div>';
    if (weekend.needBridgeDay) {
      infoBox = '<div class="lw-info-box warning"><i class="fa-solid fa-info-circle"></i> Requires taking a bridge day off</div>';
    }
 
    html += '<div class="lw-card"><div class="lw-card-header"><span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ' + weekend.dayCount + ' Days</span>' +
      makeSaveButton(plan, 'holiday-action-btn', false) + '</div>' +
      '<h3>Long Weekend #' + (index + 1) + '</h3>' +
      '<div class="lw-dates"><i class="fa-regular fa-calendar"></i> ' + dateText + '</div>' +
      infoBox + '<div class="lw-days-visual">' + daysHtml + '</div></div>';
  });
 
  if (html === '') {
    html = emptyStateHtml('umbrella-beach', 'No long weekends', 'Nothing found for ' + escapeHtml(selection.countryName) + ' in ' + selection.year + '.', false);
  }
  setContent('long-weekends', html);
}
 
async function renderEvents() {
  if (TICKETMASTER_KEY.startsWith('YOUR')) {
    throw new Error('Add your Ticketmaster API key to TICKETMASTER_KEY at the top of main.js.');
  }
  setContent('events', loadingHtml);
  const data = await Api.getEvents(selection.city, selection.country);
  const events = data._embedded ? data._embedded.events : [];
  const categories = { 'Music': 'Music', 'Sports': 'Sports', 'Arts & Theatre': 'Arts' };
 
  let html = '';
  events.forEach(function (event) {
    const venue = event._embedded && event._embedded.venues ? event._embedded.venues[0].name : selection.city;
    const image = event.images && event.images.length > 0 ? event.images[0].url : '';
    const segment = event.classifications && event.classifications[0] ? event.classifications[0].segment.name : '';
    let dateText = formatDate(event.dates.start.localDate, { month: 'short', day: 'numeric', year: 'numeric' });
    if (event.dates.start.localTime) {
      dateText += ' at ' + event.dates.start.localTime.slice(0, 5);
    }
    const plan = { id: 'event|' + event.id, type: 'event', title: event.name, date: dateText, place: venue + ', ' + selection.city };
 
    html += '<div class="event-card"><div class="event-card-image"><img src="' + image + '" alt="">' +
      '<span class="event-card-category">' + (categories[segment] || 'Other') + '</span>' +
      makeSaveButton(plan, 'event-card-save', false) + '</div>' +
      '<div class="event-card-body"><h3>' + escapeHtml(event.name) + '</h3>' +
      '<div class="event-card-info"><div><i class="fa-regular fa-calendar"></i>' + dateText + '</div>' +
      '<div><i class="fa-solid fa-location-dot"></i>' + escapeHtml(plan.place) + '</div></div>' +
      '<div class="event-card-footer">' + makeSaveButton(plan, 'btn-event', true) +
      '<a href="' + escapeHtml(event.url) + '" target="_blank" rel="noopener" class="btn-buy-ticket"><i class="fa-solid fa-ticket"></i> Buy Tickets</a></div></div></div>';
  });
 
  if (html === '') {
    html = emptyStateHtml('ticket', 'No events found', 'Nothing listed for ' + escapeHtml(selection.city) + ' right now.', false);
  }
  setContent('events', html);
}
 function getWeatherInfo(code) {
  if (code === 0) return { text: 'Clear sky', icon: 'sun', theme: 'sunny' };
  if (code <= 2) return { text: 'Partly cloudy', icon: 'cloud-sun', theme: 'sunny' };
  if (code === 3) return { text: 'Overcast', icon: 'cloud', theme: 'cloudy' };
  if (code <= 48) return { text: 'Fog', icon: 'smog', theme: 'foggy' };
  if (code <= 67) return { text: 'Rain', icon: 'cloud-rain', theme: 'rainy' };
  if (code <= 77) return { text: 'Snow', icon: 'snowflake', theme: 'snowy' };
  if (code <= 82) return { text: 'Rain showers', icon: 'cloud-showers-heavy', theme: 'rainy' };
  if (code <= 86) return { text: 'Snow showers', icon: 'snowflake', theme: 'snowy' };
  return { text: 'Thunderstorm', icon: 'cloud-bolt', theme: 'stormy' };
}
 
function makeWeatherDetail(cssClass, icon, label, value) {
  return '<div class="weather-detail-card"><div class="detail-icon ' + cssClass + '"><i class="fa-solid fa-' + icon + '"></i></div>' +
    '<div class="detail-info"><span class="detail-label">' + label + '</span><span class="detail-value">' + value + '</span></div></div>';
}
 
async function renderWeather() {
  setContent('weather', loadingHtml);
  const place = await Api.findCity(selection.city, selection.country);
  const weather = await Api.getWeather(place.latitude, place.longitude);
  const now = weather.current;
  const daily = weather.daily;
  const info = getWeatherInfo(now.weather_code);
 
  const currentHour = now.time.slice(0, 13) + ':00';
  let startIndex = weather.hourly.time.indexOf(currentHour);
  if (startIndex === -1) startIndex = 0;
 
  let hourlyHtml = '';
  for (let i = startIndex; i < startIndex + 12; i++) {
    const hour = Number(weather.hourly.time[i].slice(11, 13));
    const label = i === startIndex ? 'Now' : (hour % 12 || 12) + (hour < 12 ? ' AM' : ' PM');
    hourlyHtml += '<div class="hourly-item' + (i === startIndex ? ' now' : '') + '"><span class="hourly-time">' + label + '</span>' +
      '<div class="hourly-icon"><i class="fa-solid fa-' + getWeatherInfo(weather.hourly.weather_code[i]).icon + '"></i></div>' +
      '<span class="hourly-temp">' + Math.round(weather.hourly.temperature_2m[i]) + '°</span></div>';
  }
 
  let daysHtml = '';
  for (let i = 0; i < daily.time.length; i++) {
    const rain = daily.precipitation_probability_max[i];
    const rainHtml = rain >= 10 ? '<i class="fa-solid fa-droplet"></i><span>' + rain + '%</span>' : '';
    daysHtml += '<div class="forecast-day' + (i === 0 ? ' today' : '') + '">' +
      '<div class="forecast-day-name"><span class="day-label">' + (i === 0 ? 'Today' : formatDate(daily.time[i], { weekday: 'short' })) + '</span>' +
      '<span class="day-date">' + formatDate(daily.time[i], { day: 'numeric', month: 'short' }) + '</span></div>' +
      '<div class="forecast-icon"><i class="fa-solid fa-' + getWeatherInfo(daily.weather_code[i]).icon + '"></i></div>' +
      '<div class="forecast-temps"><span class="temp-max">' + Math.round(daily.temperature_2m_max[i]) + '°</span><span class="temp-min">' + Math.round(daily.temperature_2m_min[i]) + '°</span></div>' +
      '<div class="forecast-precip">' + rainHtml + '</div></div>';
  }
 
  const todayText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
 
  setContent('weather',
    '<div class="weather-hero-card weather-' + info.theme + '"><div class="weather-hero-bg"></div><div class="weather-hero-content">' +
      '<div class="weather-location"><i class="fa-solid fa-location-dot"></i><span>' + escapeHtml(selection.city) + '</span><span class="weather-time">' + todayText + '</span></div>' +
      '<div class="weather-hero-main"><div class="weather-hero-left"><div class="weather-hero-icon"><i class="fa-solid fa-' + info.icon + '"></i></div>' +
        '<div class="weather-hero-temp"><span class="temp-value">' + Math.round(now.temperature_2m) + '</span><span class="temp-unit">°C</span></div></div>' +
      '<div class="weather-hero-right"><div class="weather-condition">' + info.text + '</div>' +
        '<div class="weather-feels">Feels like ' + Math.round(now.apparent_temperature) + '°C</div>' +
        '<div class="weather-high-low"><span class="high"><i class="fa-solid fa-arrow-up"></i> ' + Math.round(daily.temperature_2m_max[0]) + '°</span>' +
        '<span class="low"><i class="fa-solid fa-arrow-down"></i> ' + Math.round(daily.temperature_2m_min[0]) + '°</span></div></div></div></div></div>' +
    '<div class="weather-details-grid">' +
      makeWeatherDetail('humidity', 'droplet', 'Humidity', now.relative_humidity_2m + '%') +
      makeWeatherDetail('wind', 'wind', 'Wind', now.wind_speed_10m + ' km/h') +
      makeWeatherDetail('uv', 'sun', 'UV Index', Math.round(daily.uv_index_max[0])) +
      makeWeatherDetail('precip', 'cloud-rain', 'Precipitation', (daily.precipitation_probability_max[0] || 0) + '%') + '</div>' +
    '<div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-clock"></i> Hourly Forecast</h3><div class="hourly-scroll">' + hourlyHtml + '</div></div>' +
    '<div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-calendar-week"></i> 7-Day Forecast</h3><div class="forecast-list">' + daysHtml + '</div></div>');
}
 
function makeSunCard(cssClass, icon, label, time, subLabel) {
  return '<div class="sun-time-card ' + cssClass + '"><div class="icon"><i class="fa-solid fa-' + icon + '"></i></div>' +
    '<div class="label">' + label + '</div><div class="time">' + time + '</div><div class="sub-label">' + subLabel + '</div></div>';
}
 
function formatHoursMinutes(seconds) {
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}
 
async function renderSunTimes() {
  setContent('sun-times', loadingHtml);
  const place = await Api.findCity(selection.city, selection.country);
  const timezone = place.timezone || 'UTC';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // بالشكل YYYY-MM-DD
  const sun = await Api.getSunTimes(place.latitude, place.longitude, today);
 
  function toLocalTime(isoText) {
    return new Date(isoText).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
  }
 
  const percent = (sun.day_length / 864).toFixed(1); 
  const darkness = 86400 - sun.day_length;
 
  setContent('sun-times',
    '<div class="sun-main-card"><div class="sun-main-header">' +
      '<div class="sun-location"><h2><i class="fa-solid fa-location-dot"></i> ' + escapeHtml(selection.city) + '</h2><p>Sun times for your selected location</p></div>' +
      '<div class="sun-date-display"><div class="date">' + formatDate(today, { month: 'long', day: 'numeric', year: 'numeric' }) + '</div>' +
      '<div class="day">' + formatDate(today, { weekday: 'long' }) + '</div></div></div>' +
      '<div class="sun-times-grid">' +
        makeSunCard('dawn', 'moon', 'Dawn', toLocalTime(sun.civil_twilight_begin), 'Civil Twilight') +
        makeSunCard('sunrise', 'sun', 'Sunrise', toLocalTime(sun.sunrise), 'Golden Hour Start') +
        makeSunCard('noon', 'sun', 'Solar Noon', toLocalTime(sun.solar_noon), 'Sun at Highest') +
        makeSunCard('sunset', 'sun', 'Sunset', toLocalTime(sun.sunset), 'Golden Hour End') +
        makeSunCard('dusk', 'moon', 'Dusk', toLocalTime(sun.civil_twilight_end), 'Civil Twilight') +
        makeSunCard('daylight', 'hourglass-half', 'Day Length', formatHoursMinutes(sun.day_length), 'Total Daylight') + '</div></div>' +
    '<div class="day-length-card"><h3><i class="fa-solid fa-chart-pie"></i> Daylight Distribution</h3>' +
      '<div class="day-progress"><div class="day-progress-bar"><div class="day-progress-fill" style="width:' + percent + '%"></div></div></div>' +
      '<div class="day-length-stats">' +
        '<div class="day-stat"><div class="value">' + formatHoursMinutes(sun.day_length) + '</div><div class="label">Daylight</div></div>' +
        '<div class="day-stat"><div class="value">' + percent + '%</div><div class="label">of 24 Hours</div></div>' +
        '<div class="day-stat"><div class="value">' + formatHoursMinutes(darkness) + '</div><div class="label">Darkness</div></div></div></div>');
}
 
async function renderCurrency() {
  if (currencyRates === null) {
    const data = await Api.getRates('USD');
    currencyRates = data.rates;
    let options = '';
    Object.keys(currencyRates).sort().forEach(function (code) {
      options += '<option value="' + code + '">' + code + ' - ' + currencyName(code) + '</option>';
    });
    getEl('currency-from').innerHTML = options;
    getEl('currency-to').innerHTML = options;
    getEl('currency-from').value = 'USD';
    getEl('currency-to').value = 'EGP';
  }
  await convertCurrency();
}
 
async function convertCurrency() {
  const amount = Number(getEl('currency-amount').value) || 0;
  const from = getEl('currency-from').value;
  const to = getEl('currency-to').value;
  const resultBox = getEl('currency-result');
 
  try {
    const data = await Api.getRates(from);
    const rate = data.rates[to];
    const updated = new Date(data.time_last_update_unix * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
 
    resultBox.innerHTML =
      '<div class="conversion-display"><div class="conversion-from"><span class="amount">' + formatNumber(amount, 2) + '</span><span class="currency-code">' + from + '</span></div>' +
      '<div class="conversion-equals"><i class="fa-solid fa-equals"></i></div>' +
      '<div class="conversion-to"><span class="amount">' + formatNumber(amount * rate, 2) + '</span><span class="currency-code">' + to + '</span></div></div>' +
      '<div class="exchange-rate-info"><p>1 ' + from + ' = ' + formatNumber(rate, 4) + ' ' + to + '</p><small>Last updated: ' + updated + '</small></div>';
 
    let quickHtml = '';
    Object.keys(currencyFlags).forEach(function (code) {
      if (code === from) return;
      quickHtml += '<div class="popular-currency-card"><img src="' + flagUrl(currencyFlags[code], 40) + '" alt="' + code + '" class="flag">' +
        '<div class="info"><div class="code">' + code + '</div><div class="name">' + currencyName(code) + '</div></div>' +
        '<div class="rate">' + formatNumber(amount * data.rates[code], 2) + '</div></div>';
    });
    getEl('popular-currencies').innerHTML = quickHtml;
  } catch (error) {
    resultBox.innerHTML = '<div class="exchange-rate-info"><p>Could not load live rates. Please try again.</p></div>';
  }
}
 
function renderMyPlans() {
  const allPlans = plansStorage.getAll();
  const plans = currentFilter === 'all' ? allPlans : allPlans.filter(function (p) { return p.type === currentFilter; });
 
  document.querySelectorAll('.plan-filter').forEach(function (button) {
    button.classList.toggle('active', button.dataset.filter === currentFilter);
  });
  updatePlansCounts();
 
  let html = '';
  plans.forEach(function (plan) {
    html += '<div class="plan-card"><div class="plan-card-type ' + plan.type + '"><i class="fa-solid fa-' + planTypes[plan.type].icon + '"></i> ' + planTypes[plan.type].name + '</div>' +
      '<div class="plan-card-content"><h4>' + escapeHtml(plan.title) + '</h4><div class="plan-card-details">' +
      '<div><i class="fa-regular fa-calendar"></i> ' + escapeHtml(plan.date) + '</div>' +
      '<div><i class="fa-solid fa-location-dot"></i> ' + escapeHtml(plan.place) + '</div></div></div>' +
      '<div class="plan-card-actions"><button class="btn-plan-remove" data-remove="' + escapeHtml(plan.id) + '"><i class="fa-solid fa-trash"></i> Remove</button></div></div>';
  });
 
  if (html === '') {
    html = '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-heart-crack"></i></div><h3>No Saved Plans Yet</h3>' +
      '<p>Start exploring and save holidays, events, or long weekends you like!</p>' +
      '<button class="btn-primary" data-view="dashboard"><i class="fa-solid fa-compass"></i> Start Exploring</button></div>';
  }
  getEl('plans-content').innerHTML = html;
}
 
 
document.addEventListener('click', function (event) {
  const target = event.target;
 
  const viewButton = target.closest('[data-view]');
  if (viewButton) {
    event.preventDefault();
    router.goTo(viewButton.dataset.view);
    return;
  }
 
  const saveButton = target.closest('[data-save]');
  if (saveButton) {
    const id = saveButton.dataset.save;
    const wasAdded = plansStorage.toggle(shownItems[id]);
    document.querySelectorAll('[data-save]').forEach(function (button) {
      if (button.dataset.save === id) updateSaveButton(button, wasAdded);
    });
    updatePlansCounts();
    showToast(wasAdded ? 'Saved to My Plans' : 'Removed from My Plans', wasAdded ? 'success' : 'info');
    return;
  }
 
  const removeButton = target.closest('[data-remove]');
  if (removeButton) {
    plansStorage.remove(removeButton.dataset.remove);
    renderMyPlans();
    showToast('Plan removed', 'info');
    return;
  }
 
  const filterButton = target.closest('.plan-filter');
  if (filterButton) {
    currentFilter = filterButton.dataset.filter;
    renderMyPlans();
    return;
  }
 
  if (target.closest('#global-search-btn')) onExplore();
  else if (target.closest('#clear-selection-btn')) onClearSelection();
  else if (target.closest('#convert-btn')) convertCurrency();
  else if (target.closest('#swap-currencies-btn')) {
    const fromSelect = getEl('currency-from');
    const toSelect = getEl('currency-to');
    const oldFrom = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = oldFrom;
    convertCurrency();
  }
  else if (target.closest('#clear-all-plans-btn')) {
    if (plansStorage.getAll().length === 0) {
      showToast('You have no saved plans', 'info');
      return;
    }
    Swal.fire({ title: 'Clear all plans?', text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, clear all', confirmButtonColor: '#dc2626' })
      .then(function (result) {
        if (result.isConfirmed) {
          plansStorage.clear();
          renderMyPlans();
          showToast('All plans cleared', 'info');
        }
      });
  }
  else if (target.closest('#mobile-menu-btn')) {
    getEl('sidebar').classList.toggle('open');
    getEl('sidebar-overlay').classList.remove('hidden');
    getEl('sidebar-overlay').classList.toggle('active');
  }
  else if (target.closest('#sidebar-overlay')) closeMobileMenu();
});
 
document.addEventListener('change', function (event) {
  if (event.target.id === 'global-country') loadCities(event.target.value);
  if (event.target.id === 'currency-from' || event.target.id === 'currency-to') convertCurrency();
});
 
document.querySelectorAll('.nav-item').forEach(function (link) {
  link.href = views[link.dataset.view].path;
});
updateHeaderClock();
setInterval(updateHeaderClock, 30000);
setInterval(updateCountryClock, 1000);
updatePlansCounts();
 
setupDashboard()
  .catch(function (error) { console.error('Dashboard setup failed:', error); })
  .finally(function () { showView(router.getViewFromUrl()); });
 