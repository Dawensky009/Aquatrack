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

/**
 * Change le mot de passe du compte connecte.
 *
 * On verifie D'ABORD l'ancien mot de passe en re-authentifiant : `updateUser`
 * de Supabase ne le demande pas, si bien que sans cette etape quiconque a
 * l'application ouverte pourrait changer le mot de passe en deux gestes. La
 * re-authentification renvoie une session pour le MEME compte, donc elle ne
 * deconnecte pas.
 */
export async function changerMotDePasse(actuel, nouveau) {
  if (!supabaseConfigure) throw new ErreurAuth("La sauvegarde en ligne n'est pas configurée.")
  if (nouveau.length < 6) throw new ErreurAuth('Le nouveau mot de passe doit faire au moins 6 caractères.')

  const { data } = await supabase.auth.getUser()
  const email = data?.user?.email
  if (!email) throw new ErreurAuth('Vous devez être connecté pour changer votre mot de passe.')

  const { error: erreurVerif } = await supabase.auth.signInWithPassword({ email, password: actuel })
  if (erreurVerif) throw new ErreurAuth('Mot de passe actuel incorrect.')

  const { error } = await supabase.auth.updateUser({ password: nouveau })
  if (error) throw new ErreurAuth(traduire(error))
}

export async function deconnecter() {
  if (!supabaseConfigure) return
  await supabase.auth.signOut()

  // Une deconnexion VOLONTAIRE remet l'appareil a l'etat non configure :
  // la prochaine ouverture redemandera qui vous etes. C'est different d'une
  // session expiree faute de reseau — celle-la ne bloque jamais, sinon
  // l'application deviendrait inutilisable un soir de coupure.
  //
  // Les donnees locales ne sont PAS effacees : se reconnecter les retrouve.
  await ecrireMeta('appareil_configure', false)

  // Le curseur de synchronisation DOIT etre remis a zero. Sans cela, une
  // reconnexion sur un autre compte ne redescendrait que les lignes modifiees
  // depuis le dernier passage, et l'application afficherait un melange des
  // deux comptes.
  await ecrireMeta('dernier_pull', null)
}

/* ==========================================================================
   Kiosque — l'unite de partage entre plusieurs comptes
   ========================================================================== */

/**
 * Les donnees n'appartiennent pas a un COMPTE mais a un KIOSQUE. Plusieurs
 * comptes le rejoignent et voient les memes chiffres ; `user_id` ne sert plus
 * qu'a dire qui a saisi quoi.
 *
 * Sans cela, l'employe ouvrirait une application vide et ses saisies
 * resteraient invisibles au proprietaire.
 */
export async function monKiosque() {
  if (!supabaseConfigure) return null
  const { data, error } = await supabase
    .from('kiosques')
    .select('id, nom, code_invitation')
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data
}

export async function creerKiosque(nom = 'Mon kiosque', monNom = '') {
  const { data, error } = await supabase.rpc('creer_kiosque', {
    nom_kiosque: nom,
    mon_nom: monNom,
  })
  if (error) throw new ErreurAuth(traduire(error))
  return data?.[0] ?? null
}

export async function rejoindreKiosque(code, monNom = '') {
  const { data, error } = await supabase.rpc('rejoindre_kiosque', {
    code,
    mon_nom: monNom,
  })
  if (error) {
    if ((error.message ?? '').includes('Code invalide')) {
      throw new ErreurAuth("Ce code d'invitation n'existe pas. Vérifiez les 6 caractères.")
    }
    throw new ErreurAuth(traduire(error))
  }
  return data?.[0] ?? null
}

/** Membres du kiosque, pour afficher qui a saisi quoi. */
export async function membresKiosque() {
  if (!supabaseConfigure) return []
  const { data, error } = await supabase
    .from('membres')
    .select('user_id, role, nom, created_at')
    .order('created_at')
  return error ? [] : (data ?? [])
}

export async function retirerMembre(userId) {
  const { error } = await supabase.rpc('retirer_membre', { cible: userId })
  if (error) throw new ErreurAuth(traduire(error))
}

/** S'abonne aux changements de session. Renvoie une fonction de desabonnement. */
export function surChangementSession(rappel) {
  if (!supabaseConfigure) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_evenement, session) => rappel(session))
  return () => data?.subscription?.unsubscribe()
}
