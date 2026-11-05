/**
 * PublicSpark Newsroom Media Library Service (Task 22)
 * Centralized service for querying, uploading, filtering, and indexing media assets in server/data/uploads/
 */

import { compressImageToWebP } from './mediaService';

/**
 * Fetch indexed media assets with usage metrics, search, and filtering
 * @param {Object} params - Query filters { q, filter, sort }
 * @returns {Promise<{ success: boolean, stats: Object, assets: Array }>}
 */
export async function getMediaAssets({ q = '', filter = 'all', sort = 'newest' } = {}) {
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filter && filter !== 'all') params.set('filter', filter);
    if (sort && sort !== 'newest') params.set('sort', sort);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/media${queryStr}`);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('[Media Service] Failed to fetch media assets:', err.message);
    return {
      success: false,
      stats: { totalCount: 0, usedCount: 0, unusedCount: 0, totalSizeMb: '0.00 MB' },
      assets: []
    };
  }
}

/**
 * Upload an image file or Base64 string to the server media library.
 * Automatically compresses raw files to WebP (< 200KB) before uploading.
 * @param {Object} uploadPayload - { file, imageBase64, articleId, caption, credit, altText, width, height }
 * @returns {Promise<{ success: boolean, url: string, size_kb: number, file_name: string, asset: Object }>}
 */
export async function uploadMediaAsset({ file, imageBase64, articleId = 'general', caption = '', credit = '', altText = '', width, height }) {
  let base64Payload = imageBase64;
  let detectedWidth = width;
  let detectedHeight = height;

  if (file && !base64Payload) {
    const compressed = await compressImageToWebP(file, 200, 1400);
    base64Payload = compressed.dataUrl;
    detectedWidth = compressed.width;
    detectedHeight = compressed.height;
  }

  if (!base64Payload) {
    throw new Error('No valid image file or data URL provided.');
  }

  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64Payload,
      articleId,
      caption: caption || '',
      credit: credit || '',
      altText: altText || '',
      width: detectedWidth,
      height: detectedHeight
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Upload failed with HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Delete a media asset from disk and index with active article safety checks.
 * @param {string} fileName - File name to delete
 * @param {boolean} force - Force deletion even if in use
 * @param {string} userRole - Current user role
 * @returns {Promise<Object>}
 */
export async function deleteMediaAsset(fileName, force = false, userRole = 'editor') {
  const res = await fetch('/api/media/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, force, userRole })
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 409) {
    return {
      success: false,
      conflict: true,
      requiresForce: true,
      error: data.error,
      usedInArticles: data.usedInArticles || []
    };
  }

  if (!res.ok) {
    throw new Error(data.error || `Deletion failed with HTTP ${res.status}`);
  }

  return data;
}

/**
 * Update editorial metadata (caption, credit, altText) for an indexed media asset.
 * @param {string} fileName - Asset file name
 * @param {Object} metadata - { caption, credit, altText, width, height }
 * @param {string} userRole - Current user role ('editor' or 'admin')
 * @returns {Promise<Object>}
 */
export async function updateMediaMetadata(fileName, { caption, credit, altText, width, height }, userRole = 'editor') {
  const res = await fetch('/api/media/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, caption, credit, altText, width, height, userRole })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Update failed with HTTP ${res.status}`);
  }
  return data;
}

/**
 * Format raw byte size into human readable string
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Format ISO datetime string to clean Indian standard readable format
 * @param {string} dtStr 
 * @returns {string}
 */
export function formatMediaDate(dtStr) {
  if (!dtStr) return '';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (_err) {
    return dtStr;
  }
}
