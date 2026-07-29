// Role gate — se abre solo cuando el usuario toca "Ingresar"
(function () {
  const gate = document.getElementById('roleGate');
  if (!gate) return;

  function abrirGate() {
    gate.style.display = 'flex';
    gate.classList.remove('is-hiding');
  }

  function cerrarGate() {
    gate.classList.add('is-hiding');
    setTimeout(() => { gate.style.display = 'none'; gate.classList.remove('is-hiding'); }, 500);
  }

  function elegirRol(rol) {
    if (rol === 'cliente') {
      window.location.href = 'cliente.html';
    } else {
      window.location.href = 'panel/';
    }
  }

  document.getElementById('roleCliente').addEventListener('click', () => elegirRol('cliente'));
  document.getElementById('roleEmpleado').addEventListener('click', () => elegirRol('empleado'));

  const openBtn = document.getElementById('openRoleGateBtn');
  if (openBtn) openBtn.addEventListener('click', abrirGate);
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
