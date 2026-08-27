// Role gate — se muestra directamente al cargar la página
(function () {
  const gate = document.getElementById('roleGate');
  if (!gate) return;

  gate.style.display = 'flex';

  function elegirRol(rol) {
    if (rol === 'cliente') {
      window.location.href = 'cliente.html';
    } else {
      window.location.href = 'panel/';
    }
  }

  document.getElementById('roleCliente').addEventListener('click', () => elegirRol('cliente'));
  document.getElementById('roleEmpleado').addEventListener('click', () => elegirRol('empleado'));

  // Botón "Ver la página" — cierra el gate y muestra la landing
  document.getElementById('roleVerSitio').addEventListener('click', () => {
    gate.classList.add('is-hiding');
    gate.addEventListener('transitionend', () => {
      gate.style.display = 'none';
    }, { once: true });
  });

  // También permite reabrirlo desde el nav
  const openBtn = document.getElementById('openRoleGateBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      gate.style.display = 'flex';
      requestAnimationFrame(() => gate.classList.remove('is-hiding'));
    });
  }
})();

// Menú mobile
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');

navToggle.addEventListener('click', () => {
  nav.classList.toggle('is-open');
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => nav.classList.remove('is-open'));
});

// Lightbox de galería
const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.innerHTML = '<button class="lightbox__close" aria-label="Cerrar">&times;</button><img src="" alt="">';
document.body.appendChild(lightbox);

const lightboxImg = lightbox.querySelector('img');
const lightboxClose = lightbox.querySelector('.lightbox__close');

document.querySelectorAll('.gallery__grid img').forEach(img => {
  img.addEventListener('click', () => {
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.classList.add('is-open');
  });
});

function closeLightbox() {
  lightbox.classList.remove('is-open');
  lightboxImg.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
