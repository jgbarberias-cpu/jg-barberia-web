(function () {
  const { url, anonKey } = window.REVIEWS_SUPABASE_CONFIG;
  const client = window.supabase.createClient(url, anonKey);

  function renderStars(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  async function loadReviews() {
    const { data, error } = await client
      .from('resenas')
      .select('*')
      .eq('aprobado', true)
      .order('created_at', { ascending: false });

    const list = document.getElementById('reviewsList');
    const empty = document.getElementById('reviewsEmpty');
    if (error || !data || data.length === 0) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = data.map(r => `
      <div class="review-card">
        <div class="review-card__stars">${renderStars(r.calificacion)}</div>
        <p class="review-card__comentario">"${r.comentario}"</p>
        <p class="review-card__nombre">— ${r.nombre}</p>
      </div>
    `).join('');
  }

  function setupStarInput() {
    const starInput = document.getElementById('starInput');
    const stars = starInput.querySelectorAll('span');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = Number(star.dataset.star);
        starInput.dataset.rating = rating;
        stars.forEach(s => s.classList.toggle('is-active', Number(s.dataset.star) <= rating));
      });
    });
  }

  function setupForm() {
    const form = document.getElementById('reviewForm');
    const starInput = document.getElementById('starInput');
    const msg = document.getElementById('reviewMsg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const calificacion = Number(starInput.dataset.rating);
      if (!calificacion) {
        msg.textContent = 'Por favor, elegí una calificación con las estrellas.';
        msg.hidden = false;
        return;
      }

      const { error } = await client.from('resenas').insert({
        nombre: document.getElementById('reviewNombre').value.trim(),
        comentario: document.getElementById('reviewComentario').value.trim(),
        calificacion,
        aprobado: false
      });

      if (error) {
        msg.textContent = 'No se pudo enviar la reseña, intentá de nuevo.';
      } else {
        msg.textContent = '¡Gracias por tu opinión! Se va a publicar una vez aprobada.';
        form.reset();
        starInput.dataset.rating = 0;
        starInput.querySelectorAll('span').forEach(s => s.classList.remove('is-active'));
      }
      msg.hidden = false;
    });
  }

  loadReviews();
  setupStarInput();
  setupForm();
})();
