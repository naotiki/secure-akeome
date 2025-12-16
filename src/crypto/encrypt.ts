import * as openpgp from 'openpgp';
import type { ContactKey } from '@/types';

export async function encryptForRecipient(plaintext: string, recipient: ContactKey): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: recipient.armoredPublicKey });
  const message = await openpgp.createMessage({ text: plaintext });
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKey,
    format: 'armored',
  });
  return encrypted;
}

