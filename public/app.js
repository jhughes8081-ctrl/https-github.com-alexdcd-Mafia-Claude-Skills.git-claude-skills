const cursosPorEtapa = {
  'Educación Infantil': ['1.º Infantil (3 años)', '2.º Infantil (4 años)', '3.º Infantil (5 años)'],
  'Educación Primaria': ['1.º Primaria', '2.º Primaria', '3.º Primaria', '4.º Primaria', '5.º Primaria', '6.º Primaria'],
  'Educación Secundaria Obligatoria': ['1.º ESO', '2.º ESO', '3.º ESO', '4.º ESO'],
  'Bachillerato': ['1.º Bachillerato', '2.º Bachillerato'],
  'Formación Profesional Básica': ['1.º FPB', '2.º FPB']
};

const etapaSelect = document.getElementById('etapa');
const cursoSelect = document.getElementById('curso');

etapaSelect.addEventListener('change', () => {
  const cursos = cursosPorEtapa[etapaSelect.value] || [];
  cursoSelect.innerHTML = '<option value="">Seleccionar...</option>';
  cursos.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    cursoSelect.appendChild(opt);
  });
});

const apiKeyInput = document.getElementById('apiKey');
const saved = localStorage.getItem('anthropic_api_key');
if (saved) apiKeyInput.value = saved;
apiKeyInput.addEventListener('change', () => {
  localStorage.setItem('anthropic_api_key', apiKeyInput.value);
});

let rawMarkdown = '';

document.getElementById('sda-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = document.getElementById('btn-generar');
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');

  btn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  const resultado = document.getElementById('resultado');
  const contenido = document.getElementById('resultado-contenido');
  resultado.hidden = false;
  contenido.innerHTML = '<p style="color:#7f8c8d">Generando Situación de Aprendizaje...</p>';
  rawMarkdown = '';

  const body = {
    etapa: document.getElementById('etapa').value,
    curso: document.getElementById('curso').value,
    area: document.getElementById('area').value,
    titulo: document.getElementById('titulo').value,
    temporalizacion: document.getElementById('temporalizacion').value,
    justificacion: document.getElementById('justificacion').value,
    metodologia: document.getElementById('metodologia').value,
    atencionDiversidad: document.getElementById('atencionDiversidad').value,
    competenciasEspecificas: document.getElementById('competenciasEspecificas').value,
    criteriosEvaluacion: document.getElementById('criteriosEvaluacion').value,
    saberes: document.getElementById('saberes').value,
    productosFinales: document.getElementById('productosFinales').value
  };

  try {
    const response = await fetch('/api/generar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKeyInput.value
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error del servidor');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    contenido.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            rawMarkdown += parsed.text;
            contenido.innerHTML = renderMarkdown(rawMarkdown);
          }
        } catch (parseErr) {
          if (parseErr.message !== 'Unexpected end of JSON input') {
            console.error('Parse error:', parseErr);
          }
        }
      }
    }

    resultado.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    contenido.innerHTML = `<p style="color:#e74c3c"><strong>Error:</strong> ${escapeHtml(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
  }
});

document.getElementById('btn-copiar').addEventListener('click', () => {
  navigator.clipboard.writeText(rawMarkdown).then(() => {
    const btn = document.getElementById('btn-copiar');
    btn.textContent = '✅ Copiado';
    setTimeout(() => btn.textContent = '📋 Copiar', 2000);
  });
});

document.getElementById('btn-descargar').addEventListener('click', () => {
  const titulo = document.getElementById('titulo').value || 'situacion-aprendizaje';
  const filename = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
  const blob = new Blob([rawMarkdown], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('btn-pdf').addEventListener('click', () => {
  const contenido = document.getElementById('resultado-contenido');
  const titulo = document.getElementById('titulo').value || 'situacion-aprendizaje';
  const filename = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf';

  const opt = {
    margin: [15, 15, 15, 15],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  const btn = document.getElementById('btn-pdf');
  btn.textContent = '⏳ Generando...';
  btn.disabled = true;

  html2pdf().set(opt).from(contenido).save().then(() => {
    btn.textContent = '📄 PDF';
    btn.disabled = false;
  });
});

document.getElementById('btn-word').addEventListener('click', () => {
  const contenido = document.getElementById('resultado-contenido').innerHTML;
  const titulo = document.getElementById('titulo').value || 'situacion-aprendizaje';
  const filename = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.doc';

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a2e; margin: 2cm; }
        h1 { font-size: 18pt; color: #1a5276; margin-top: 16pt; }
        h2 { font-size: 14pt; color: #1a5276; margin-top: 14pt; }
        h3 { font-size: 12pt; color: #2c3e50; margin-top: 12pt; }
        table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
        th, td { border: 1px solid #bbb; padding: 5pt 8pt; font-size: 10pt; }
        th { background-color: #eef2f7; font-weight: bold; }
        ul, ol { margin-left: 18pt; }
        blockquote { border-left: 3px solid #2e86c1; padding-left: 10pt; color: #555; }
      </style>
    </head>
    <body>${contenido}</body>
    </html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('btn-imprimir').addEventListener('click', () => {
  window.print();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderMarkdown(md) {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.slice(1, -1).split('|').map(c => c.trim());
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    });

  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (block) => `<table>${block}</table>`);

  html = html.replace(/(^|\n)([-*] .+(\n[-*] .+)*)/g, (match, prefix, list) => {
    const items = list.split('\n').map(line => `<li>${line.replace(/^[-*] /, '')}</li>`).join('');
    return `${prefix}<ul>${items}</ul>`;
  });

  html = html.replace(/(^|\n)(\d+\. .+(\n\d+\. .+)*)/g, (match, prefix, list) => {
    const items = list.split('\n').map(line => `<li>${line.replace(/^\d+\. /, '')}</li>`).join('');
    return `${prefix}<ol>${items}</ol>`;
  });

  html = html.replace(/(?<!\n)\n(?!\n)/g, '<br>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>|<ol>|<table>|<hr>|<blockquote>)/g, '$1');
  html = html.replace(/(<\/ul>|<\/ol>|<\/table>|<\/blockquote>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
