export interface ThreeDGenerationJob {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  message?: string;
  error?: string;
  model_url?: string;
  generation_mode?: string;
}

const POLL_INTERVAL_MS = 3000;
const JOB_TIMEOUT_MS = 55 * 60 * 1000;

async function readJson(response: Response): Promise<ThreeDGenerationJob> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "3D reconstruction failed.");
  }
  return data as ThreeDGenerationJob;
}

export async function generateThreeDModel(formData: FormData, token?: string | null, onStatus?: (job: ThreeDGenerationJob) => void): Promise<ThreeDGenerationJob> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const created = await readJson(await fetch("/api/v1/3d/generate", {
    method: "POST",
    headers,
    body: formData,
  }));

  onStatus?.(created);
  if (created.status === "completed" && created.model_url) return created;
  if (!created.job_id) throw new Error("3D service did not return a job ID.");

  const startedAt = Date.now();
  while (Date.now() - startedAt < JOB_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    let response: Response;
    try {
      response = await fetch(`/api/v1/3d/jobs/${encodeURIComponent(created.job_id)}`, {
        headers,
        cache: "no-store",
      });
    } catch {
      continue;
    }
    const job = await readJson(response);
    onStatus?.(job);
    if (job.status === "completed") {
      if (!job.model_url || job.generation_mode !== "hunyuan_multiview_textured") {
        throw new Error("The service did not verify a textured multi-view model. No model was attached.");
      }
      return job;
    }
    if (job.status === "failed") {
      throw new Error(job.error || job.message || "3D reconstruction failed.");
    }
  }
  throw new Error("This 3D job is taking longer than expected. Keep the page open and try again shortly.");
}
