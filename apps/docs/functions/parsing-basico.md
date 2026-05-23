# Parsing Básico de CV — Implementación Backend

Documento técnico que describe el flujo de procesamiento asincrónico de CVs en el backend, alineado con la **ficha técnica de Parsing Básico**.

> **Rama:** `fb-53-102`
> **Alcance:** procesamiento server-side disparado por upload a Storage. El scoring/recomendaciones se cubre en otra HU.

---

## 1. Objetivo

Cumplir la Historia de Usuario 3:

> *"Como candidato, necesito que el sistema procese y extraiga los datos del CV automáticamente, con la finalidad de ahorrar tiempo en la carga y evitar errores manuales cuando me postulo a una posición."*

El backend debe:

1. Reaccionar al upload de un PDF a Firebase Storage mediante el trigger `onObjectFinalized`.
2. Descargar el PDF a memoria (Buffer) sin tocar el disco efímero `/tmp`.
3. Invocar a Vertex AI (`gemini-1.5-flash`) con un `responseSchema` estricto para obtener un JSON estructurado.
4. Persistir los datos en `candidates/{id}.parsedData` y controlar los estados `processing → done | failed`.
5. Soportar un bypass automático cuando se ejecuta en el emulador local (`FUNCTIONS_EMULATOR === 'true'`).

---

## 2. Arquitectura del flujo

```
Cliente (Next.js)
   │  registerCandidateCV() → callable
   │       crea candidates/{id} con cvParseStatus="pending"
   │
   │  Sube PDF a Storage en cvs/{candidateId}/<archivo>.pdf
   ▼
Firebase Storage
   │
   │  onObjectFinalized event
   ▼
onCVUploaded.ts (trigger)
   │  - Valida prefijo y mimeType
   ▼
CvUploadService.handleCvUploaded()
   │  ├─ markParsingProcessing()        → cvParseStatus="processing", parsedData=null
   │  ├─ downloadPdfToMemory(path)      → Buffer en RAM
   │  ├─ CvParsingService.parseFromBuffer(buffer)
   │  │     ├─ if FUNCTIONS_EMULATOR=true → devuelve mock estático
   │  │     └─ else → Vertex AI (IAM, gemini-1.5-flash, responseSchema estricto)
   │  ├─ markParsingDone(parsedData)    → cvParseStatus="done", parsedData={...}
   │  └─ catch perimetral
   │        └─ markParsingFailed()      → cvParseStatus="failed", parsedData=null
   ▼
Firestore
   candidates/{id}
     cvParseStatus, cvStoragePath, parsedData, updatedAt
   │
   ▼
Cliente
   Suscripción a candidates/{id} (en tiempo real) detecta el cambio
   y refresca la UI cuando cvParseStatus === "done".

Eventualmente:
   confirmCandidateProfile() → callable
     profileStatus="completed", crea/activa applications/{id}
```

---

## 3. Componentes y responsabilidades

### 3.1 `apps/functions/src/triggers/onCvUploaded.ts`

- Reacciona al evento `onObjectFinalized` de Storage.
- Filtra: el path debe matchear `cvs/{candidateId}/<filename>` y el `contentType` debe ser `application/pdf`.
- Sólo orquesta routing. Delega toda la lógica de negocio en `CvUploadService`.

### 3.2 `apps/functions/src/services/cv-upload-service.ts`

Orquestador del flujo. Responsabilidades exclusivas:

- Validar precondiciones (candidato existe, origen del registro admite parsing).
- Controlar transiciones de estado a través de la `CandidatesRepository`.
- Descargar el PDF a memoria (`bucket.file(path).download()` devuelve `Buffer[]`).
- Delegar el parsing en `CvParsingService`.
- Catch perimetral: si cualquier paso falla, transiciona a `failed`.

**No conoce a Vertex AI ni hace prompts.** Esa responsabilidad vive en `CvParsingService`.

### 3.3 `apps/functions/src/services/cv-parsing-service.ts` (nuevo)

Adaptador cognitivo aislado. Único componente que importa `@google-cloud/vertexai`.

- **Autenticación implícita por IAM:** instancia `VertexAI({ project, location })` sin secretos. Las credenciales se resuelven via service account del runtime de Cloud Functions.
- **Modelo:** `gemini-1.5-flash` con `responseMimeType: "application/json"` y `responseSchema` que describe `ParsedCandidateProfileData`.
- **PDF como inlineData:** el Buffer se codifica a base64 y se envía como `parts[0].inlineData` junto con el prompt.
- **Bypass de emulador:** si `process.env.FUNCTIONS_EMULATOR === 'true'`, retorna un mock estático sin llamar a Vertex.
- **`parserVersion`:** se agrega siempre al objeto devuelto para trazabilidad de cambios de modelo.

### 3.4 `apps/functions/src/repositories/candidateRepository.ts`

Tres helpers nuevos para encapsular las transiciones de estado del parsing:

