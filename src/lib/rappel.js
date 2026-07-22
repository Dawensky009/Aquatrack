/**
 * Rappel de cloture — decider QUAND, et selon quelles regles, inviter a
 * cloturer la journee.
 *
 * Une precision qui gouverne tout ce module : il ne PROGRAMME rien tout seul
 * en arriere-plan. Un rappel a heure fixe quand l'application est fermee
 * exigerait un serveur de push, que cette app locale-first n'a pas. Ce qui est
 * garanti ici est plus modeste et plus solide : quand l'application est
 * ouverte, on sait dire s'il est l'heure de rappeler, et si le rappel a un sens
 * (la journee n'est pas deja close, et l'utilisateur ne l'a pas ecarte).
 *
 * Fonctions pures, sans acces au temps ni a la base : l'appelant fournit
 * `maintenant`, ce qui les rend testables au jour et a l'heure pres.
 */

import { cleJour } from './format.js'

/** « 20:00 » → { h: 20, m: 0 }. Tolerant : rend 20:00 sur une entree malformee. */
export function lireHeure(texte) {
  const [h, m] = String(texte ?? '').split(':').map((x) => Number.parseInt(x, 10))
  if (!Number.isInteger(h) || h < 0 || h > 23) return { h: 20, m: 0 }
  return { h, m: Number.isInteger(m) && m >= 0 && m < 60 ? m : 0 }
}

/** La journee de `maintenant` a-t-elle deja ete cloturee ? */
export function journeeCloturee(journees, maintenant = new Date()) {
  const cle = cleJour(maintenant)
  return (journees ?? []).some((j) => j.date === cle && !j.deleted)
}

/** L'heure de rappel est-elle atteinte pour la journee de `maintenant` ? */
export function heureAtteinte(heure, maintenant = new Date()) {
  const { h, m } = lireHeure(heure)
  return maintenant.getHours() > h || (maintenant.getHours() === h && maintenant.getMinutes() >= m)
}

/**
 * Faut-il afficher la banniere de rappel ?
 *
 * Quatre conditions, toutes necessaires : le rappel est actif, l'heure est
 * passee, la journee n'est pas close, et l'utilisateur ne l'a pas deja ecarte
 * AUJOURD'HUI — un rappel qu'on rejette doit se taire jusqu'au lendemain, pas
 * resurgir a chaque navigation.
 */
export function doitAfficherBanniere({ actif, heure, journees, dernierRejet, maintenant = new Date() }) {
  if (!actif) return false
  if (!heureAtteinte(heure, maintenant)) return false
  if (journeeCloturee(journees, maintenant)) return false
  if (dernierRejet === cleJour(maintenant)) return false
  return true
}

/**
 * Prochaine occurrence de l'heure de rappel, a partir de `depuis`.
 *
 * Sert a armer la minuterie de notification : aujourd'hui si l'heure n'est pas
 * encore passee, demain sinon. Renvoie un instant absolu, jamais un delai —
 * l'appelant calcule le delai au moment ou il arme, pour rester juste meme si
 * le calcul et l'armement ne sont pas simultanes.
 */
export function prochaineOccurrence(heure, depuis = new Date()) {
  const { h, m } = lireHeure(heure)
  const cible = new Date(depuis)
  cible.setHours(h, m, 0, 0)
  if (cible <= depuis) cible.setDate(cible.getDate() + 1)
  return cible
}
