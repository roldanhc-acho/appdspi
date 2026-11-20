// Supabase Edge Functions / Deno type declarations for VS Code / TypeScript

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };

  export function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;
  export function serve(
    options: { port?: number; hostname?: string; onListen?: (params: { port: number; hostname: string }) => void },
    handler: (req: Request) => Promise<Response> | Response
  ): void;
}

declare module "https://deno.land/std@*/http/server.ts" {
  export function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@*" {
  export * from "@supabase/supabase-js";
}

declare module "npm:web-push@*" {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }
  interface SendOptions {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  }
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload?: string | Buffer | null,
      options?: SendOptions
    ): Promise<any>;
  };
  export default webpush;
}

declare module "https://*" {
  const content: any;
  export default content;
  export const serve: any;
  export const createClient: any;
}

declare module "npm:*" {
  const content: any;
  export default content;
}
