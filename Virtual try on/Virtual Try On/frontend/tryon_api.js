/**
 * Standalone Virtual Try-On API Service
 * Extract of try-on related API calls for easy integration.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8088';

export const getToken = () => localStorage.getItem('vx_token');

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body = null, isForm = false) {
  const headers = { ...authHeaders() };
  let fetchBody = null;

  if (body) {
    if (isForm) {
      fetchBody = body; // FormData — do NOT set Content-Type
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }
  }

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: fetchBody,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  } catch (e) {
    console.warn(`[API] ${method} ${path} failed:`, e.message);
    throw e;
  }
}

// ── TryOn ──────────────────────────────────────────────────────────────────

export const tryon = {
  async start(personFile, productId, garmentType = null, saveHistory = false) {
    const form = new FormData();
    form.append('person_image', personFile);
    form.append('product_id', productId);
    if (garmentType) form.append('garment_type', garmentType);
    form.append('save_history', saveHistory.toString());
    return request('POST', '/api/v1/tryon/start', form, true);
  },

  async status(jobId) {
    return request('GET', `/api/v1/tryon/status/${jobId}`);
  },

  async result(jobId) {
    return request('GET', `/api/v1/tryon/result/${jobId}`);
  },

  async history() {
    return request('GET', '/api/v1/tryon/history');
  },
};

// ── Legacy try-on (direct FASHN) ───────────────────────────────────────────

export const fashn = {
  async tryOn(personFile, garmentPath, garmentType = null) {
    const form = new FormData();
    form.append('person_image', personFile);
    form.append('garment_path', garmentPath);
    if (garmentType) form.append('garment_type', garmentType);
    return request('POST', '/api/v1/tryon/', form, true);
  },

  async tryOnCombo(personFile, topPath, bottomPath) {
    const form = new FormData();
    form.append('person_image', personFile);
    form.append('top_path', topPath);
    form.append('bottom_path', bottomPath);
    return request('POST', '/api/v1/tryon/combo', form, true);
  },
};

export default { tryon, fashn };
