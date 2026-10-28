import * as FileSystem from 'expo-file-system/legacy';
import { profileOf, type Store } from './repos';

export interface BusinessProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: 'Mi Negocio',
  address: '',
  phone: '',
  email: '',
  taxId: '',
};

const DEMO_STORE_NAME = 'Maple Street Market';
function fileUri(storeId?: string): string {
  return FileSystem.documentDirectory + (storeId ? `business-profile-${storeId}.json` : 'business-profile.json');
}

function normalized(p: Partial<BusinessProfile>): BusinessProfile {
  return {
    name: (p.name ?? '').trim() || DEFAULT_BUSINESS_PROFILE.name,
    address: (p.address ?? '').trim(),
    phone: (p.phone ?? '').trim(),
    email: (p.email ?? '').trim(),
    taxId: (p.taxId ?? '').trim(),
  };
}

export function businessProfileFromStore(store: Store): BusinessProfile {
  const p = profileOf(store);
  return normalized({ name: p.name, address: p.address, phone: p.phone, email: p.email, taxId: p.taxId });
}

export async function getBusinessProfile(store?: Store | null): Promise<BusinessProfile> {
  try {
    const raw = await FileSystem.readAsStringAsync(fileUri(store?.id), { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = JSON.parse(raw) as Partial<BusinessProfile> | null;
    return normalized(parsed ?? {});
  } catch {
    if (store && store.name.trim() !== DEMO_STORE_NAME) return businessProfileFromStore(store);
    return { ...DEFAULT_BUSINESS_PROFILE };
  }
}

export async function saveBusinessProfile(storeId: string, p: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const value = normalized(p);
  await FileSystem.writeAsStringAsync(fileUri(storeId), JSON.stringify(value), { encoding: FileSystem.EncodingType.UTF8 });
  return value;
}

export function applyBusinessProfile(store: Store, p: BusinessProfile): Store {
  return {
    ...store,
    name: p.name,
    address: p.address || null,
    phone: p.phone || null,
    email: p.email || null,
    tax_id: p.taxId || null,
    website: null,
    tagline: null,
  };
}
