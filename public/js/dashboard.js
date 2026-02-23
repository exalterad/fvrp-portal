/**
 * Dashboard – auth, server status, spelarstatistik, in-page tabs
 */

(function () {
  const usernameEl = document.getElementById('username');
  const statusBadge = document.getElementById('status-badge');
  const playerCountEl = document.getElementById('player-count');
  const uptimeEl = document.getElementById('server-uptime');
  const characterCountEl = document.getElementById('character-count');
  const playtimeEl = document.getElementById('playtime');

  var TAB_IDS = ['dashboard', 'regler', 'whitelist', 'reports', 'support'];

  function formatUptime(seconds) {
    if (seconds == null || seconds < 0) return '—';
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 't';
    if (h > 0) return h + 't ' + m + 'm';
    return m + 'm';
  }

  function formatPlaytime(minutes) {
    if (minutes == null || minutes < 0) return '—';
    if (minutes < 60) return minutes + ' min';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (h < 24) return h + 't ' + (m ? m + 'm' : '');
    var d = Math.floor(h / 24);
    h = h % 24;
    return d + 'd ' + (h ? h + 't ' : '') + (m ? m + 'm' : '');
  }

  function showTab(tabId) {
    if (!tabId || TAB_IDS.indexOf(tabId) === -1) tabId = 'dashboard';
    document.querySelectorAll('.page-section').forEach(function (el) {
      el.classList.toggle('active', el.id === tabId);
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach(function (el) {
      el.classList.toggle('nav-item-active', el.getAttribute('data-tab') === tabId);
      el.setAttribute('aria-current', el.getAttribute('data-tab') === tabId ? 'page' : null);
    });
    document.querySelectorAll('.action-card[data-tab]').forEach(function (el) {
      el.classList.toggle('action-card-active', el.getAttribute('data-tab') === tabId);
    });
    if (tabId === 'dashboard') {
      if (window.history.replaceState) window.history.replaceState(null, '', '/dashboard');
    } else {
      if (window.history.replaceState) window.history.replaceState(null, '', '/dashboard#' + tabId);
    }
  }

  function getTabFromHash() {
    var hash = (window.location.hash || '').replace(/^#/, '');
    return TAB_IDS.indexOf(hash) !== -1 ? hash : 'dashboard';
  }

  function initTabs() {
    showTab(getTabFromHash());
    window.addEventListener('hashchange', function () {
      showTab(getTabFromHash());
    });
    document.querySelectorAll('[data-tab]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var tab = el.getAttribute('data-tab');
        if (!tab) return;
        e.preventDefault();
        if (tab === 'dashboard') {
          window.location.hash = '';
          showTab('dashboard');
        } else {
          window.location.hash = tab;
          showTab(tab);
        }
      });
    });
  }

  // Användaren
  function loadMe() {
    return fetch('/api/me', { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = '/';
          return null;
        }
        return r.json();
      })
      .then(function (user) {
        if (user && usernameEl) usernameEl.textContent = user.username;
        return user;
      })
      .catch(function () {
        window.location.href = '/';
      });
  }

  loadMe();
  initTabs();

  // Serverstatus
  function updateStatus() {
    if (statusBadge) statusBadge.textContent = 'Laddar...';
    if (playerCountEl) playerCountEl.textContent = '—';
    if (uptimeEl) uptimeEl.textContent = '—';

    fetch('/api/server-status', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (statusBadge) {
          statusBadge.textContent = data.online ? 'Online' : 'Offline';
          statusBadge.className = 'stat-value ' + (data.online ? 'online' : 'offline');
        }
        if (playerCountEl) {
          playerCountEl.textContent = data.online
            ? data.players + ' / ' + data.maxPlayers
            : '—';
        }
        if (uptimeEl) {
          uptimeEl.textContent = data.online && data.uptimeSeconds != null
            ? formatUptime(data.uptimeSeconds)
            : (data.online ? '—' : '—');
        }
      })
      .catch(function () {
        if (statusBadge) {
          statusBadge.textContent = 'Offline';
          statusBadge.className = 'stat-value offline';
        }
        if (playerCountEl) playerCountEl.textContent = '—';
        if (uptimeEl) uptimeEl.textContent = '—';
      });
  }

  updateStatus();
  setInterval(updateStatus, 60000);

  // Spelarstatistik (karaktärer, speltid)
  function loadPlayerStats() {
    fetch('/api/player-stats', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        var characters = Array.isArray(data.characters) ? data.characters : [];
        var totalMin = data.totalPlaytimeMinutes != null ? data.totalPlaytimeMinutes : 0;
        if (characterCountEl) {
          characterCountEl.textContent = characters.length;
        }
        if (playtimeEl) {
          playtimeEl.textContent = totalMin >= 0 ? formatPlaytime(totalMin) : '—';
        }
        var container = document.getElementById('character-cards');
        if (container) {
          container.innerHTML = '';
          if (characters.length === 0) {
            container.innerHTML = '<p class="characters-empty">Inga karaktärer hittades. Koppla portalen till er databas (HeidiSQL) eller använd POST /api/player-stats/update med <code>characters</code>-array.</p>';
          } else {
            characters.forEach(function (c) {
              var card = document.createElement('div');
              card.className = 'character-card';
              card.innerHTML =
                '<span class="character-name">' + escapeHtml(String(c.name || '—')) + '</span>' +
                '<div class="character-details">' +
                  '<span class="character-detail"><span class="character-detail-label">Jobb</span> ' + escapeHtml(String(c.job || '—')) + '</span>' +
                  '<span class="character-detail"><span class="character-detail-label">Pengar</span> ' + formatMoney(c.money) + '</span>' +
                  '<span class="character-detail"><span class="character-detail-label">Speltid</span> ' + formatPlaytime(c.playtimeMinutes) + '</span>' +
                '</div>';
              container.appendChild(card);
            });
          }
        }
      })
      .catch(function () {
        if (characterCountEl) characterCountEl.textContent = '—';
        if (playtimeEl) playtimeEl.textContent = '—';
        var container = document.getElementById('character-cards');
        if (container) container.innerHTML = '<p class="characters-empty">Kunde inte ladda karaktärer.</p>';
      });
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('sv-SE') + ' kr';
  }

  loadPlayerStats();

  // ——— Kö till servern (klick via event delegation så att knappen alltid fungerar) ———
  var queuePollTimer = null;
  var offeredConnectLink = null;
  var queueOfferCountdownTimer = null;
  var OFFER_SECONDS = 30;

  function getQueueEl(id) {
    return document.getElementById(id);
  }

  function stopOfferCountdown() {
    if (queueOfferCountdownTimer) {
      clearInterval(queueOfferCountdownTimer);
      queueOfferCountdownTimer = null;
    }
  }

  function startOfferCountdown() {
    stopOfferCountdown();
    var secondsLeft = OFFER_SECONDS;
    var timerText = getQueueEl('queue-modal-timer-text');
    var progressFill = getQueueEl('queue-modal-progress');
    if (timerText) timerText.textContent = secondsLeft + ' sekunder kvar';
    if (progressFill) progressFill.style.width = '100%';

    queueOfferCountdownTimer = setInterval(function () {
      secondsLeft--;
      if (timerText) {
        timerText.textContent = secondsLeft === 1 ? '1 sekund kvar' : secondsLeft + ' sekunder kvar';
      }
      if (progressFill) {
        progressFill.style.width = Math.max(0, (secondsLeft / OFFER_SECONDS) * 100) + '%';
      }
      if (secondsLeft <= 0) {
        stopOfferCountdown();
        offeredConnectLink = null;
        fetch('/api/queue/leave', { method: 'POST', credentials: 'include' }).catch(function () {});
        var main = getQueueEl('queue-modal-main');
        var timeout = getQueueEl('queue-modal-timeout');
        if (main) main.hidden = true;
        if (timeout) timeout.hidden = false;
      }
    }, 1000);
  }

  function closeQueueModal() {
    stopOfferCountdown();
    var queueModal = getQueueEl('queue-modal');
    var main = getQueueEl('queue-modal-main');
    var timeout = getQueueEl('queue-modal-timeout');
    if (queueModal) queueModal.hidden = true;
    offeredConnectLink = null;
    if (main) main.hidden = false;
    if (timeout) timeout.hidden = true;
    fetch('/api/queue/leave', { method: 'POST', credentials: 'include' }).catch(function () {});
  }

  function showOfferModal() {
    var queueModal = getQueueEl('queue-modal');
    var main = getQueueEl('queue-modal-main');
    var timeout = getQueueEl('queue-modal-timeout');
    var acceptBtn = getQueueEl('queue-modal-accept');
    if (main) main.hidden = false;
    if (timeout) timeout.hidden = true;
    if (queueModal) queueModal.hidden = false;
    if (acceptBtn) acceptBtn.focus();
    startOfferCountdown();
  }

  function setQueueUI(inQueue, position) {
    var queueActionsEl = getQueueEl('queue-actions');
    var queueWaitingEl = getQueueEl('queue-waiting');
    var queuePositionEl = getQueueEl('queue-position');
    if (queueActionsEl) queueActionsEl.hidden = inQueue;
    if (queueWaitingEl) queueWaitingEl.hidden = !inQueue;
    if (queuePositionEl && position != null) queuePositionEl.textContent = String(position);
  }

  function stopQueuePoll() {
    if (queuePollTimer) {
      clearInterval(queuePollTimer);
      queuePollTimer = null;
    }
  }

  function pollQueueStatus() {
    fetch('/api/queue/status', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.offeredSlot && data.connectLink) {
          stopQueuePoll();
          offeredConnectLink = data.connectLink;
          setQueueUI(false);
          showOfferModal();
          return;
        }
        if (data.inQueue) {
          setQueueUI(true, data.position);
        } else {
          setQueueUI(false);
          stopQueuePoll();
        }
      })
      .catch(function () {});
  }

  function handleQueueJoin(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Laddar…';
    fetch('/api/queue/join', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Kunde inte ansluta till kön');
        return r.json();
      })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = 'Ställ mig i kö';
        if (data.offeredSlot && data.connectLink) {
          offeredConnectLink = data.connectLink;
          setQueueUI(false);
          showOfferModal();
          return;
        }
        if (data.inQueue && data.position != null) {
          setQueueUI(true, data.position);
          stopQueuePoll();
          queuePollTimer = setInterval(pollQueueStatus, 5000);
          pollQueueStatus();
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Ställ mig i kö';
        console.error('Kö:', err);
      });
  }

  function handleQueueLeave() {
    fetch('/api/queue/leave', { method: 'POST', credentials: 'include' })
      .then(function () {
        stopQueuePoll();
        setQueueUI(false);
      })
      .catch(function () {});
  }

  // Klick på document – fungerar även om knappen laddats dynamiskt
  document.body.addEventListener('click', function (e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.id === 'queue-join-btn') {
        e.preventDefault();
        e.stopPropagation();
        handleQueueJoin(target);
        return;
      }
      if (target.id === 'queue-leave-btn') {
        e.preventDefault();
        e.stopPropagation();
        handleQueueLeave();
        return;
      }
      target = target.parentElement;
    }
  });

  // Vid laddning: kolla om användaren redan står i kö eller har fått plats
  fetch('/api/queue/status', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.offeredSlot && data.connectLink) {
        offeredConnectLink = data.connectLink;
        setQueueUI(false);
        showOfferModal();
        return;
      }
      if (data.inQueue) {
        setQueueUI(true, data.position);
        queuePollTimer = setInterval(pollQueueStatus, 5000);
      }
    })
    .catch(function () {});

  // Modal: Anslut / Stäng (timeout) / X (avbryt)
  document.body.addEventListener('click', function (e) {
    var target = e.target;
    if (target.id === 'queue-modal-close-x') {
      e.preventDefault();
      closeQueueModal();
      return;
    }
    if (target.id === 'queue-modal-close') {
      e.preventDefault();
      closeQueueModal();
      return;
    }
    if (target.id === 'queue-modal-accept') {
      e.preventDefault();
      if (offeredConnectLink) {
        stopOfferCountdown();
        window.location.href = offeredConnectLink;
        var queueModal = getQueueEl('queue-modal');
        var main = getQueueEl('queue-modal-main');
        var timeout = getQueueEl('queue-modal-timeout');
        if (queueModal) queueModal.hidden = true;
        if (main) main.hidden = false;
        if (timeout) timeout.hidden = true;
        offeredConnectLink = null;
        fetch('/api/queue/leave', { method: 'POST', credentials: 'include' }).catch(function () {});
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var queueModal = getQueueEl('queue-modal');
      if (queueModal && !queueModal.hidden) {
        closeQueueModal();
      }
    }
  });
})();
