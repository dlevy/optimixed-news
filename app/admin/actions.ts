"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, checkPassword, makeSessionToken } from "@/lib/admin-auth";
import {
  adminAddPostSource,
  adminConvertToInternal,
  adminCreateSource,
  adminDeletePostSource,
  adminDeleteSource,
  adminPublishInternal,
  adminRestoreRevision,
  adminSetPostCategory,
  adminSetPostStatus,
  adminUnpublishInternal,
  adminUpdateInternalArticle,
  adminUpdateSource,
  adminUploadSourceImage,
  type SourceInput,
} from "@/lib/admin-queries";
import type { PostStatus, SourceKind } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { runIngestion } from "@/lib/pipeline/ingest";

// ---------- Auth ----------

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!checkPassword(password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const token = await makeSessionToken();
  if (!token) redirect("/admin/login?error=1");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ---------- Manual ingest trigger ----------

export async function runIngestNow() {
  await runIngestion();
  revalidatePath("/admin");
  revalidatePath("/admin/articles");
}

// ---------- Sources CRUD ----------

function sourceInputFromForm(formData: FormData): SourceInput {
  const name = String(formData.get("name") ?? "").trim();
  const feed_url = String(formData.get("feed_url") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "rss") as SourceKind);
  const homepage_url = String(formData.get("homepage_url") ?? "").trim() || null;
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const active = formData.get("active") === "on";
  return { name, feed_url, kind, homepage_url, slug, active };
}

export async function createSource(formData: FormData) {
  await adminCreateSource(sourceInputFromForm(formData));
  revalidatePath("/admin/sources");
}

export async function updateSource(formData: FormData) {
  const id = String(formData.get("id"));
  await adminUpdateSource(id, sourceInputFromForm(formData));
  revalidatePath("/admin/sources");
}

export async function deleteSource(formData: FormData) {
  const id = String(formData.get("id"));
  await adminDeleteSource(id);
  revalidatePath("/admin/sources");
}

// ---------- Article moderation ----------

export async function setPostStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as PostStatus;
  await adminSetPostStatus(id, status);
  revalidatePath("/admin/articles");
}

export async function reclassifyPost(formData: FormData) {
  const id = String(formData.get("id"));
  const categoryId = String(formData.get("category_id")) || null;
  await adminSetPostCategory(id, categoryId);
  revalidatePath("/admin/articles");
}

// ---------- Internal ("Optimixed Exclusive") articles ----------

/** Convert an ingested article, then drop straight into the editor. */
export async function convertToInternal(formData: FormData) {
  const id = String(formData.get("id"));
  const newId = await adminConvertToInternal(id);
  revalidatePath("/admin/articles");
  redirect(`/admin/articles/${newId}`);
}

export async function saveInternalArticle(formData: FormData) {
  const id = String(formData.get("id"));
  await adminUpdateInternalArticle(id, {
    title: String(formData.get("title") ?? "").trim(),
    dek: String(formData.get("dek") ?? "").trim() || null,
    body_md: String(formData.get("body_md") ?? "").trim() || null,
    category_id: String(formData.get("category_id") ?? "") || null,
    article_type: String(formData.get("article_type") ?? "") || null,
    timeliness: String(formData.get("timeliness") ?? "") || null,
  });
  revalidatePath(`/admin/articles/${id}`);
}

export async function publishInternalArticle(formData: FormData) {
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug") ?? "");
  await adminPublishInternal(id);
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/admin/articles");
  revalidatePath("/");
  if (slug) revalidatePath(`/article/${slug}`);
}

export async function unpublishInternalArticle(formData: FormData) {
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug") ?? "");
  await adminUnpublishInternal(id);
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/admin/articles");
  revalidatePath("/");
  if (slug) revalidatePath(`/article/${slug}`);
}

// ---------- Attributed sources ----------

export async function addArticleSource(formData: FormData) {
  const postId = String(formData.get("post_id"));
  const file = formData.get("image");
  const url = String(formData.get("url") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const role = (String(formData.get("role") ?? "secondary") || "secondary") as
    | "primary"
    | "secondary"
    | "analysis";

  if (file instanceof File && file.size > 0) {
    // A screenshot (tweet, LinkedIn post, dashboard) — stored as evidence and
    // read back by the model during refinement.
    const { path, url: imageUrl } = await adminUploadSourceImage(postId, file);
    await adminAddPostSource(postId, {
      kind: "screenshot",
      role,
      title,
      note,
      image_path: path,
      image_url: imageUrl,
    });
  } else if (url) {
    await adminAddPostSource(postId, {
      kind: "url",
      role,
      url,
      title,
      publisher: hostnameOf(url),
      note,
    });
  } else if (note) {
    await adminAddPostSource(postId, { kind: "note", role, title, note });
  }

  revalidatePath(`/admin/articles/${postId}`);
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function deleteArticleSource(formData: FormData) {
  const id = String(formData.get("id"));
  const postId = String(formData.get("post_id"));
  await adminDeletePostSource(id);
  revalidatePath(`/admin/articles/${postId}`);
}

// ---------- Revisions ----------

export async function restoreRevision(formData: FormData) {
  const id = String(formData.get("id"));
  const postId = await adminRestoreRevision(id);
  revalidatePath(`/admin/articles/${postId}`);
}
