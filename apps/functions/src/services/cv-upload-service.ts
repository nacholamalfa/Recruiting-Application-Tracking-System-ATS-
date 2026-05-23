import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

import { CandidatesRepository } from '../repositories/candidateRepository';
import { CvParsingService } from './cv-parsing-service';

/**
 * Orquestador del flujo de procesamiento de CV.
 *
 * Responsabilidades:
 * - Validar precondiciones (candidato existe, source admite parsing).
 * - Controlar las transiciones de estado: processing → done | failed.
 * - Descargar el PDF a memoria (Buffer) y delegar el parseo en
 *   CvParsingService, manteniéndose agnóstico del SDK de IA.
 */
export class CvUploadService {
  constructor(
    private readonly candidatesRepository: CandidatesRepository = new CandidatesRepository(),
    private readonly cvParsingService: CvParsingService = new CvParsingService(),
  ) {}

  async handleCvUploaded(
    candidateId: string,
    cvStoragePath: string,
  ): Promise<void> {
    const candidate = await this.candidatesRepository.findById(candidateId);

    if (!candidate) {
      logger.warn(
        `Se recibió un CV para un candidato inexistente. candidateId=${candidateId}, path=${cvStoragePath}`,
      );
      return;
    }

    // En el flujo manual el CV se adjunta pero el negocio decidió no parsearlo.
    if (candidate.registrationSource === 'manual') {
      await this.candidatesRepository.updateCvStoragePath(
        candidateId,
        cvStoragePath,
        'not_required',
      );
      logger.info(
        `CV adjuntado en flujo manual sin parsing. candidateId=${candidateId}, path=${cvStoragePath}`,
      );
      return;
    }

    // Catch perimetral: cualquier fallo entre acá y el final del try debe dejar
    // el documento en estado "failed" para que el frontend pueda reaccionar.
    try {
      await this.candidatesRepository.markParsingProcessing(
        candidateId,
        cvStoragePath,
      );

      const pdfBuffer = await this.downloadPdfToMemory(cvStoragePath);

      const parsedData =
        await this.cvParsingService.parseFromBuffer(pdfBuffer);

      await this.candidatesRepository.markParsingDone(candidateId, parsedData);

      logger.info('CV parseado correctamente.', {
        candidateId,
        cvStoragePath,
        skills: parsedData.skills?.length ?? 0,
      });
    } catch (error) {
      logger.error('Falló el parsing del CV.', {
        candidateId,
        cvStoragePath,
        error,
      });

      // Best-effort: si el update a failed también explota, no podemos hacer
      // mucho más que loguearlo.
      try {
        await this.candidatesRepository.markParsingFailed(candidateId);
      } catch (statusError) {
        logger.error('Tampoco se pudo marcar el parsing como failed.', {
          candidateId,
          statusError,
        });
      }
    }
  }

  /**
   * Streaming en memoria: el PDF se descarga directamente a un Buffer.
   * Nunca tocamos `/tmp` para respetar la consigna de la ficha técnica.
   */
  private async downloadPdfToMemory(cvStoragePath: string): Promise<Buffer> {
    const bucket = admin.storage().bucket();
    const [buffer] = await bucket.file(cvStoragePath).download();
    return buffer;
  }
}
