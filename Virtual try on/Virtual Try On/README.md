# Virtual Try-On Export Module

This folder contains all the necessary components to integrate the VastraX Virtual Try-On (FASHN AI) feature into a new project.

## Directory Structure

```text
tryon-export/
├── frontend/
│   ├── TryOnPage.jsx       # The main React component for the Try-On UI
│   └── tryon_api.js        # The extracted API client functions
├── backend/
│   ├── routes/
│   │   └── tryon.py        # FastAPI routes for the try-on endpoints
│   ├── services/
│   │   ├── tryon_service.py # Business logic for handling try-on sessions
│   │   └── fashn_service.py # Core integration with FASHN VTON 1.5 GPU script
│   └── start-tryon.py      # Launcher script (starts FastAPI + Cloudflare tunnel)
└── infrastructure/
    ├── gpu-setup/
    │   └── setup_fashn.sh  # Script to provision the FASHN AI GPU server
    └── tunnel/
        └── tunnel.py       # (Optional) Tunnel utility for local-to-remote bridging
```

## Integration Guide

### 1. Frontend Integration

**Requirements:**
- React 18+
- React Router v6 (`react-router-dom`)
- Lucide React icons (`lucide-react`)

**Steps:**
1. Copy `TryOnPage.jsx` into your new frontend `src/pages/` directory.
2. Copy `tryon_api.js` into your `src/services/` directory.
3. Update the `import { useApp } from '../../context/AppContext';` in `TryOnPage.jsx` to point to your new app's context or state management solution. The component expects:
   - `products`: An array of available products.
   - `addToCart(product, size)`: Function to add items to cart.
   - `tryOnPortraitFile`, `setTryOnPortraitFile`: State for the uploaded photo.
   - `tryOnPortraitPreview`, `setTryOnPortraitPreview`: State for the photo preview URL.
4. Ensure your new `vite.config.js` or `package.json` proxy points API calls (`/api/v1`) to the backend server.

### 2. Backend Integration

**Requirements:**
- Python 3.10+
- FastAPI (`fastapi`, `uvicorn`, `python-multipart`)
- Boto3 (if using DynamoDB for try-on history)

**Steps:**
1. Copy `routes/tryon.py` into your FastAPI `routes/` or `routers/` folder.
2. Mount the router in your main FastAPI app:
   ```python
   from routes.tryon import router as tryon_router
   app.include_router(tryon_router, prefix="/api/v1")
   ```
3. Copy `services/tryon_service.py` and `services/fashn_service.py` into your backend's `services/` directory.
4. Ensure you have an authentication middleware (`get_current_user`) if you wish to track user try-on histories, or remove the `Depends(get_current_user)` from `tryon.py` if making it fully public.
5. In `core/config.py`, add the required FASHN configurations:
   ```python
   fashn_venv: str = "/path/to/venv/python"
   fashn_script: str = "/path/to/fashn/script.py"
   fashn_weights: str = "/path/to/weights"
   fashn_results: str = "/path/to/results"
   ```

### 3. GPU Server Setup (FASHN AI)

1. Provision a GPU server (e.g., RunPod, AWS EC2, GCP).
2. Transfer and run the `infrastructure/gpu-setup/setup_fashn.sh` script on the server.
3. Once running, you can use `start-tryon.py` locally to spin up the local backend and establish a Cloudflare tunnel to expose the backend to the remote GPU instance.

## Image Requirements & Guidelines

FASHN VTON 1.5 performs best when users adhere to specific photo guidelines based on the garment category they are trying on. 

### Categories Supported
The API expects one of three categories:
- `"tops"` (Shirts, t-shirts, cardigans)
- `"bottoms"` (Pants, jeans, skirts, shorts)
- `"dresses"` (Frocks, gowns, bodycon, jumpsuits)

*Note: Ensure your products are mapped to these exact FASHN categories (e.g. `dresses` and not `one-pieces`).*

### Upload Guidelines (Extracted from UI)
- **Tops:** A full-body photo is recommended, but a waist-up (half-pose) photo can also be detected and draped.
- **Bottoms:** Avoid wearing a long top, kurti, or dress that covers your legs. Wear shorts or leggings so the AI can drape the pants correctly.
- **Dresses (Kurtis/Frocks):** A full-body pose photo is strictly required to drape the full-length garment correctly.
- **File constraints:** JPG or PNG formats only, up to 10 MB.
