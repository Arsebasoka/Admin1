// ---- Inisialisasi Firebase ----
const firebaseConfig = {
  databaseURL: "https://landig-page-hbh-limadza-default-rtdb.firebaseio.com/"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let currentDonations = [];
let editingId = null;

function formatRupiah(n){
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function formatTime(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
  }catch(e){ return ''; }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Membaca Jumlah Pengunjung (Firebase) ----
function initVisitorCount(){
  db.ref('visitorCount').on('value', (snapshot) => {
    const vc = snapshot.val() || 0;
    const visitorEl = document.getElementById('visitorCount');
    if (visitorEl) {
      visitorEl.textContent = vc.toLocaleString('id-ID');
      visitorEl.classList.remove('loading');
    }
  });
}

// ---- Render List Donasi ----
function renderDonations(list){
  currentDonations = list;
  const wrap = document.getElementById('entryListWrap');
  const note = document.getElementById('entryCountNote');
  const total = list.reduce((s,d)=> s + (Number(d.amount)||0), 0);
  
  const totalDanaEl = document.getElementById('totalDana');
  if(totalDanaEl) {
    totalDanaEl.textContent = formatRupiah(total);
    totalDanaEl.classList.remove('loading');
  }

  if(note) note.textContent = list.length ? (list.length + ' entri') : '';

  if(!wrap) return;

  if(!list.length){
    wrap.innerHTML = '<div class="empty-state">Belum ada dana masuk yang tercatat. Jadilah yang pertama menambahkan.</div>';
    return;
  }

  const sorted = [...list].sort((a,b)=> (b.ts||0) - (a.ts||0));
  wrap.innerHTML = '<div class="entry-list">' + sorted.map(d => {
    if(d.id === editingId){
      return `
      <div class="entry-row editing" data-row-id="${d.id}">
        <div class="edit-form-row">
          <input type="text" class="js-edit-name" value="${escapeHtml(d.name || '')}" placeholder="Nama penyumbang">
          <input type="number" class="js-edit-amount" value="${Number(d.amount)||0}" placeholder="Jumlah (Rp)" min="0" step="1000">
        </div>
        <div class="edit-form-row" style="grid-template-columns:1fr;">
          <input type="text" class="js-edit-note" value="${escapeHtml(d.note || '')}" placeholder="Catatan (opsional)">
        </div>
        <div class="edit-actions">
          <span class="form-msg err js-edit-msg" style="flex:1;"></span>
          <button class="btn btn-ghost js-cancel-edit" data-id="${d.id}" type="button">Batal</button>
          <button class="btn js-save-edit" data-id="${d.id}" type="button">Simpan</button>
        </div>
      </div>`;
    }
    return `
    <div class="entry-row" data-row-id="${d.id}">
      <div class="entry-main">
        <div class="entry-name">${escapeHtml(d.name || 'Hamba Allah')}</div>
        ${d.note ? `<div class="entry-note">${escapeHtml(d.note)}</div>` : ''}
      </div>
      <div class="entry-right">
        <div>
          <div class="entry-amount">${formatRupiah(Number(d.amount)||0)}</div>
          <div class="entry-time">${formatTime(d.ts)}</div>
        </div>
        <div class="entry-actions">
          <button class="icon-btn js-edit" data-id="${d.id}" title="Edit" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn danger js-delete" data-id="${d.id}" title="Hapus" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('') + '</div>';

  attachRowHandlers();
}

// ---- Action Handler (Edit & Hapus Cepat) ----
function attachRowHandlers(){
  document.querySelectorAll('.js-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = btn.dataset.id;
      renderDonations(currentDonations);
    });
  });

  document.querySelectorAll('.js-cancel-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = null;
      renderDonations(currentDonations);
    });
  });

  // Edit Data di Firebase
  document.querySelectorAll('.js-save-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const row = document.querySelector(`.entry-row[data-row-id="${id}"]`);
      const name = row.querySelector('.js-edit-name').value.trim();
      const amount = parseFloat(row.querySelector('.js-edit-amount').value);
      const note = row.querySelector('.js-edit-note').value.trim();
      const msgEl = row.querySelector('.js-edit-msg');

      if(!amount || amount <= 0){
        msgEl.textContent = 'Jumlah dana tidak valid.';
        return;
      }

      db.ref('donations/' + id).update({
        name: name || 'Hamba Allah',
        amount: amount,
        note: note
      }).then(() => {
        editingId = null;
      }).catch((err) => {
        msgEl.textContent = 'Gagal memperbarui: ' + err.message;
      });
    });
  });

  // Hapus Data dari Firebase (Instan & Responsif)
  document.querySelectorAll('.js-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      
      if (confirm('Yakin ingin menghapus data donasi ini?')) {
        // Efek visual langsung menyembunyikan elemen
        const row = document.querySelector(`.entry-row[data-row-id="${id}"]`);
        if(row) row.style.opacity = '0.3';

        // Proses hapus di Firebase
        db.ref('donations/' + id).remove().catch((err) => {
          if(row) row.style.opacity = '1';
          alert("Gagal menghapus: " + err.message);
        });
      }
    });
  });
}

// ---- Tambah Data Baru ke Firebase ----
document.getElementById('btnAdd').addEventListener('click', () => {
  const nameEl = document.getElementById('inpName');
  const amountEl = document.getElementById('inpAmount');
  const noteEl = document.getElementById('inpNote');
  const msg = document.getElementById('formMsg');

  const name = nameEl.value.trim();
  const amount = parseFloat(amountEl.value);
  const note = noteEl.value.trim();

  if(!amount || amount <= 0){
    msg.textContent = 'Isi jumlah dana yang valid terlebih dahulu.';
    msg.className = 'form-msg err';
    return;
  }

  msg.textContent = 'Menyimpan ke server…';
  msg.className = 'form-msg';

  const newRef = db.ref('donations').push();
  newRef.set({
    id: newRef.key,
    name: name || 'Hamba Allah',
    amount: amount,
    note: note,
    ts: Date.now()
  }).then(() => {
    nameEl.value = '';
    amountEl.value = '';
    noteEl.value = '';
    msg.textContent = 'Tersimpan online!';
    msg.className = 'form-msg ok';
  }).catch((err) => {
    msg.textContent = 'Gagal menyimpan: ' + err.message;
    msg.className = 'form-msg err';
  });
});

// ---- UI Events ----
document.getElementById('toggleAdmin').addEventListener('click', () => {
  const panel = document.getElementById('adminPanel');
  const btn = document.getElementById('toggleAdmin');
  const isOpen = panel.classList.toggle('open');
  btn.textContent = isOpen ? '– Tutup form' : '+ Tambah data dana masuk';
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  // Data otomatis sync
});

// ---- Membaca List Donasi Real-time ----
function initDonationsListener(){
  db.ref('donations').on('value', (snapshot) => {
    const data = snapshot.val();
    const list = data ? Object.values(data) : [];
    renderDonations(list);
  });
}

// Inisialisasi Awal
initVisitorCount();
initDonationsListener();