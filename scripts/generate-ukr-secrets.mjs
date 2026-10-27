// Run manually; writes a new ignored file and never prints secret values.
import {mkdir,writeFile} from 'node:fs/promises';import {randomBytes} from 'node:crypto';import webpush from 'web-push';
const pair=webpush.generateVAPIDKeys();await mkdir('.local',{recursive:true});
await writeFile('.local/ukr-server-secrets.env',`UKR_DJ_SESSION_SECRET=${randomBytes(32).toString('base64url')}\nUKR_DJ_PASSWORD=${randomBytes(24).toString('base64url')}\nUKR_VAPID_PUBLIC_KEY=${pair.publicKey}\nUKR_VAPID_PRIVATE_KEY=${pair.privateKey}\nUKR_VAPID_SUBJECT=mailto:urbankantoradio@gmail.com\n`,{flag:'wx',mode:0o600});
console.log('Created .local/ukr-server-secrets.env. Configure only the independent UKR server. Do not publish this file.');