| Helper | Mutación |
|---|---|
| `markParsingProcessing(candidateId, cvStoragePath)` | `cvParseStatus="processing"`, `cvStoragePath`, `parsedData=null`, `updatedAt` |
| `markParsingDone(candidateId, parsedData)` | `cvParseStatus="done"`, `parsedData`, `updatedAt` |
| `markParsingFailed(candidateId)` | `cvParseStatus="failed"`, `parsedData=null`, `updatedAt` |

Todos usan `set({...}, { merge: true })` para no pisar otros campos del documento.

---

## 4. Contrato de datos en Firestore

### 4.1 Modelo `Candidate` (extensión aditiva)

```ts
interface Candidate {
  // ... campos previos ...
  cvParseStatus: 'not_required' | 'pending' | 'processing' | 'done' | 'failed';
  cvStoragePath?: string | null;
  parsedData?: ParsedCandidateProfileData | null;   // NUEVO
}
```

### 4.2 `ParsedCandidateProfileData` (forma del JSON estructurado)

```ts
interface ParsedCandidateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  workExperience?: ParsedExperience[];
  education?: ParsedEducation[];

  rawText?: string;
  parserVersion?: string;
}

interface ParsedExperience {
  company?: string;
  role?: string;
  startDate?: string;   // YYYY-MM o YYYY
  endDate?: string;
  description?: string;
}

interface ParsedEducation {
  institution?: string;
  degree?: string;
  startDate?: string;
  endDate?: string;
}
```

### 4.3 Tabla de transiciones de `cvParseStatus`

| Estado | Cuándo se setea | Quién lo setea |
|---|---|---|
| `pending` | Inmediatamente después de `registerCandidateCV()` | `CandidateRegistrationCVService` |
| `not_required` | Flujo manual donde el CV no debe parsearse | `CvUploadService` |
| `processing` | Apenas el trigger empieza a procesar | `CvUploadService.markParsingProcessing` |
| `done` | Vertex AI respondió y se persistió `parsedData` | `CvUploadService.markParsingDone` |
| `failed` | Cualquier excepción en el catch perimetral | `CvUploadService.markParsingFailed` |

---

## 5. Variables de entorno

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `FUNCTIONS_EMULATOR` | Auto (set por Firebase) | — | Si `=== 'true'`, `CvParsingService` devuelve mock |
| `VERTEX_LOCATION` | No | `us-central1` | Región de Vertex AI a usar |
| `GCP_PROJECT` / `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` | No (auto) | resuelto de `admin.app().options.projectId` | Project ID para inicializar Vertex |

**No hay API keys.** En producción Firebase Functions corre con un service account que debe tener el rol `roles/aiplatform.user` (Vertex AI User) sobre el proyecto.

---

## 6. Dependencias

En `apps/functions/package.json` hay que agregar:

```json
"@google-cloud/vertexai": "^1.x"
```

Instalación:

```powershell
pnpm --filter @ats/functions add @google-cloud/vertexai
```

---

## 7. Cómo probar localmente (con bypass de mock)

### 7.1 Pre-requisitos

1. `pnpm --filter @ats/functions add @google-cloud/vertexai`
2. `pnpm --filter @ats/functions build`
3. `firebase emulators:start` (Functions + Firestore + Storage + Auth)

### 7.2 Generar un token JWT de prueba (auth emulator)

```powershell
node -e "const u='test-user-001';const now=Math.floor(Date.now()/1000);const p={user_id:u,sub:u,aud:'ats-tema-ort',iss:'https://securetoken.google.com/ats-tema-ort',auth_time:now,iat:now,exp:now+86400,firebase:{identities:{},sign_in_provider:'anonymous'}};const h=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url');const b=Buffer.from(JSON.stringify(p)).toString('base64url');console.log(h+'.'+b+'.')"
```

### 7.3 Flujo completo en Postman

**Paso 1 — Sembrar jobs (una vez por sesión):**

```
POST http://127.0.0.1:5001/ats-tema-ort/us-central1/seedJobs
Content-Type: application/json

{ "data": {} }
```

**Paso 2 — Registrar la intención de postulación con CV:**

```
POST http://127.0.0.1:5001/ats-tema-ort/us-central1/registerCandidateCV
Authorization: Bearer {{token}}
Content-Type: application/json

{ "data": { "jobId": "frontend-ssr-developer" } }
```

Respuesta:
```json
{
  "result": {
    "candidateId": "test-user-001",
    "applicationId": "test-user-001_frontend-ssr-developer",
    "uploadBasePath": "cvs/test-user-001/",
    "cvParseStatus": "pending",
    "applicationStatus": "draft"
  }
}
```

**Paso 3 — Subir el PDF a Storage emulator (dispara el trigger):**

```
POST http://127.0.0.1:9199/upload/storage/v1/b/ats-tema-ort.appspot.com/o?name=cvs/test-user-001/cv.pdf&uploadType=media
Content-Type: application/pdf

Body: binary → seleccionar archivo PDF
```

**Paso 4 — Esperar y verificar en Firestore Emulator UI:**

Abrí http://127.0.0.1:4000/firestore. En segundos el doc `candidates/test-user-001` debe pasar por:

```
cvParseStatus: "processing"  →  cvParseStatus: "done"
parsedData: null             →  parsedData: { firstName: "Sofía Demo", skills: [...], ... }
```

