/** Documento único de Sanity con `_id: "configuracion"`. */
export interface Configuracion {
  whatsapp: string
  instagram: string
  direccion: string
  horarios: string
  /** Link de Google Maps del local (opcional). Sin él, "Cómo llegar" busca por la dirección. */
  mapaUrl?: string | null
  envioLocal: { habilitado: boolean; costo: number; texto: string }
  envioNacional: { habilitado: boolean; texto: string }
  marquesina: string[]
}
