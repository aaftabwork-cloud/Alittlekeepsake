import { del, get, keys, set } from 'idb-keyval'
import { supabase } from './supabase'
import { uid } from '../types'

/** Persistence facade: Supabase when configured, IndexedDB otherwise. */

export interface ProjectMeta {
  id: string
  name: string
  updated_at: string
  updated_by: string
  thumbnail: string
}

export interface ProjectRecord extends ProjectMeta {
  /** contract-shaped JSON — a project object, or a bare object array
   * when the source was an engine layout export */
  data: Record<string, unknown> | Record<string, unknown>[]
}

export interface AssetRecord {
  id: string
  name: string
  folder: string
  kind: 'image'
  url: string
  created_at: string
}

const PKEY = (id: string) => `proj:${id}`
const AKEY = (id: string) => `asset:${id}`

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export const storage = {
  async listProjects(): Promise<ProjectMeta[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('id,name,updated_at,updated_by,thumbnail')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }
    const ks = (await keys()).filter(k => String(k).startsWith('proj:'))
    const all = await Promise.all(ks.map(k => get(k))) as ProjectRecord[]
    return all
      .filter(Boolean)
      .map(({ data: _d, ...meta }) => meta)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  },

  async getProject(id: string): Promise<ProjectRecord | null> {
    if (supabase) {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
      if (error) return null
      return data as ProjectRecord
    }
    return (await get(PKEY(id))) ?? null
  },

  async createProject(name: string, data: ProjectRecord["data"], thumbnail = ""): Promise<string> {
    const id = uid('p')
    const rec: ProjectRecord = {
      id, name, data, thumbnail,
      updated_at: new Date().toISOString(),
      updated_by: await this.whoami(),
    }
    if (supabase) {
      const { data: row, error } = await supabase
        .from('projects')
        .insert({ name, data, thumbnail, updated_by: rec.updated_by })
        .select('id')
        .single()
      if (error) throw error
      return row.id
    }
    await set(PKEY(id), rec)
    return id
  },

  /** Returns the server timestamp; pass `ifUnmodifiedSince` for conflict detection. */
  async saveProject(
    id: string,
    patch: { name?: string; data?: ProjectRecord["data"]; thumbnail?: string },
    ifUnmodifiedSince?: string,
  ): Promise<{ ok: boolean; conflict?: ProjectMeta; updated_at?: string }> {
    const now = new Date().toISOString()
    if (supabase) {
      if (ifUnmodifiedSince) {
        const { data: cur } = await supabase.from('projects').select('id,name,updated_at,updated_by,thumbnail').eq('id', id).single()
        if (cur && cur.updated_at > ifUnmodifiedSince) {
          return { ok: false, conflict: cur }
        }
      }
      const { error } = await supabase
        .from('projects')
        .update({ ...patch, updated_at: now, updated_by: await this.whoami() })
        .eq('id', id)
      if (error) throw error
      return { ok: true, updated_at: now }
    }
    const rec = (await get(PKEY(id))) as ProjectRecord | undefined
    if (!rec) return { ok: false }
    await set(PKEY(id), { ...rec, ...patch, updated_at: now, updated_by: await this.whoami() })
    return { ok: true, updated_at: now }
  },

  async deleteProject(id: string): Promise<void> {
    if (supabase) {
      await supabase.from('projects').delete().eq('id', id)
      return
    }
    await del(PKEY(id))
  },

  async duplicateProject(id: string): Promise<string | null> {
    const rec = await this.getProject(id)
    if (!rec) return null
    return this.createProject(`${rec.name} copy`, rec.data, rec.thumbnail)
  },

  /* ------------------------------------------------------------ assets */

  async listAssets(): Promise<AssetRecord[]> {
    if (supabase) {
      const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }
    const ks = (await keys()).filter(k => String(k).startsWith('asset:'))
    const all = await Promise.all(ks.map(k => get(k))) as AssetRecord[]
    return all.filter(Boolean).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async uploadAsset(file: File, folder = ''): Promise<AssetRecord> {
    const id = uid('a')
    if (supabase) {
      const path = `${folder ? folder + '/' : ''}${id}-${file.name.replace(/[^\w.\-]+/g, '_')}`
      const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: false })
      if (error) throw error
      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path)
      const rec = { name: file.name, folder, kind: 'image' as const, url: pub.publicUrl }
      const { data: row, error: e2 } = await supabase.from('assets').insert(rec).select('*').single()
      if (e2) throw e2
      return row as AssetRecord
    }
    const rec: AssetRecord = {
      id, name: file.name, folder, kind: 'image',
      url: await fileToDataUrl(file),
      created_at: new Date().toISOString(),
    }
    await set(AKEY(id), rec)
    return rec
  },

  async deleteAsset(id: string): Promise<void> {
    if (supabase) {
      await supabase.from('assets').delete().eq('id', id)
      return
    }
    await del(AKEY(id))
  },

  async whoami(): Promise<string> {
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      return data.user?.email ?? 'unknown'
    }
    return 'local'
  },
}