Como `FUNCTIONS_EMULATOR === 'true'`, lo que se persiste es el mock estático definido en `CvParsingService`. No se llama a Vertex AI.

**Paso 5 — Confirmar el perfil (Human-in-the-loop):**

El frontend habitualmente muestra el `parsedData` para que el usuario edite. Luego:

```
POST http://127.0.0.1:5001/ats-tema-ort/us-central1/confirmCandidateProfile
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "data": {
    "candidateId": "test-user-001",
    "applicationId": "test-user-001_frontend-ssr-developer",
    "profile": {
      "firstName": "Sofía",
      "lastName":  "Demo",
      "email":     "sofia.demo@example.com",
      "phone":     "+54 11 5555-1234",
      "technicalSkills": ["React", "Next.js", "TypeScript"]
    }
  }
}
```

Esperado:

```json
{
  "result": {
    "candidateId": "test-user-001",
    "applicationId": "test-user-001_frontend-ssr-developer",
    "profileStatus": "completed",
    "applicationStatus": "active",
    "applicationStage": "applied",
    "cvParseStatus": "done"
  }
}
```

---

## 8. Decisiones de diseño

| Decisión | Justificación |
|---|---|
| Trigger Storage + servicio orquestador + servicio cognitivo (3 capas) | Single Responsibility: cada componente se puede testear y reemplazar de forma aislada. |
| Vertex AI con IAM (no API Keys) | Política corporativa: sin secretos en el código, rotación automática, data residency garantizada por región GCP. |
| `responseSchema` estricto | Garantiza JSON parseable, sin chequeos defensivos manuales sobre texto crudo. |
| Buffer en memoria (no `/tmp`) | Cloud Functions tiene RAM limitada pero suficiente para PDFs (típicamente <2MB). Evita problemas de cold start con disco y simplifica la limpieza. |
| Bypass por `FUNCTIONS_EMULATOR` | Permite probar el flujo end-to-end localmente sin consumir cuota de Vertex ni configurar credenciales reales. |
| `parserVersion` en el output | Trazabilidad: si en el futuro cambia el modelo o el prompt, los registros viejos quedan etiquetados con qué versión los generó. |
| `parsedData: null` al iniciar | Evita arrastrar datos viejos en re-uploads. Si el usuario sube un CV nuevo, los datos previos se limpian. |
| `merge: true` en todas las escrituras del repo | Cero riesgo de pisar campos que pertenezcan a otros servicios del backend. |

---

## 9. Limitaciones conocidas

- **El `confirmCandidateProfile` actual no usa `parsedData` como base.** Recibe el `profile` completo del cliente. En una iteración futura se puede cerrar el ciclo Human-in-the-loop leyendo `parsedData` y aplicando overrides puntuales del usuario.
- **No hay reintentos exponenciales.** Si Vertex devuelve un 5xx, la primera invocación queda en `failed`. Cloud Functions v2 soporta retry policy declarativa que se puede activar en el `onObjectFinalized` con `retry: true`, pero requiere idempotencia adicional que aún no está cubierta.
- **El mock no varía por archivo.** Devuelve siempre el mismo `ParsedCandidateProfileData` en emulador. Si se necesita variabilidad para testing más fino, se puede leer el nombre del archivo y devolver mocks distintos por sufijo.
- **`location` hardcodeada a `us-central1`** salvo override por env var. Para data residency en otras regiones (ej: Europa) habría que setear `VERTEX_LOCATION=europe-west4`.

---

## 10. Diferencias respecto a la versión anterior (HU 3 vía Next.js)

| Aspecto | Antes (HU 3 en Next.js) | Ahora (ficha técnica) |
|---|---|---|
| Modelo invocación | Síncrono, POST a `/api/applications/parse-and-apply` | Asíncrono, disparado por Storage Trigger |
| SDK | `@google/generative-ai` (público) | `@google-cloud/vertexai` (corporativo) |
| Autenticación | API Key en env var | IAM por roles del service account |
| Extracción de texto del PDF | Responsabilidad del cliente | Responsabilidad del backend (`bucket.file().download()`) |
| Estados de parsing | No se manejaban | `processing → done | failed` |
| Bypass local | No existía | `FUNCTIONS_EMULATOR === 'true'` |
| Escalabilidad | Limitada por timeouts HTTP | Cloud Functions autoescala por evento |

---

## 11. Próximos pasos sugeridos

1. **`calculateApplicationFit` callable nuevo** que reciba el `applicationId` y calcule el % de FIT contra el job + recomendaciones, consumiendo `parsedData.skills`. Era la lógica útil del antiguo `scoringEngine.ts` reubicada en Functions.
2. **Conectar el front al flujo:** que `ManualCandidateForm` (o el flujo CV) suscriba al doc del candidato y refresque la UI según `cvParseStatus`.
3. **Activar retry policy** del trigger con idempotencia robusta (los helpers ya son idempotentes vía `merge`, falta gatear contra reprocesamientos repetidos).
4. **Métricas y alertas:** contador de `cvParseStatus === 'failed'` para detectar regresiones del prompt o cambios de comportamiento del modelo.
