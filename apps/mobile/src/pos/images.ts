import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { newId } from '../id';

const DIR = FileSystem.documentDirectory + 'products/';
const BRAND_DIR = FileSystem.documentDirectory + 'branding/';
const MAX_PRODUCT_IMAGE = 512;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

async function persist(asset: ImagePicker.ImagePickerAsset, dir: string = DIR): Promise<string> {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = (asset.mimeType && EXT[asset.mimeType]) ?? 'jpg';
  const dest = `${dir}${newId()}.${ext}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });
  return dest;
}

async function persistProduct(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const width = asset.width > 0 ? asset.width : MAX_PRODUCT_IMAGE;
  const height = asset.height > 0 ? asset.height : MAX_PRODUCT_IMAGE;
  const scale = Math.min(1, MAX_PRODUCT_IMAGE / Math.max(width, height));
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    context.resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.WEBP });
    const dest = `${DIR}${newId()}.webp`;
    await FileSystem.copyAsync({ from: saved.uri, to: dest });
    return dest;
  } catch {
    return persist(asset, DIR);
  }
}

export async function pickFromGallery(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  return persistProduct(res.assets[0]);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  return persistProduct(res.assets[0]);
}

export async function pickLogo(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0], BRAND_DIR);
}
