const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

app.post('/api/generar', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(400).json({ error: 'Se requiere una API key de Anthropic' });
  }

  const {
    etapa, curso, area, titulo, temporalizacion,
    justificacion, metodologia, atencionDiversidad,
    competenciasEspecificas, criteriosEvaluacion,
    saberes, productosFinales
  } = req.body;

  const prompt = `Eres un experto en educación y en la legislación educativa LOMLOE para Andalucía (Decreto 101/2023 para Primaria, Decreto 102/2023 para ESO, Decreto 103/2023 para Bachillerato, según corresponda).

Genera una Situación de Aprendizaje completa y detallada con los siguientes datos:

- **Etapa educativa**: ${etapa}
- **Curso**: ${curso}
- **Área/Materia**: ${area}
- **Título**: ${titulo}
- **Temporalización**: ${temporalizacion}
${justificacion ? `- **Justificación/Contexto**: ${justificacion}` : ''}
${metodologia ? `- **Metodología preferida**: ${metodologia}` : ''}
${atencionDiversidad ? `- **Atención a la diversidad**: ${atencionDiversidad}` : ''}
${competenciasEspecificas ? `- **Competencias específicas a trabajar**: ${competenciasEspecificas}` : ''}
${criteriosEvaluacion ? `- **Criterios de evaluación**: ${criteriosEvaluacion}` : ''}
${saberes ? `- **Saberes básicos**: ${saberes}` : ''}
${productosFinales ? `- **Productos finales esperados**: ${productosFinales}` : ''}

La Situación de Aprendizaje debe incluir las siguientes secciones, bien desarrolladas y alineadas con la normativa andaluza LOMLOE:

1. **IDENTIFICACIÓN**: Título, etapa, curso, área/materia, temporalización.
2. **JUSTIFICACIÓN**: Contexto, relevancia y conexión con el entorno del alumnado andaluz.
3. **CONCRECIÓN CURRICULAR**:
   - Competencias específicas del área (con código según normativa andaluza).
   - Criterios de evaluación asociados (con código).
   - Saberes básicos implicados (con código).
   - Descriptores operativos del perfil de salida (competencias clave).
4. **SECUENCIACIÓN DIDÁCTICA**: Actividades detalladas organizadas en fases:
   - Fase de motivación/activación
   - Fase de exploración/estructuración
   - Fase de aplicación/conclusión
   Cada actividad debe incluir: descripción, temporalización, agrupamientos, recursos y espacios.
5. **MEDIDAS DE ATENCIÓN A LA DIVERSIDAD Y A LAS DIFERENCIAS INDIVIDUALES** (DUA).
6. **EVALUACIÓN**:
   - Instrumentos de evaluación.
   - Rúbricas o indicadores de logro.
7. **RECURSOS Y MATERIALES**.
8. **VALORACIÓN DE LO APRENDIDO / REFLEXIÓN**: Autoevaluación y coevaluación.

Responde en formato Markdown bien estructurado. Sé detallado y concreto en las actividades. Usa los códigos curriculares reales de la normativa andaluza cuando sea posible.`;

  try {
    const client = new Anthropic({ apiKey });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6-20250620',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
