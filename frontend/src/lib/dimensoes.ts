import type { UnidadeDim } from '@/types/api.types'

export interface GrupoDeOpcoes {
  label: string
  options: string[]
}

export interface EspecialidadeSeparada {
  base: string
  subtipo: string | null
}

/** Subtipo de uma base: rótulo exibido + valor BRUTO enviado à API. */
export interface SubtipoEspecialidade {
  subtipo: string
  valor: string
}

/** Uma base de especialidade com seus valores brutos e subtipos derivados. */
export interface BaseEspecialidade {
  base: string
  /** Todos os valores brutos desta base (inclui o valor "puro", se existir). */
  valores: string[]
  subtipos: SubtipoEspecialidade[]
}

/**
 * Separa um valor bruto de especialidade em base + subtipo.
 *
 * Regras (derivação 100% no frontend — o filtro enviado à API continua
 * usando os valores BRUTOS):
 * - O PRIMEIRO separador `" - "` ou `" ("` divide base e subtipo;
 *   ocorrências seguintes ficam dentro do subtipo.
 * - Convenção para `" ("`: o subtipo NÃO inclui os parênteses
 *   (ex.: `CARDIOLOGIA (ECO)` → base `CARDIOLOGIA`, subtipo `ECO`).
 * - Sem separador (ou base/subtipo vazios): base = valor inteiro, subtipo null.
 * - Acentos e caixa são preservados como estão na base de dados.
 * - A base é trimada: `ALERGIA  - X` (dois espaços) agrupa junto com `ALERGIA - Y`
 *   (existe na base real; sem o trim viram duas bases visualmente idênticas).
 */
export function separarEspecialidade(valor: string): EspecialidadeSeparada {
  const iHifen = valor.indexOf(' - ')
  const iParen = valor.indexOf(' (')
  const semSplit: EspecialidadeSeparada = { base: valor, subtipo: null }

  let indice: number
  let porParentese: boolean
  if (iHifen === -1 && iParen === -1) return semSplit
  if (iHifen === -1 || (iParen !== -1 && iParen < iHifen)) {
    indice = iParen
    porParentese = true
  } else {
    indice = iHifen
    porParentese = false
  }

  const base = valor.slice(0, indice).trim()
  let subtipo = porParentese
    ? valor.slice(indice + 2).replace(/\)\s*$/, '')
    : valor.slice(indice + 3)
  subtipo = subtipo.trim()
  if (base.trim() === '' || subtipo === '') return semSplit
  return { base, subtipo }
}

/**
 * Agrupa os valores brutos de especialidade por base, preservando a ordem
 * de aparição. Cada base carrega seus valores brutos (para expandir o filtro)
 * e seus subtipos (para o 2º select).
 */
export function agruparEspecialidades(valores: readonly string[]): BaseEspecialidade[] {
  const bases: BaseEspecialidade[] = []
  const indice = new Map<string, BaseEspecialidade>()
  for (const valor of valores) {
    const { base, subtipo } = separarEspecialidade(valor)
    let bloco = indice.get(base)
    if (!bloco) {
      bloco = { base, valores: [], subtipos: [] }
      indice.set(base, bloco)
      bases.push(bloco)
    }
    bloco.valores.push(valor)
    if (subtipo !== null) bloco.subtipos.push({ subtipo, valor })
  }
  return bases
}

/**
 * Expande a seleção (bases + subtipos) para a lista de valores BRUTOS que vai
 * no filtro `especialidade` existente da API.
 *
 * Semântica por base: se a base selecionada tem algum subtipo selecionado,
 * entram só os valores brutos desses subtipos; senão, entram TODOS os valores
 * brutos da base. Subtipos de bases não selecionadas são ignorados.
 */
export function expandirEspecialidades(
  grupos: readonly BaseEspecialidade[],
  basesSelecionadas: readonly string[],
  subtiposSelecionados: readonly string[],
): string[] {
  const resultado: string[] = []
  const subs = new Set(subtiposSelecionados)
  for (const grupo of grupos) {
    if (!basesSelecionadas.includes(grupo.base)) continue
    const daBase = grupo.subtipos.filter((s) => subs.has(s.valor)).map((s) => s.valor)
    if (daBase.length > 0) resultado.push(...daBase)
    else resultado.push(...grupo.valores)
  }
  return resultado
}

/** Agrupa unidades por grupo assistencial, preservando a ordem de aparição. */
export function agruparUnidades(unidades: readonly UnidadeDim[]): GrupoDeOpcoes[] {
  const blocos: GrupoDeOpcoes[] = []
  const indice = new Map<string, GrupoDeOpcoes>()
  for (const u of unidades) {
    const label = u.grupo ?? 'Sem grupo'
    let bloco = indice.get(label)
    if (!bloco) {
      bloco = { label, options: [] }
      indice.set(label, bloco)
      blocos.push(bloco)
    }
    bloco.options.push(u.valor)
  }
  return blocos
}
