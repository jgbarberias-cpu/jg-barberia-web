// Role gate
(function () {
  const gate = document.getElementById('roleGate');
  if (!gate) return;

  // Si ya eligió en esta sesión, quitamos la pantalla
  if (sessionStorage.getItem('jg_ingreso')) {
    gate.remove();
    return;
  }

  function elegirRol(rol) {
    sessionStorage.setItem('jg_ingreso', rol);
    if (rol === 'cliente') {
      gate.classList.add('is-hiding');
      setTimeout(() => gate.remove(), 500);
    } else {
      window.location.href = 'panel/';
    }
  }

  document.getElementById('roleCliente').addEventListener('click', () => elegirRol('cliente'));
  document.getElementById('roleDueno').addEventListener('click', () => elegirRol('dueno'));
  document.getElementById('roleEmpleado').addEventListener('click', () => elegirRol('empleado'));

  // Botón "Ingresar" del header → reabre el selector
  const openBtn = document.getElementById('openRoleGateBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      // Si el gate fue eliminado del DOM, recreamos la sesión y redirigimos al panel
      // Si sigue en el DOM, lo mostramos de nuevo
      const existingGate = document.getElementById('roleGate');
      if (existingGate) {
        existingGate.classList.remove('is-hiding');
      } else {
        window.location.href = 'panel/';
      }
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
