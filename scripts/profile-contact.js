export function resolveProfileContact(profile, agencyNumber) {
  if (profile?.demo) return null;

  const publicNumber = String(profile?.whatsapp ?? "").replace(/\D/g, "");
  const agency = String(agencyNumber ?? "").replace(/\D/g, "");
  const number = publicNumber || agency;
  if (!number) return null;

  const name = [profile?.nombres, profile?.apellidos].filter(Boolean).join(" ").trim();
  return {
    number,
    note: publicNumber ? "" : "Contacto a través de nuestra agencia",
    message: publicNumber
      ? `Hola ${profile?.nombres || ""}, vi tu perfil y quisiera más información.`
      : `Hola, quisiera información sobre ${name || "este perfil"} que vi en el directorio.`,
  };
}
