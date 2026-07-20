/**
 * Verrouillage de l'application.
 *
 * MODELE DE MENACE — a lire avant de juger la solidite de ce module.
 *
 * Ce verrou protege contre le geste opportuniste : quelqu'un qui attrape le
 * telephone pose sur le comptoir et regarde vos chiffres. C'est le risque
 * reel dans un kiosque, et il est frequent.
 *
 * Il ne protege PAS contre quelqu'un qui a le telephone deverrouille et sait
 * ouvrir les outils de developpement : les donnees vivent dans IndexedDB, en
 * clair, et une application web ne peut pas les chiffrer sans demander un mot
 * de passe a chaque lecture — ce qui rendrait la saisie quotidienne
 * insupportable. Chiffrer avec une cle stockee a cote des donnees ne
 * protegerait personne tout en donnant l'illusion du contraire.
 *
 * Le code PIN n'est jamais stocke. On conserve son empreinte PBKDF2 et un sel
 * aleatoire ; la verification rederive et compare. Meme quelqu'un qui lit la
 * base ne retrouve pas le code.
 */

const ITERATIONS = 150_000

/* ==========================================================================
   Code PIN
   ========================================================================== */

const hex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

const versOctets = (h) => Uint8Array.from(h.match(/.{2}/g).map((o) => parseInt(o, 16)))

async function deriver(code, sel) {
  const cle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sel, iterations: ITERATIONS, hash: 'SHA-256' },
    cle,
    256,
  )
  return hex(bits)
}

/** Prepare le couple { sel, empreinte } a stocker. Le code n'en sort jamais. */
export async function preparerCode(code) {
  const sel = crypto.getRandomValues(new Uint8Array(16))
  return { sel: hex(sel), empreinte: await deriver(code, sel) }
}

export async function verifierCode(code, sel, empreinte) {
  if (!sel || !empreinte) return false
  const calcule = await deriver(code, versOctets(sel))
  // Comparaison a temps constant : une comparaison ordinaire s'arrete au
  // premier caractere different et laisse fuir la position de l'erreur.
  if (calcule.length !== empreinte.length) return false
  let diff = 0
  for (let i = 0; i < calcule.length; i++) diff |= calcule.charCodeAt(i) ^ empreinte.charCodeAt(i)
  return diff === 0
}

/* ==========================================================================
   Biometrie (WebAuthn)
   ========================================================================== */

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/**
 * L'empreinte digitale ou la reconnaissance faciale ne sont disponibles que
 * sur un appareil equipe ET en HTTPS (ou sur localhost). Sur un ordinateur de
 * bureau sans capteur, l'option ne doit pas apparaitre du tout.
 */
export async function biometrieDisponible() {
  try {
    if (!window.PublicKeyCredential) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function enrolerBiometrie(nomUtilisateur = 'Administrateur') {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Aqua Track', id: location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: nomUtilisateur,
        displayName: nomUtilisateur,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        // `platform` : le capteur de l'appareil, pas une cle USB.
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
    },
  })
  if (!cred) throw new Error("L'enrôlement a été annulé.")
  return b64(cred.rawId)
}

/**
 * Demande la biometrie a l'appareil.
 *
 * Sans serveur, la signature renvoyee n'est pas verifiee cryptographiquement.
 * Ce qui compte ici est ailleurs : `userVerification: 'required'` force le
 * systeme d'exploitation a demander l'empreinte ou le visage AVANT de rendre
 * la main. C'est exactement la barriere voulue contre le geste opportuniste.
 */
export async function demanderBiometrie(idBase64) {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: deB64(idBase64) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!assertion
  } catch {
    // Annulation, echec du capteur, appareil change : on retombe simplement
    // sur le code PIN, qui reste toujours disponible.
    return false
  }
}

/* ==========================================================================
   Delais
   ========================================================================== */

export const DELAIS = [
  { valeur: 'instant', libelle: 'Immédiat', ms: 0, aide: 'Dès que vous quittez l’app' },
  { valeur: '1m', libelle: '1 minute', ms: 60_000, aide: 'Le temps de répondre à un appel' },
  { valeur: '5m', libelle: '5 minutes', ms: 300_000, aide: 'Confortable au comptoir' },
]

export const delaiEnMs = (v) => DELAIS.find((d) => d.valeur === v)?.ms ?? 0

/**
 * Faut-il verrouiller ?
 *
 * `depuis` est l'instant ou l'application a ete masquee. Un demarrage a froid
 * (`depuis` absent) verrouille toujours : c'est le cas ou le telephone a le
 * plus de chances d'avoir change de mains.
 */
export function doitVerrouiller(delai, depuis) {
  if (depuis == null) return true
  return Date.now() - depuis >= delaiEnMs(delai)
}
