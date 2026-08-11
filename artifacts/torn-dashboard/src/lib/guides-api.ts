// Client for the guides forum API (served by our api-server at /api/guides).
import type { GuideCategory, GuideAudience } from "./guides";

export interface GuideListItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: GuideCategory;
  audience: GuideAudience;
  authorId: number;
  authorName: string;
  publishedAt: string | null;
  score: number;
  comments: number;
}

export interface GuideComment {
  id: number;
  guideId: number;
  playerId: number;
  playerName: string;
  body: string;
  createdAt: string;
}

export interface GuideDetail extends GuideListItem {
  body: string;
  createdAt: string;
}

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data;
}

export async function fetchGuides(): Promise<GuideListItem[]> {
  const data = await jsonOrThrow(await fetch("/api/guides"));
  return data.guides;
}

export async function fetchGuide(slug: string, apiKey?: string | null) {
  const q = apiKey ? `?key=${encodeURIComponent(apiKey)}` : "";
  const data = await jsonOrThrow(await fetch(`/api/guides/${encodeURIComponent(slug)}${q}`));
  return data as { guide: GuideDetail; comments: GuideComment[]; myVote: number };
}

export async function submitGuide(input: {
  apiKey: string;
  title: string;
  summary: string;
  body: string;
  category: GuideCategory;
  audience: GuideAudience;
}) {
  return jsonOrThrow(
    await fetch("/api/guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  ) as Promise<{ ok: true; slug: string }>;
}

export async function voteGuide(id: number, apiKey: string, value: 1 | -1 | 0) {
  return jsonOrThrow(
    await fetch(`/api/guides/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, value }),
    }),
  ) as Promise<{ ok: true; score: number; myVote: number }>;
}

export async function commentGuide(id: number, apiKey: string, body: string) {
  return jsonOrThrow(
    await fetch(`/api/guides/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, body }),
    }),
  ) as Promise<{ ok: true; comment: GuideComment }>;
}

export async function adminListPending(apiKey: string) {
  const data = await jsonOrThrow(
    await fetch("/api/guides/admin/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }),
  );
  return data.pending as (GuideDetail & { status: string })[];
}

export async function adminReview(id: number, apiKey: string, action: "approve" | "reject") {
  return jsonOrThrow(
    await fetch(`/api/guides/admin/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, action }),
    }),
  );
}

export async function adminDeleteComment(id: number, apiKey: string) {
  return jsonOrThrow(
    await fetch(`/api/guides/admin/comments/${id}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }),
  );
}
