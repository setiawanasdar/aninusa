import { z } from "zod";
import {
  ANIME_STATUSES,
  ANIME_TYPES,
  ROLES,
  SEASONS,
  SORT_OPTIONS,
  SOURCE_STATUSES,
  SUBTITLE_FORMATS,
  VIDEO_FORMATS,
} from "./domain";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      const normalized = emptyToUndefined(value);
      return normalized === undefined ? undefined : Number(normalized);
    },
    z.number().int().min(min).max(max).optional(),
  );

const optionalFloat = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      const normalized = emptyToUndefined(value);
      return normalized === undefined ? undefined : Number(normalized);
    },
    z.number().min(min).max(max).optional(),
  );

export const assetUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "Must be an http(s) URL or a site-relative path",
  });

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: "Only http(s) URLs are supported" });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
  type: z.enum(ANIME_TYPES).optional(),
  status: z.enum(ANIME_STATUSES).optional(),
  year: optionalInt(1900, 2100),
  season: z.enum(SEASONS).optional(),
  genre: z.string().trim().max(80).optional(),
  studio: z.string().trim().max(120).optional(),
  sort: z.enum(SORT_OPTIONS).default("popularity"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(32, "Username maksimal 32 karakter")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip"),
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254),
  password: z
    .string()
    .min(10, "Password minimal 10 karakter")
    .max(128, "Password maksimal 128 karakter")
    .regex(/[a-zA-Z]/, "Password harus mengandung huruf")
    .regex(/[0-9]/, "Password harus mengandung angka"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254),
  password: z.string().min(1).max(128),
});

export const watchProgressSchema = z.object({
  episodeId: z.string().trim().min(10).max(64),
  progress: z.coerce.number().int().min(0).max(86_400),
  duration: z.coerce.number().int().min(0).max(86_400),
  completed: z.boolean().optional(),
});

export const favoriteSchema = z.object({
  animeId: z.string().trim().min(10).max(64),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  includeCompleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .default(false),
});

const dateString = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), { message: "Invalid date" })
  .optional()
  .nullable();

export const adminAnimeSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")
    .optional(),
  title: z.string().trim().min(1).max(300),
  japaneseTitle: z.string().trim().max(300).optional().nullable(),
  englishTitle: z.string().trim().max(300).optional().nullable(),
  alternativeTitles: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  synopsis: z.string().trim().max(20_000).optional().nullable(),
  poster: assetUrlSchema.optional().nullable(),
  banner: assetUrlSchema.optional().nullable(),
  type: z.enum(ANIME_TYPES).default("TV"),
  status: z.enum(ANIME_STATUSES).default("COMPLETED"),
  year: optionalInt(1900, 2100).nullable(),
  season: z.enum(SEASONS).optional().nullable(),
  score: optionalFloat(0, 10).nullable(),
  popularity: z.coerce.number().int().min(0).max(100_000_000).default(0),
  source: z.string().trim().max(120).optional().nullable(),
  duration: optionalInt(1, 600).nullable(),
  totalEpisodes: optionalInt(0, 20_000).nullable(),
  latestEpisode: optionalInt(0, 20_000).nullable(),
  airedFrom: dateString,
  airedTo: dateString,
  malId: optionalInt(1, 2_000_000_000).nullable(),
  anilistId: optionalInt(1, 2_000_000_000).nullable(),
  genres: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  studios: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});

export const adminEpisodeSchema = z.object({
  animeId: z.string().trim().min(10).max(64),
  episodeNumber: z.coerce.number().min(0).max(20_000),
  title: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().max(10_000).optional().nullable(),
  duration: optionalInt(0, 86_400).nullable(),
  thumbnail: assetUrlSchema.optional().nullable(),
  airDate: dateString,
  introStart: optionalInt(0, 86_400).nullable(),
  introEnd: optionalInt(0, 86_400).nullable(),
  outroStart: optionalInt(0, 86_400).nullable(),
});

export const adminSourceSchema = z.object({
  episodeId: z.string().trim().min(10).max(64),
  provider: z.string().trim().min(1).max(80),
  externalId: z.string().trim().max(200).optional().nullable(),
  url: httpUrlSchema,
  quality: z.coerce.number().int().min(0).max(4320).default(0),
  format: z.enum(VIDEO_FORMATS).default("HLS"),
  codec: z.string().trim().max(40).optional().nullable(),
  language: z.string().trim().min(2).max(16).default("ja"),
  subtitleSupport: z.boolean().default(true),
  isActive: z.boolean().default(true),
  status: z.enum(SOURCE_STATUSES).default("ACTIVE"),
});

export const adminSubtitleSchema = z.object({
  episodeId: z.string().trim().min(10).max(64),
  language: z.string().trim().min(2).max(16),
  label: z.string().trim().min(1).max(80),
  url: assetUrlSchema,
  format: z.enum(SUBTITLE_FORMATS).default("VTT"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  status: z.enum(SOURCE_STATUSES).default("ACTIVE"),
});

export const syncSchema = z.object({
  providerKey: z.string().trim().min(1).max(80),
  mode: z.enum(["FULL", "INCREMENTAL"]).default("INCREMENTAL"),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });

export const validateSourcesSchema = z.object({
  type: z.enum(["sources", "subtitles"]),
  id: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const providerTestSchema = z.object({
  providerKey: z.string().trim().min(1).max(80),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type WatchProgressInput = z.infer<typeof watchProgressSchema>;
export type CatalogQueryInput = z.infer<typeof catalogQuerySchema>;
export type AdminAnimeInput = z.infer<typeof adminAnimeSchema>;
export type AdminEpisodeInput = z.infer<typeof adminEpisodeSchema>;
export type AdminSourceInput = z.infer<typeof adminSourceSchema>;
export type AdminSubtitleInput = z.infer<typeof adminSubtitleSchema>;
