import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

import type { ParsedCandidateProfileData } from '@ats/shared-types';

import { VertexAI, SchemaType } from '@google-cloud/vertexai';

const MODEL_NAME = 'gemini-1.5-flash';
const DEFAULT_LOCATION = 'us-central1';
const PARSER_VERSION = 'cv-parser/1.0';

/**
 * Schema estricto que Vertex AI debe respetar. La consigna de la ficha técnica
 * es que el modelo devuelva ÚNICAMENTE este shape.
 */
const PROFILE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    firstName: { type: SchemaType.STRING },
    lastName: { type: SchemaType.STRING },
    email: { type: SchemaType.STRING },
    phone: { type: SchemaType.STRING },
    skills: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    workExperience: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          company: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING },
          startDate: { type: SchemaType.STRING },
          endDate: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
      },
    },
    education: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          institution: { type: SchemaType.STRING },
          degree: { type: SchemaType.STRING },
          startDate: { type: SchemaType.STRING },
          endDate: { type: SchemaType.STRING },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `Eres un parser de CVs para un ATS profesional.
Tu única tarea es leer el PDF adjunto y devolver un JSON ajustado al schema.

Reglas estrictas:
- Devuelve nombres canónicos de skills (ej: "React" en vez de "ReactJS",
  "Node.js" en vez de "nodejs", "PostgreSQL" en vez de "postgres").
- Si un campo no aparece en el CV, omítelo (no inventes datos).
- Para fechas usa el formato YYYY-MM. Si solo hay año, usa YYYY.
- En workExperience, ordena de más reciente a más antigua.
- No agregues comentarios ni texto fuera del JSON.`;

/**
 * Mock determinístico que se devuelve cuando el servicio detecta que está
 * corriendo en el emulador (`FUNCTIONS_EMULATOR === 'true'`). Permite probar
 * el flujo end-to-end localmente sin consumir cuota de Vertex AI.
 */
const MOCK_PARSED_PROFILE: ParsedCandidateProfileData = {
  firstName: 'Sofía',
  lastName: 'Demo',
  email: 'sofia.demo@example.com',
  phone: '+54 11 5555-1234',
  skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Firebase'],
  workExperience: [
    {
      company: 'Tema Consulting',
      role: 'Frontend Developer',
      startDate: '2023-01',
      endDate: '2026-05',
      description: 'Desarrollo de interfaces SSR con Next.js y MUI.',
    },
  ],
  education: [
    {
      institution: 'ORT Argentina',
      degree: 'Analista en Sistemas',
      startDate: '2019',
      endDate: '2022',
    },
  ],
  parserVersion: PARSER_VERSION,
};

export class CvParsingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CvParsingError';
  }
}

/**
 * Adaptador cognitivo aislado. Es el único componente del backend que conoce
 * Vertex AI. Autenticación implícita por roles IAM (sin API keys).
 */
export class CvParsingService {
  private vertexClient: VertexAI | null = null;

  async parseFromBuffer(
    pdfBuffer: Buffer,
  ): Promise<ParsedCandidateProfileData> {
    if (this.isEmulatorEnvironment()) {
      logger.info(
        '[CvParsingService] Entorno emulador detectado. Devolviendo mock estático.',
      );
      return { ...MOCK_PARSED_PROFILE };
    }

    try {
      const model = this.getModel();
      const base64Pdf = pdfBuffer.toString('base64');

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Pdf,
                },
              },
              { text: SYSTEM_PROMPT },
            ],
          },
        ],
      });

      const responseText =
        result.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (!responseText) {
        throw new CvParsingError('Vertex AI devolvió una respuesta vacía.');
      }

      const parsed = JSON.parse(responseText) as ParsedCandidateProfileData;

      return {
        ...parsed,
        parserVersion: PARSER_VERSION,
      };
    } catch (error) {
      if (error instanceof CvParsingError) throw error;
      throw new CvParsingError(
        'No se pudo parsear el CV con Vertex AI.',
        error,
      );
    }
  }

  private isEmulatorEnvironment(): boolean {
    return process.env.FUNCTIONS_EMULATOR === 'true';
  }

  private getModel() {
    if (!this.vertexClient) {
      const project = this.resolveProjectId();
      const location = process.env.VERTEX_LOCATION ?? DEFAULT_LOCATION;

      this.vertexClient = new VertexAI({
        project,
        location,
      });

      logger.info('[CvParsingService] Vertex AI inicializado.', {
        project,
        location,
        model: MODEL_NAME,
      });
    }

    return this.vertexClient.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: PROFILE_SCHEMA as any,
        temperature: 0.1,
      },
    });
  }

  private resolveProjectId(): string {
    const candidate =
      process.env.GCP_PROJECT ??
      process.env.GCLOUD_PROJECT ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      admin.app().options.projectId;

    if (!candidate) {
      throw new CvParsingError(
        'No se pudo determinar el GCP project ID para Vertex AI.',
      );
    }
    return candidate;
  }
}
