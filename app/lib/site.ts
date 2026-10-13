// Public contact details. The email address is deliberately NOT here — it lives only in server env (CONTACT_TO_EMAIL).
export const WHATSAPP_NUMBER = '923181556942'; // international format, no "+"
export const WHATSAPP_DISPLAY = '+92 318 1556942';
export const MAPS_LINK = 'https://maps.app.goo.gl/5x12DbeywKZvtBUk6';
export const waLink = (text?: string) => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
