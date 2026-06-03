import { Platform } from 'react-native';
import { photosApi, type ChallengeActivitySlot } from '@/lib/api';

const EXPORT_SIZE = 1200;
const SLOT_GAP = 4;
const SLOT_RADIUS = 10;
const OVERLAY_HEIGHT = 24;

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement | null> {
  try {
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(); };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

async function renderCollageToCanvas(slots: ChallengeActivitySlot[]): Promise<HTMLCanvasElement> {
  const sorted = [...slots].sort((a, b) => a.grid_position - b.grid_position);
  const cols = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));
  const rows = Math.ceil(sorted.length / cols);

  const slotSize = Math.floor((EXPORT_SIZE - SLOT_GAP * (cols - 1)) / cols);
  const totalW = cols * slotSize + (cols - 1) * SLOT_GAP;
  const totalH = rows * slotSize + (rows - 1) * SLOT_GAP;

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFBF5';
  ctx.fillRect(0, 0, totalW, totalH);

  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (slotSize + SLOT_GAP);
    const y = row * (slotSize + SLOT_GAP);

    const completion = slot.completion;
    const hasPhoto = completion?.status === 'ready' && completion.photo_url;
    const isSelfReported = completion?.status === 'self_reported';

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, slotSize, slotSize, SLOT_RADIUS);
    ctx.clip();

    ctx.fillStyle = (hasPhoto || isSelfReported) ? '#4CAF8222' : '#E7E0D6';
    ctx.fillRect(x, y, slotSize, slotSize);

    if (hasPhoto) {
      const blob = await photosApi.getImageBlob(completion!.id).catch(() => null);
      const img = blob ? await loadImageFromBlob(blob) : null;
      if (img) {
        const imgRatio = img.width / img.height;
        let drawW = slotSize, drawH = slotSize, drawX = x, drawY = y;
        if (imgRatio > 1) {
          drawH = slotSize;
          drawW = slotSize * imgRatio;
          drawX = x - (drawW - slotSize) / 2;
        } else {
          drawW = slotSize;
          drawH = slotSize / imgRatio;
          drawY = y - (drawH - slotSize) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y + slotSize - OVERLAY_HEIGHT, slotSize, OVERLAY_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slot.activity.title, x + slotSize / 2, y + slotSize - 8, slotSize - 8);
    } else if (isSelfReported) {
      ctx.fillStyle = '#4CAF82';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x + slotSize / 2, y + slotSize / 2 - 10);

      ctx.fillStyle = '#1C1917';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(slot.activity.title, x + slotSize / 2, y + slotSize / 2 + 14, slotSize - 16);
    } else {
      ctx.fillStyle = '#78716C';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slot.activity.title, x + slotSize / 2, y + slotSize / 2, slotSize - 16);
    }

    ctx.restore();

    ctx.strokeStyle = (hasPhoto || isSelfReported) ? '#4CAF82' : '#E7E0D6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, slotSize, slotSize, SLOT_RADIUS);
    ctx.stroke();
  }

  return canvas;
}

export async function saveCollagePng(title: string, slots: ChallengeActivitySlot[]): Promise<void> {
  if (Platform.OS !== 'web') return;
  const canvas = await renderCollageToCanvas(slots);
  const link = document.createElement('a');
  link.download = `collage-${title}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function shareCollagePng(title: string, slots: ChallengeActivitySlot[]): Promise<void> {
  if (Platform.OS !== 'web') return;
  const canvas = await renderCollageToCanvas(slots);
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  );
  const file = new File([blob], `collage-${title}.png`, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
  } else {
    await saveCollagePng(title, slots);
  }
}
