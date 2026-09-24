export function passwordPolicy(password) {
  if (typeof password !== "string" || password.length < 10 || password.length > 128 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password))
    throw new Error("Le mot de passe doit contenir 10 à 128 caractères, avec une lettre et un chiffre.");
}
export function emailValue(email) {
  const value = String(email || "").trim().toLowerCase();
  if (value.length > 254 || !/^\S+@\S+\.\S+$/.test(value)) throw new Error("Saisissez une adresse e-mail valide.");
  return value;
}
export function authMessage(error) {
  if (error?.code === "email_not_confirmed") return "Votre adresse e-mail n’a pas encore été confirmée. Vérifiez votre boîte mail pour continuer.";
  if (["otp_expired", "flow_state_expired", "flow_state_not_found"].includes(error?.code)) return "Ce lien a expiré ou a déjà été utilisé. Demandez un nouvel e-mail.";
  if (error?.status === 429 || /rate_limit/.test(error?.code || "")) return "Trop de demandes. Patientez quelques minutes avant de réessayer.";
  if (error?.name === "AuthRetryableFetchError" || error instanceof TypeError) return "La connexion Internet est indisponible. Réessayez une fois connecté.";
  if (["weak_password", "same_password"].includes(error?.code)) return "Choisissez un nouveau mot de passe plus robuste, différent du précédent.";
  return "Impossible de se connecter ou de modifier le compte. Vérifiez vos informations et réessayez.";
}
export function createAuthService(client, redirect) {
  const requireClient = () => { if (!client) throw new Error("Le service de compte n’est pas encore configuré. Vos anciennes données sont conservées sur cet appareil."); return client.auth; };
  async function result(request) {
    const { data, error } = await request;
    if (error) throw new Error(authMessage(error));
    return data;
  }
  return {
    async create({ email, username, password }) {
      email = emailValue(email); username = String(username || "").trim();
      if (username.length < 2 || username.length > 40) throw new Error("Le pseudo doit contenir entre 2 et 40 caractères.");
      passwordPolicy(password);
      await result(requireClient().signUp({ email, password, options: { data: { username }, emailRedirectTo: redirect("confirm") } }));
      return email;
    },
    async login({ email, password }) {
      const data = await result(requireClient().signInWithPassword({ email: emailValue(email), password }));
      if (!data.user?.email_confirmed_at) throw new Error("Votre adresse e-mail n’a pas encore été confirmée.");
      return data;
    },
    async resend(email) { return result(requireClient().resend({ type: "signup", email: emailValue(email), options: { emailRedirectTo: redirect("confirm") } })); },
    async forgot(email) { return result(requireClient().resetPasswordForEmail(emailValue(email), { redirectTo: redirect("recovery") })); },
    async reset(password) { passwordPolicy(password); return result(requireClient().updateUser({ password })); },
    async changeEmail(email) { return result(requireClient().updateUser({ email: emailValue(email) }, { emailRedirectTo: redirect("email") })); },
  };
}
