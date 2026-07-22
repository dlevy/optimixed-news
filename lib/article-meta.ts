/**
 * Shared article-metadata vocabulary. Kept free of dependencies so both the
 * classifier and the admin UI can import it (mirrors the CHECK constraints in
 * 0005_article_metadata.sql).
 */
export const ARTICLE_TYPES = [
  "news",
  "opinion",
  "analysis",
  "guide",
  "research",
  "case-study",
  "product-announcement",
  "interview",
  "roundup",
] as const;

export const CONFIDENCE_LEVELS = ["confirmed", "speculation", "opinion", "rumor"] as const;

export const TIMELINESS_LEVELS = ["breaking", "timely", "evergreen"] as const;
