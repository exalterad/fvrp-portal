/**
 * Landing page – error display, footer links, scroll-reveal animationer
 */

(function () {
  // Show OAuth error from query string
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const msg = document.getElementById('hero-error');
  if (msg && error) {
    const messages = {
      discord_denied: 'Inloggningen avbröts.',
      no_code: 'Ogiltig återanrop från Discord.',
      auth_failed: 'Kunde inte logga in. Försök igen senare.',
    };
    msg.textContent = messages[error] || 'Ett fel uppstod.';
    msg.hidden = false;
  }

  // Scroll-reveal: lägg till .is-visible när element kommer in i vyn
  var revealEls = document.querySelectorAll('.scroll-reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else if (revealEls.length) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Footer links from config
  fetch('/api/config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (config) {
      if (!config) return;
      const discord = document.getElementById('footer-discord');
      const connect = document.getElementById('footer-connect');
      if (discord && config.discordInvite && config.discordInvite !== '#') {
        discord.href = config.discordInvite;
        discord.target = '_blank';
        discord.rel = 'noopener';
      }
      if (connect && config.connectLink) {
        connect.href = config.connectLink;
        connect.target = '_blank';
        connect.rel = 'noopener';
      }
    })
    .catch(function () {});
})();
