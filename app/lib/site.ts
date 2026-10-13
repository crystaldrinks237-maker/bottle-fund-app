// Public contact details. The email address is deliberately NOT here — it lives only in server env (CONTACT_TO_EMAIL).
export const WHATSAPP_NUMBER = '923181556942'; // international format, no "+"
export const WHATSAPP_DISPLAY = '+92 318 1556942';
export const PHONE_HREF = 'tel:+923181556942';
export const MAPS_LINK = 'https://maps.app.goo.gl/5x12DbeywKZvtBUk6';
// Defaults used until you set your own in Admin → Website → Location.
export const DEFAULT_ADDRESS = 'Near Malik Market, VPO. Siddhar, Tehsil and District Chakwal, 48800, Pakistan';
export const DEFAULT_MAP_EMBED = 'https://maps.google.com/maps?q=Crystal%20Drinks%2C%20Siddhar%2C%20Chakwal%2C%20Pakistan&t=k&z=15&ie=UTF8&iwloc=&output=embed';
export const waLink = (text?: string) => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const whatsappLink = waLink;
