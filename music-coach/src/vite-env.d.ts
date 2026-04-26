/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_SPATIALREAL_APP_ID: string;
  readonly VITE_SPATIALREAL_AVATAR_ID: string;
  readonly VITE_SPATIALREAL_SESSION_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// SpatialReal AvatarKit module declaration (loaded dynamically)
declare module '@spatialwalk/avatarkit' {
  export class AvatarSDK {
    static isInitialized: boolean;
    static initialize(appId: string, opts: Record<string, unknown>): Promise<void>;
    static setSessionToken(token: string): void;
  }
  export class AvatarManager {
    static shared: { load(avatarId: string): Promise<unknown> };
  }
  export class AvatarView {
    constructor(avatar: unknown, el: HTMLElement);
    controller: {
      start(): Promise<void>;
      close(): void;
      send(audio: ArrayBuffer, isFinal: boolean): void;
      initializeAudioContext(): Promise<void>;
      onConnectionState?: (state: string) => void;
    };
    dispose(): void;
  }
  export enum Environment {
    intl = 'intl',
  }
  export enum DrivingServiceMode {
    sdk = 'sdk',
  }
}
