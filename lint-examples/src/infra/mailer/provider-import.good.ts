import type { Resend } from "resend";
import type { Analytics } from "@vercel/analytics";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { S3Client } from "@aws-sdk/client-s3";
import type { GetObjectCommand } from "@aws-sdk/client-s3/commands";
import type { Mux } from "@mux/mux-node";

export type Providers = [
  Resend,
  Analytics,
  SupabaseClient,
  S3Client,
  GetObjectCommand,
  Mux,
];
