// Ambient types for Deno Edge Functions to satisfy VS Code TypeScript checking

// Minimal Deno runtime surface used in our edge functions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// Ambient module declarations for Deno npm: spec imports
// We keep these light-weight to avoid pulling Node typings into the Deno functions.
declare module 'npm:@supabase/supabase-js@2.32.0' {
  export function createClient(...args: any[]): any;
}

declare module 'npm:luxon@3.4.3' {
  export const DateTime: any;
}
