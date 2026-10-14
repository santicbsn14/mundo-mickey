/** Documento único de Sanity con `_id: "configuracion"`. */
export interface Configuracion {
  whatsapp: string
  instagram: string
  direccion: string
  horarios: string
  envioLocal: { habilitado: boolean; costo: number; texto: string }
  envioNacional: { habilitado: boolean; texto: string }
  marquesina: string[]
}
