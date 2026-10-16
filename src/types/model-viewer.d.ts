import type { DetailedHTMLProps, HTMLAttributes, SyntheticEvent } from "react";

declare global {
  interface HTMLModelViewerElement extends HTMLElement {
    autoRotate: boolean;
    cameraOrbit: string;
    cameraTarget: string;
    fieldOfView: string;
    exposure: number;
    shadowIntensity: number;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLModelViewerElement>, HTMLModelViewerElement> & {
        src?: string;
        alt?: string;
        poster?: string;
        "camera-controls"?: boolean | string;
        "touch-action"?: string;
        "auto-rotate"?: boolean | string;
        "auto-rotate-delay"?: string;
        "rotation-per-second"?: string;
        "shadow-intensity"?: string;
        "shadow-softness"?: string;
        bounds?: string;
        "environment-image"?: string;
        exposure?: number;
        "interaction-prompt"?: string;
        onLoad?: (event: SyntheticEvent<HTMLModelViewerElement>) => void;
        onError?: (event: SyntheticEvent<HTMLModelViewerElement>) => void;
      };
    }
  }
}

export {};
