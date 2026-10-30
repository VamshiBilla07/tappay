import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";
import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from "react-native-hce";

let session: HCESession | null = null;
/** Merchant: emulate an NFC Type-4 tag carrying the signed request as an NDEF text record. */
export async function startEmitting(payload: string) {
  session = await HCESession.getInstance();
  const tag = new NFCTagType4({ type: NFCTagType4NDEFContentType.Text, content: payload, writable: false });
  await session.setApplication(tag);
  await session.setEnabled(true);
}
export async function stopEmitting() { await session?.setEnabled(false); }

/** Customer: read one tag, return its text payload. */
export async function readTag(): Promise<string> {
  await NfcManager.start();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const rec = tag?.ndefMessage?.[0];
    if (!rec) throw new Error("Empty tag");
    return Ndef.text.decodePayload(Uint8Array.from(rec.payload));
  } finally { NfcManager.cancelTechnologyRequest().catch(() => {}); }
}
