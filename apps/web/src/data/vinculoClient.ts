import {
  VinculoRowsSchema, InviteSchema, InviteCodeSchema, AcceptResultSchema, MeVinculoSchema,
  type VinculoEstado,
} from "@holy-oly/core";

export interface VinculoRow {
  id: string;
  estado: VinculoEstado;
  athlete: { id: string; nombre: string; iniciales: string };
}

/** Lo que la atleta ve de su propio vínculo: estado + nombre del coach, nada más. */
export interface MeVinculo {
  estado: VinculoEstado;
  coachNombre: string;
}

const BASE = import.meta.env.VITE_API_URL ?? "";

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `request failed (${res.status})`);
  }
  return res.json();
}

async function req(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

export async function getInvite(): Promise<{ inviteCode: string | null }> {
  return InviteSchema.parse(await req("GET", "/invite"));
}
export async function rotateInvite(): Promise<{ inviteCode: string }> {
  return InviteCodeSchema.parse(await req("POST", "/invite/rotate"));
}
export async function listVinculos(): Promise<VinculoRow[]> {
  return VinculoRowsSchema.parse(await req("GET", "/vinculos"));
}
export async function acceptCode(code: string): Promise<{ id: string; estado: VinculoEstado }> {
  return AcceptResultSchema.parse(await req("POST", "/vinculos/accept", { code }));
}
/** Estado del vínculo de la atleta logueada (Cuenta). null = sin vínculo vigente. */
export async function getMyVinculo(): Promise<MeVinculo | null> {
  return MeVinculoSchema.parse(await req("GET", "/me/vinculo")).vinculo;
}
export async function confirmVinculo(id: string): Promise<void> {
  await req("POST", `/vinculos/${encodeURIComponent(id)}/confirm`);
}
export async function denyVinculo(id: string): Promise<void> {
  await req("POST", `/vinculos/${encodeURIComponent(id)}/deny`);
}
