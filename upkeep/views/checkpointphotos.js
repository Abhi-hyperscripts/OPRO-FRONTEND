// Checkpoint photos: up to CHECKPOINT_PHOTO_MAX per checkpoint, taken with the phone camera or picked from the gallery.
// Saved photos come from the audit report. Unsaved changes live in photoDrafts until the row is saved, then
// appendPhotosToForm sends the saved photos to keep (keptPhotos) plus the new files (photo).

var CHECKPOINT_PHOTO_MAX = 5;
var PHOTO_MAX_EDGE = 1600;      // px; phone photos are shrunk to this before upload
var PHOTO_JPEG_QUALITY = 0.82;

var photoSaved = {};   // checkpointId -> [{ fileName, fileurl }]
var photoDrafts = {};  // checkpointId -> { kept: [fileName], added: [{ file, url }] }

// The camera button only makes sense where the browser opens a camera (phones and tablets)
var photoHasCamera = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

function renderPhotoCell(checkpointId, uploads) {
    photoSaved[checkpointId] = (uploads || [])
        .filter(u => u && u.fileName)
        .map(u => ({ fileName: u.fileName, fileurl: u.fileurl }));
    return `<div class="photo-cell" id="photo_cell_${checkpointId}">${photoCellInner(checkpointId)}</div>`;
}

function refreshPhotoCell(checkpointId) {
    const cell = document.getElementById('photo_cell_' + checkpointId);
    if (cell) {
        cell.innerHTML = photoCellInner(checkpointId);
    }
}

// Photos as the auditor currently sees them: kept saved photos first, then new ones
function currentPhotos(checkpointId) {
    const saved = photoSaved[checkpointId] || [];
    const draft = photoDrafts[checkpointId];
    if (!draft) {
        return saved.map(s => ({ url: s.fileurl }));
    }
    const kept = draft.kept.map(name => ({ url: (saved.find(s => s.fileName === name) || {}).fileurl }));
    return kept.concat(draft.added.map(a => ({ url: a.url })));
}

function photoCellInner(checkpointId) {
    const photos = currentPhotos(checkpointId);
    const esc = s => $('<div>').text(s || '').html();

    const thumbs = photos.map((p, i) => `
        <div class="photo-thumb">
            <a href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open photo ${i + 1}">
                <img src="${esc(p.url)}" alt="Checkpoint photo ${i + 1}" class="preview-image">
            </a>
            <button type="button" class="remove-photo-btn" aria-label="Remove photo ${i + 1}"
                    onclick="removeCheckpointPhoto('${checkpointId}', ${i})">
                <i class="fa fa-times"></i>
            </button>
        </div>`).join('');

    let actions = '';
    if (photos.length < CHECKPOINT_PHOTO_MAX) {
        const camera = !photoHasCamera ? '' : `
            <input type="file" id="photo_cam_${checkpointId}" class="photo-input" accept="image/*" capture="environment"
                   onchange="addCheckpointPhotos(this, '${checkpointId}')">
            <label for="photo_cam_${checkpointId}" class="btn-upload-photo" title="Take a photo">
                <i class="fa fa-camera"></i> Camera
            </label>`;
        actions = `
            <div class="photo-actions">
                ${camera}
                <input type="file" id="photo_pick_${checkpointId}" class="photo-input" accept="image/*" multiple
                       onchange="addCheckpointPhotos(this, '${checkpointId}')">
                <label for="photo_pick_${checkpointId}" class="btn-upload-photo${photoHasCamera ? ' btn-upload-photo-alt' : ''}" title="Choose photos">
                    <i class="fa fa-image"></i> ${photoHasCamera ? 'Gallery' : 'Upload'}
                </label>
            </div>`;
    }
    const count = photos.length > 0 ? `<div class="photo-count">${photos.length}/${CHECKPOINT_PHOTO_MAX}</div>` : '';

    return (photos.length ? `<div class="photo-thumbs">${thumbs}</div>` : '') + actions + count;
}

function ensurePhotoDraft(checkpointId) {
    if (!photoDrafts[checkpointId]) {
        photoDrafts[checkpointId] = {
            kept: (photoSaved[checkpointId] || []).map(s => s.fileName),   // same order as currentPhotos
            added: []
        };
    }
    return photoDrafts[checkpointId];
}

async function addCheckpointPhotos(input, checkpointId) {
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length === 0) {
        return;
    }

    const room = CHECKPOINT_PHOTO_MAX - currentPhotos(checkpointId).length;
    if (files.length > room) {
        alert(`A checkpoint can have at most ${CHECKPOINT_PHOTO_MAX} photos. ` +
            (room > 0 ? `Only the first ${room} will be added.` : 'Remove one to add another.'));
    }

    const draft = ensurePhotoDraft(checkpointId);
    let rejected = 0;
    for (const file of files.slice(0, Math.max(room, 0))) {
        const prepared = await preparePhoto(file);
        if (!prepared) {
            rejected++;
            continue;
        }
        draft.added.push({ file: prepared, url: URL.createObjectURL(prepared) });
    }
    if (rejected > 0) {
        alert(`${rejected} file(s) could not be added. Please choose JPEG or PNG photos under 5 MB.`);
    }

    refreshPhotoCell(checkpointId);
    markRowDirty(checkpointId);
}

function removeCheckpointPhoto(checkpointId, index) {
    const draft = ensurePhotoDraft(checkpointId);
    // Same order as currentPhotos: kept saved photos first, then new ones
    const keptCount = draft.kept.length;
    if (index < keptCount) {
        draft.kept.splice(index, 1);
    } else {
        const removed = draft.added.splice(index - keptCount, 1)[0];
        if (removed) {
            URL.revokeObjectURL(removed.url);
        }
    }
    refreshPhotoCell(checkpointId);
    markRowDirty(checkpointId);
}

// Shrinks a photo to a JPEG of at most PHOTO_MAX_EDGE px. Falls back to the original file when the
// browser can't decode it, as long as it is a small JPEG/PNG. Returns null for anything unusable.
async function preparePhoto(file) {
    if (!file.type || file.type.indexOf('image/') !== 0) {
        return null;
    }
    try {
        const img = await loadImage(file);
        const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(img.src);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY));
        if (blob) {
            return new File([blob], `photo_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`, { type: 'image/jpeg' });
        }
    } catch (e) {
        console.log('Photo could not be resized, sending the original:', e);
    }
    const plainImage = file.type === 'image/jpeg' || file.type === 'image/png';
    return plainImage && file.size <= 5 * 1024 * 1024 ? file : null;
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Adds this checkpoint's photo changes to a save request. Untouched rows send nothing, so their photos stay.
function appendPhotosToForm(formData, checkpointId) {
    const draft = photoDrafts[checkpointId];
    if (!draft) {
        return;
    }
    if (draft.kept.length === 0) {
        formData.append('keptPhotos', '');   // the field must be present: it switches the server to keep-list mode
    }
    draft.kept.forEach(name => formData.append('keptPhotos', name));
    draft.added.forEach(a => formData.append('photo', a.file, a.file.name));
}

function discardPhotoDraft(checkpointId) {
    const draft = photoDrafts[checkpointId];
    if (draft) {
        draft.added.forEach(a => URL.revokeObjectURL(a.url));
        delete photoDrafts[checkpointId];
    }
}

// Unsaved photos must not follow the auditor to another villa's row with the same checkpoint id
function clearPhotoDrafts() {
    Object.keys(photoDrafts).forEach(discardPhotoDraft);
}
