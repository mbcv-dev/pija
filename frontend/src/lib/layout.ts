/**
 * Alturas do "chrome" fixo no topo — fonte única para quem depende desse offset.
 *
 * Existiam três números acoplados espalhados (o `top` da barra de áreas, o
 * `rootMargin` do scroll-spy e o `scroll-margin-top` das seções). Como o modo de
 * falha é desalinhamento de poucos pixels — silencioso, sem teste ou tipo que
 * pegue —, todos passam a derivar daqui.
 */

/** AppHeader: `h-14` no Tailwind. */
export const HEADER_H_PX = 56

/** AreaNav: py-2 no container + py-1.5 nos chips + ícone/texto de 14/12px. */
export const AREA_NAV_H_PX = 44

/** O que fica fixo no topo quando a barra de áreas está grudada. */
export const STICKY_OFFSET_PX = HEADER_H_PX + AREA_NAV_H_PX

/** Onde uma seção deve parar ao ser rolada: abaixo do chrome, com respiro. */
export const SCROLL_MARGIN_PX = STICKY_OFFSET_PX + 4
