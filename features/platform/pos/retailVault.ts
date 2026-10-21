import { parseRetailIntent, sameRetailIdentity, type RetailIdentity, type RetailIntent, type RetailReceipt } from "./retainedRetail";

// Browser-only encrypted retention, not an authority token. The server still
// authenticates the original actor and reauthorizes every read/retry. Device or
// same-origin script compromise is not prevented by client-side encryption.
const databaseName = "ofc-retail-private-v1";
export const retailVaultLock = "ofc:retail-private:v1";
type Sealed = RetailIdentity & { version: 1; purpose: string; key: string; iv: Uint8Array<ArrayBuffer>; bytes: ArrayBuffer };
let database: Promise<IDBDatabase> | undefined;
function request<T>(input: IDBRequest<T>): Promise<T> { return new Promise((resolve,reject) => { input.onsuccess=()=>resolve(input.result);input.onerror=()=>reject(new Error("Private storage unavailable")); }); }
function committed(tx: IDBTransaction) { return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error("Private storage unavailable"));}); }
function open() {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) throw new Error("Private storage unavailable");
  return database ??= new Promise<IDBDatabase>((resolve,reject)=>{
    const value=indexedDB.open(databaseName,1);
    value.onupgradeneeded=()=>{ for(const name of ["keys","journal","history"]) if(!value.result.objectStoreNames.contains(name))value.result.createObjectStore(name); };
    value.onsuccess=()=>resolve(value.result);value.onerror=()=>reject(new Error("Private storage unavailable"));
  });
}
async function read(store: string, id: string): Promise<unknown> { const db=await open();return request(db.transaction(store,"readonly").objectStore(store).get(id)); }
async function write(store: string,id:string,value:unknown) { const db=await open(),tx=db.transaction(store,"readwrite"),done=committed(tx);tx.objectStore(store).put(value,id);await done; }
async function encryptionKey(create: boolean): Promise<CryptoKey> {
  const stored=await read("keys","aes");
  if(stored instanceof CryptoKey && stored.algorithm.name==="AES-GCM" && !stored.extractable)return stored;
  if(stored!==undefined||!create)throw new Error("Private encryption key unavailable");
  const generated=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  await write("keys","aes",generated);
  const verified=await read("keys","aes");
  if(!(verified instanceof CryptoKey)||verified.extractable||verified.algorithm.name!=="AES-GCM")throw new Error("Private key did not roundtrip");
  return verified;
}
function header(value: Pick<Sealed,"userId"|"businessId"|"storeId"|"purpose"|"key">) { return new TextEncoder().encode(JSON.stringify({version:1,userId:value.userId,businessId:value.businessId,storeId:value.storeId,purpose:value.purpose,key:value.key})); }
function sealed(value: unknown): Sealed {
  if(!value||typeof value!=="object")throw new Error("Retained operation needs review");
  const item=value as Partial<Sealed>;
  if(item.version!==1||typeof item.userId!=="string"||typeof item.businessId!=="string"||typeof item.storeId!=="string"||typeof item.key!=="string"||!(["completePosSale","refundPosSale"].includes(String(item.purpose)))||!(item.iv instanceof Uint8Array)||item.iv.length!==12||!(item.bytes instanceof ArrayBuffer)||item.bytes.byteLength>100_000)throw new Error("Retained operation needs review");
  return {...item,iv:new Uint8Array(item.iv)} as Sealed;
}
async function encrypt(intent:RetailIntent,receipt:RetailReceipt|null,create:boolean):Promise<Sealed> {
  const key=await encryptionKey(create),iv=crypto.getRandomValues(new Uint8Array(12));
  const identity={version:1 as const,userId:intent.userId,businessId:intent.businessId,storeId:intent.storeId,purpose:intent.purpose,key:intent.key};
  const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:header(identity)},key,new TextEncoder().encode(JSON.stringify({intent,receipt})));
  return {...identity,iv,bytes};
}
async function decrypt(value:Sealed,identity:RetailIdentity) {
  if(!sameRetailIdentity(value,identity))throw new Error("Retained operation belongs to another account or store");
  const key=await encryptionKey(false);
  const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:value.iv,additionalData:header(value)},key,value.bytes);
  const parsed: unknown=JSON.parse(new TextDecoder().decode(bytes));
  if(!parsed||typeof parsed!=="object"||!("intent" in parsed)||!("receipt" in parsed))throw new Error("Retained operation needs review");
  const intent=parseRetailIntent(parsed.intent);
  if(!sameRetailIdentity(intent,identity)||intent.key!==value.key||intent.purpose!==value.purpose)throw new Error("Retained identity changed");
  return {intent,receipt:parsed.receipt};
}
function sameCipher(a:Sealed,b:Sealed) { return new TextDecoder().decode(header(a))===new TextDecoder().decode(header(b))&&a.iv.every((v,i)=>v===b.iv[i])&&a.bytes.byteLength===b.bytes.byteLength&&new Uint8Array(a.bytes).every((v,i)=>v===new Uint8Array(b.bytes)[i]); }
export function retailVault(identity:RetailIdentity) {
  const historyId=JSON.stringify(identity);
  return {
    async load() {
      const value=await read("journal","pending");if(value===undefined)return null;
      const result=await decrypt(sealed(value),identity);
      if(result.receipt!==null)throw new Error("Pending operation state changed");
      return result.intent;
    },
    async save(intent:RetailIntent) {
      if(!sameRetailIdentity(intent,identity))throw new Error("Original account or store changed");
      const previous=await read("journal","pending");
      if(previous!==undefined&&JSON.stringify((await decrypt(sealed(previous),identity)).intent)!==JSON.stringify(intent))throw new Error("Retained operation changed");
      await write("journal","pending",await encrypt(intent,null,true));
    },
    async confirm(intent:RetailIntent,receipt:RetailReceipt) {
      const raw=sealed(await read("journal","pending")),current=await decrypt(raw,identity);
      if(JSON.stringify(current.intent)!==JSON.stringify(intent)||current.receipt!==null)throw new Error("Retained operation changed");
      const archived=await encrypt(intent,receipt,false),db=await open(),tx=db.transaction(["journal","history"],"readwrite"),done=committed(tx);
      const latest=sealed(await request(tx.objectStore("journal").get("pending")));
      if(!sameCipher(raw,latest)){tx.abort();await done;return;}
      tx.objectStore("history").put(archived,historyId);tx.objectStore("journal").delete("pending");await done;
    },
    async history() {
      const value=await read("history",historyId);return value===undefined?null:decrypt(sealed(value),identity);
    },
  };
}
