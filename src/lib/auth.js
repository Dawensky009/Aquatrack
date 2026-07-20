/**
 * Authentification Supabase.
 *
 * REGLE QUI GOUVERNE TOUT CE MODULE : la connexion conditionne la
 * SAUVEGARDE, jamais l'usage. L'application s'ouvre et fonctionne sans
 * compte, exactement comme elle le fait sans configuration Supabase. Un
 * ecran de connexion au demarrage rendrait l'app inutilisable hors-ligne —
 * c'est-a-dire precisement quand on encaisse.
 *
 * Le module reste silencieux si Supabase n'est pas configure : toutes les
 * fonctions renvoient un etat neutre plutot que de lever.
 */

import { supabase, supabaseConfigure } from './supabase.js'
import { ecrireMeta } from './db.js'

export class ErreurAuth extends Error {}

/** Messages du serveur, traduits. Les libelles bruts sont en anglais. */
function traduire(erreur) {
  const m = (erreur?.message ?? '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (m.includes('email not confirmed')) {
    return "Votre email n'est pas encore confirmé. Vérifiez votre boîte de réception."
  }
  if (m.includes('user already registered')) {
    return 'Un compte existe déjà avec cet email. Connectez-vous.'
  }
  if (m.includes('password should be at least')) {
    return 'Le mot de passe doit faire au moins 6 caractères.'
  }
  if (m.includes('unable to validate email')) return "Cette adresse email n'est pas valide."
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Serveur injoignable. Vos données restent enregistrées sur cet appareil.'
  }
  return erreur?.message ?? 'Une erreur est survenue.'
}

export async function sessionCourante() {
  if (!supabaseConfigure) return null
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

export async function connecter(email, motDePasse) {
  if (!supabaseConfigure) throw new ErreurAuth("La sauvegarde en ligne n'est pas configurée.")
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: motDePasse,
  })
  if (error) throw new ErreurAuth(traduire(error))
  return data.session
}

export async function inscrire(email, motDePasse) {
  if (!supabaseConfigure) throw new ErreurAuth("La sauvegarde en ligne n'est pas configurée.")
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: motDePasse,
  })
  if (error) throw new ErreurAuth(traduire(error))

  // Selon le reglage du projet, Supabase peut exiger une confirmation par
  // email avant d'ouvrir la session. Le distinguer evite d'afficher
  // « connecté » alors que rien n'est actif.
  return { session: data.session, confirmationRequise: !data.session }
}

export async function deconnecter() {
  if (!supabaseConfigure) return
  await supabase.auth.signOut()

  // Le curseur de synchronisation DOIT etre remis a zero. Sans cela, une
  // reconnexion sur un autre compte ne redescendrait que les lignes modifiees
  // depuis le dernier passage, et l'application afficherait un melange des
  // deux comptes.
  await ecrireMeta('dernier_pull', null)
}

/** S'abonne aux changements de session. Renvoie une fonction de desabonnement. */
export function surChangementSession(rappel) {
  if (!supabaseConfigure) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_evenement, session) => rappel(session))
  return () => data?.subscription?.unsubscribe()
}
