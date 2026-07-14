"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, checkPassword, makeSessionToken } from "@/lib/admin-auth";
import {
  adminCreateSource,
  adminDeleteSource,
  adminSetPostCategory,
  adminSetPostStatus,
  adminUpdateSource,
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
